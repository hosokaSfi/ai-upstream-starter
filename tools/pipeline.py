#!/usr/bin/env python3
"""パイプライン状態管理(AI不使用のロジック層)。

工程の進行状態を docs/.state/pipeline.json に永続化する。
セッションが落ちても・コンテキストが溢れても、ここを見れば「どこまで終わったか」が分かる。

使い方:
  python3 tools/pipeline.py status               # 全工程の状態と「次の一手」を表示
  python3 tools/pipeline.py start <phase>        # 工程を開始(in_progress)
  python3 tools/pipeline.py step <phase> <メモ>  # 工程内チェックポイントを記録
  python3 tools/pipeline.py done <phase>         # 工程を完了(継続メモがあれば警告)
  python3 tools/pipeline.py reset <phase>        # 工程をやり直しに戻す
phase: req | nfr | design | db | arch | backlog | release | sprint | 任意文字列
"""
import json, sys, io
from datetime import datetime, timezone, timedelta
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
ROOT = Path(__file__).resolve().parent.parent
STATE = ROOT / "docs" / ".state" / "pipeline.json"
WIP = ROOT / "docs" / "wip"

PHASES = ["req", "nfr", "design", "db", "arch", "backlog", "release", "sprint"]
LABEL = {
    "req": "01 要件定義", "nfr": "02 非機能要件", "design": "03-05 基本設計",
    "db": "06 DB設計", "arch": "07 アーキテクチャ", "backlog": "12 バックログ",
    "release": "13 リリース計画(納期)", "sprint": "14 スプリント計画",
}
ORDER_HINT = {
    "req": "/req から開始", "nfr": "/req が非機能もまとめて作成",
    "design": "req 承認後に /design", "db": "design 着手後に /db(並行可)",
    "arch": "nfr 確定後に /arch(dbと並行可)", "backlog": "req 承認後に /backlog",
    "release": "backlog 完了後に /release", "sprint": "release 承認後に /sprint plan",
}


def now():
    return datetime.now(timezone(timedelta(hours=9))).isoformat(timespec="seconds")


def load():
    if STATE.exists():
        return json.loads(STATE.read_text(encoding="utf-8"))
    return {"phases": {}, "log": []}


def save(st):
    STATE.parent.mkdir(parents=True, exist_ok=True)
    STATE.write_text(json.dumps(st, ensure_ascii=False, indent=2), encoding="utf-8")


def wip_memo(phase):
    p = WIP / f"{phase}_継続メモ.md"
    return p if p.exists() else None


def cmd_status(st):
    print("=== パイプライン状態 ===")
    nxt = None
    for ph in PHASES:
        info = st["phases"].get(ph, {})
        s = info.get("status", "pending")
        mark = {"pending": "・", "in_progress": "▶", "done": "✔"}.get(s, "?")
        memo = wip_memo(ph)
        memo_s = f"  [継続メモあり: {memo.relative_to(ROOT)}]" if memo else ""
        last = info.get("last_step", "")
        last_s = f"  最終チェックポイント: {last}" if last and s == "in_progress" else ""
        print(f" {mark} {ph:8s} {LABEL.get(ph, ph):20s} {s}{memo_s}{last_s}")
        if nxt is None and s != "done":
            nxt = ph
    print()
    if nxt:
        memo = wip_memo(nxt)
        if memo:
            print(f"次の一手: {nxt} を再開 → まず {memo.relative_to(ROOT)} を読むこと")
        else:
            print(f"次の一手: {ORDER_HINT.get(nxt, nxt + ' を開始')}")
    else:
        print("全工程完了。tools/check_gate.py で最終ゲート判定を実行してください。")
    # in_progressが複数あれば警告
    ip = [p for p, i in st["phases"].items() if i.get("status") == "in_progress"]
    if len(ip) > 1:
        print(f"⚠ 同時進行中の工程が複数あります: {ip}(意図的でなければ done/reset で整理)")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 0
    cmd = sys.argv[1]
    st = load()
    if cmd == "status":
        cmd_status(st)
        return 0
    if len(sys.argv) < 3:
        print("phase を指定してください")
        return 1
    ph = sys.argv[2]
    info = st["phases"].setdefault(ph, {})
    if cmd == "start":
        info["status"] = "in_progress"
        info["started_at"] = now()
        st["log"].append({"t": now(), "ev": f"start {ph}"})
        print(f"{ph} を開始しました。主要Stepごとに `pipeline.py step {ph} \"メモ\"` を実行すること。")
    elif cmd == "step":
        memo = sys.argv[3] if len(sys.argv) > 3 else ""
        info.setdefault("status", "in_progress")
        info["last_step"] = f"{memo} ({now()})"
        st["log"].append({"t": now(), "ev": f"step {ph}: {memo}"})
        print(f"チェックポイント記録: {ph} — {memo}")
    elif cmd == "done":
        m = wip_memo(ph)
        if m:
            print(f"⚠ 継続メモ {m.relative_to(ROOT)} が残っています。完了なら削除してください。")
        info["status"] = "done"
        info["done_at"] = now()
        st["log"].append({"t": now(), "ev": f"done {ph}"})
        print(f"{ph} 完了。")
    elif cmd == "reset":
        info["status"] = "pending"
        info.pop("last_step", None)
        st["log"].append({"t": now(), "ev": f"reset {ph}"})
        print(f"{ph} を pending に戻しました。")
    else:
        print(f"不明なコマンド: {cmd}")
        return 1
    save(st)
    return 0


if __name__ == "__main__":
    sys.exit(main())
