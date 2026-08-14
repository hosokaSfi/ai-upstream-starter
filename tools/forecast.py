#!/usr/bin/env python3
"""納期計算(AI不使用のロジック層)。3点予測・逆算・バーンダウンを決定論的に計算する。

AIの役割は「入力値を決めること」と「結果を解釈すること」だけ。計算はこのスクリプトが行う。

使い方(初期仮説モード):
  python3 tools/forecast.py --sp 112 --start 2026-08-24 \\
      --members 3 --focus 0.6 --sp-days 0.83 --ramp 0.75 --ramp-sprints 2 \\
      [--sp-must 89] [--deadline 2026-12-20] [--sprint-days 14]

使い方(実績モード: velocity.json があれば直近3スプリントの min/avg/max を使う):
  python3 tools/forecast.py --sp 74 --start 2026-08-24 --velocity-file docs/backlog/velocity.json

実績の記録:
  python3 tools/forecast.py --record "Sprint 3" --planned 21 --done 18 \\
      --velocity-file docs/backlog/velocity.json

モンテカルロ予測(3点予測より情報量が多い。確率つきの納期 P50/P85/P95 を出す):
  python3 tools/forecast.py --sp 74 --start 2026-08-24 --simulate \\
      [--velocity-file docs/backlog/velocity.json]   # 実績があればブートストラップ標本

見積り精度の自己診断(計画と実績のバイアスを計測し、次の計画SPを補正):
  python3 tools/forecast.py --accuracy --velocity-file docs/backlog/velocity.json
"""
import argparse, json, math, sys, io, random
from datetime import date, timedelta
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")


def sprints_needed(sp, v_std, ramp, ramp_sprints):
    """立ち上げ補正つきで必要スプリント数を数える"""
    remaining, n = float(sp), 0
    while remaining > 0 and n < 200:
        v = v_std * ramp if n < ramp_sprints else v_std
        remaining -= v
        n += 1
    return n


def end_date(start: date, n_sprints: int, sprint_days: int) -> date:
    # スプリントは start から連続。最終日は次スプリント開始の3日前(金曜相当)
    return start + timedelta(days=n_sprints * sprint_days - 3)


def burndown_line(sp, v_std, ramp, ramp_sprints, n):
    vals, remaining = [round(sp)], float(sp)
    for i in range(n):
        v = v_std * ramp if i < ramp_sprints else v_std
        remaining = max(0.0, remaining - v)
        vals.append(round(remaining))
    return vals


def monte_carlo(sp, sampler, ramp, ramp_sprints, iters=10000, seed=42):
    """ベロシティ分布から1万回試行し、必要スプリント数の分布を返す"""
    rng = random.Random(seed)  # 再現性のため固定シード
    counts = []
    for _ in range(iters):
        remaining, n = float(sp), 0
        while remaining > 0 and n < 200:
            v = sampler(rng)
            if n < ramp_sprints:
                v *= ramp
            remaining -= max(v, 0.5)
            n += 1
        counts.append(n)
    counts.sort()
    return {p: counts[min(int(iters * p / 100), iters - 1)] for p in (50, 70, 85, 95)}


def cmd_accuracy(vf: Path):
    if not vf.exists():
        print(f"NG: {vf} がありません(forecast.py --record で実績を貯めてください)")
        return 1
    data = [d for d in json.loads(vf.read_text(encoding="utf-8"))
            if d.get("planned") and d.get("done") is not None]
    if len(data) < 2:
        print("実績2件以上で診断できます")
        return 1
    ratios = [d["done"] / d["planned"] for d in data]
    avg = sum(ratios) / len(ratios)
    print("# 見積り精度の自己診断(計画SPに対する完了SPの比率)")
    for d, r in zip(data, ratios):
        print(f"  {d['sprint']}: 計画 {d['planned']:.0f} → 完了 {d['done']:.0f}({r*100:.0f}%)")
    print(f"\n平均達成率: {avg*100:.0f}%")
    if avg < 0.85:
        print(f"→ 計画が慢性的に過大(積みすぎ)。次スプリントの計画SPは"
              f"キャパシティ × {avg:.2f} を上限にすること。持ち越しの常態化はベロシティを壊す。")
    elif avg > 1.1:
        print("→ 計画が過小の可能性。スコープの後入れ(計画外作業)が混ざっていないかレトロで確認。")
    else:
        print("→ 健全(±15%以内)。この精度を維持。")
    half = len(ratios) // 2
    if half >= 1 and len(ratios) >= 4:
        trend = (sum(ratios[half:]) / len(ratios[half:])) - (sum(ratios[:half]) / half)
        print(f"傾向: 後半の達成率が前半比 {trend*100:+.0f}pt({'改善' if trend > 0 else '悪化・要レトロ議題'})")
    return 0


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--sp", type=float, help="残SP")
    ap.add_argument("--sp-must", type=float, help="MUSTのみの残SP")
    ap.add_argument("--start", help="Sprint 1 開始日 YYYY-MM-DD")
    ap.add_argument("--deadline", help="希望納期 YYYY-MM-DD")
    ap.add_argument("--sprint-days", type=int, default=14)
    ap.add_argument("--members", type=float, default=3)
    ap.add_argument("--workdays", type=float, default=10)
    ap.add_argument("--focus", type=float, default=0.6)
    ap.add_argument("--sp-days", type=float, default=0.83, help="1SPあたり人日")
    ap.add_argument("--spread", type=float, default=0.30)
    ap.add_argument("--ramp", type=float, default=0.75)
    ap.add_argument("--ramp-sprints", type=int, default=2)
    ap.add_argument("--velocity-file")
    ap.add_argument("--record", help="実績記録モード: スプリント名")
    ap.add_argument("--planned", type=float)
    ap.add_argument("--done", type=float)
    ap.add_argument("--simulate", action="store_true", help="モンテカルロ予測(P50/P85/P95)")
    ap.add_argument("--accuracy", action="store_true", help="見積り精度の自己診断")
    a = ap.parse_args()

    if a.accuracy:
        return cmd_accuracy(Path(a.velocity_file or "docs/backlog/velocity.json"))

    # --- 実績記録モード ---
    if a.record:
        vf = Path(a.velocity_file or "docs/backlog/velocity.json")
        data = json.loads(vf.read_text(encoding="utf-8")) if vf.exists() else []
        data.append({"sprint": a.record, "planned": a.planned, "done": a.done})
        vf.parent.mkdir(parents=True, exist_ok=True)
        vf.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"記録しました: {a.record} planned={a.planned} done={a.done} → {vf}")
        dones = [d["done"] for d in data if d.get("done") is not None]
        if len(dones) >= 3:
            last3 = dones[-3:]
            print(f"直近3スプリント: min={min(last3)} avg={sum(last3)/3:.1f} max={max(last3)}")
            print("→ 予測を更新: forecast.py --sp <残SP> --start <日付> --velocity-file " + str(vf))
        return 0

    if a.sp is None or not a.start:
        ap.print_help()
        return 1
    start = date.fromisoformat(a.start)

    # --- ベロシティ決定 ---
    ramp, ramp_sprints = a.ramp, a.ramp_sprints
    src = ""
    v = None
    if a.velocity_file and Path(a.velocity_file).exists():
        data = json.loads(Path(a.velocity_file).read_text(encoding="utf-8"))
        dones = [d["done"] for d in data if d.get("done") is not None]
        if len(dones) >= 3:
            last3 = dones[-3:]
            v = {"悲観": min(last3), "標準": sum(last3) / 3, "楽観": max(last3)}
            ramp, ramp_sprints = 1.0, 0  # 実績があれば立ち上げ補正は不要
            src = f"実績ベロシティ(直近3スプリント: {last3})"
        elif dones:
            src_note = f"実績{len(dones)}件のみ(3件未満)→ 仮説と併用してください。実績: {dones}"
            print(f"注意: {src_note}")
    if v is None:
        capacity = a.members * a.workdays * a.focus
        v_std = capacity / a.sp_days
        v = {"悲観": v_std * (1 - a.spread), "標準": v_std, "楽観": v_std * (1 + a.spread)}
        src = (f"初期仮説: {a.members}人×{a.workdays}日×FF{a.focus}={capacity:.1f}実効人日"
               f" ÷ {a.sp_days}人日/SP = 標準{v_std:.1f}SP/スプリント(±{int(a.spread*100)}%、"
               f"Sprint1〜{a.ramp_sprints}は×{a.ramp})")

    print(f"# 納期予測(残 {a.sp:.0f}SP、Sprint1開始 {start}、{a.sprint_days}日スプリント)")
    print(f"ベロシティ根拠: {src}\n")
    print("| シナリオ | V | 必要スプリント | 完了予定日 |")
    print("|---|---|---|---|")
    results = {}
    for name in ["楽観", "標準", "悲観"]:
        n = sprints_needed(a.sp, v[name], ramp, ramp_sprints)
        e = end_date(start, n, a.sprint_days)
        results[name] = (n, e)
        print(f"| {name} | {v[name]:.1f} | {n} | {e} |")

    if a.sp_must:
        n = sprints_needed(a.sp_must, v["悲観"], ramp, ramp_sprints)
        print(f"\nMUSTのみ({a.sp_must:.0f}SP)最小リリース: 悲観でも {n}スプリント → {end_date(start, n, a.sprint_days)}")

    if a.deadline:
        dl = date.fromisoformat(a.deadline)
        n_avail = max(0, (dl - start).days + 3) // a.sprint_days
        cap = sum((v["標準"] * ramp if i < ramp_sprints else v["標準"]) for i in range(n_avail))
        verdict = "OK 収まる見込み" if cap >= a.sp else "NG このままでは収まらない(スコープ削減 or 延伸の判断が必要)"
        print(f"\n締切 {dl} までのスプリント数: {n_avail} / 消化可能SP(標準): {cap:.0f} / 残SP: {a.sp:.0f} → {verdict}")
        n_pes, e_pes = results["悲観"]
        if e_pes > dl:
            print(f"⚠ 悲観シナリオ({e_pes})は締切超過。事前にスコープ削減ラインを合意しておくこと。")

    if a.simulate:
        dones_hist = []
        if a.velocity_file and Path(a.velocity_file).exists():
            dones_hist = [d["done"] for d in json.loads(Path(a.velocity_file).read_text(encoding="utf-8"))
                          if d.get("done") is not None]
        if len(dones_hist) >= 3:
            sampler = lambda rng: rng.choice(dones_hist)  # 実績のブートストラップ標本
            basis = f"実績{len(dones_hist)}スプリントのブートストラップ"
        else:
            lo, mode, hi = v["悲観"], v["標準"], v["楽観"]
            sampler = lambda rng: rng.triangular(lo, hi, mode)  # 仮説の三角分布
            basis = "仮説ベロシティの三角分布(悲観〜楽観)"
        pct = monte_carlo(a.sp, sampler, ramp, ramp_sprints)
        print(f"\n## モンテカルロ予測(1万回試行、{basis})")
        print("| 確率 | スプリント数 | この日までに終わる |")
        print("|---|---|---|")
        for p, n in pct.items():
            print(f"| P{p} | {n} | {end_date(start, n, a.sprint_days)} |")
        print("対外コミットは P85 を推奨(85%の確率で守れる日付)。P50は五分五分なので約束に使わない。")
        if a.deadline:
            dl = date.fromisoformat(a.deadline)
            meets = [p for p, n in pct.items() if end_date(start, n, a.sprint_days) <= dl]
            print(f"締切 {dl} を守れる確率帯: " +
                  (f"P{max(meets)} 以上(おおよそ{max(meets)}%以上の確率)" if meets
                   else "P50でも超過 — スコープ削減の検討が必要"))

    n_std, _ = results["標準"]
    vals = burndown_line(a.sp, v["標準"], ramp, ramp_sprints, n_std)
    labels = ", ".join(f'"S{i}"' for i in range(len(vals)))
    print("\n```mermaid\nxychart-beta")
    print('    title "リリースバーンダウン(標準シナリオ理想線)"')
    print(f"    x-axis [{labels}]")
    print(f'    y-axis "残SP" 0 --> {int(max(vals) * 1.1) + 1}')
    print(f"    line [{', '.join(map(str, vals))}]")
    print("```")
    return 0


if __name__ == "__main__":
    sys.exit(main())
