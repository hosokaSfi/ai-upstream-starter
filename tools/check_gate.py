#!/usr/bin/env python3
"""実装開始ゲート判定(AI不使用のロジック層)。

READMEの「実装開始ゲートチェックリスト」のうち機械判定できる項目を一括チェックする。
AIやチームは、このスクリプトがOKを出した後の「内容の妥当性」だけをレビューすればよい。

使い方: python3 tools/check_gate.py [docsディレクトリ=docs]
終了コード: 0=ゲート通過(機械判定分) / 1=不合格あり
"""
import re, sys, subprocess, io
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
TOOLS = Path(__file__).resolve().parent

REQUIRED_APPROVED = {  # ファイル名パターン: 承認が必要か
    "01_要件定義書": True,
    "03_基本設計書": True,
    "06_DB設計書": True,
    "07_アーキテクチャ設計書": True,
}
RECOMMENDED = ["00_プロジェクト憲法", "02_非機能", "12_プロダクトバックログ", "13_リリース計画", "15_DoR_DoD"]


def find(docs, pat):
    return next((f for f in docs.rglob("*.md") if pat in f.name), None)


def main():
    docs = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("docs")
    ok = True
    results = []

    # 1) 必須ドキュメントの存在と承認ステータス
    for pat, need_approval in REQUIRED_APPROVED.items():
        f = find(docs, pat)
        if not f:
            results.append(("NG", f"{pat}*.md が存在しない"))
            ok = False
            continue
        text = f.read_text(encoding="utf-8", errors="replace")
        if need_approval and "承認済み" not in text.split("---")[0] and "承認済み" not in text[:1500]:
            results.append(("NG", f"{f.name}: 管理ヘッダのステータスが「承認済み」でない"))
            ok = False
        else:
            results.append(("OK", f"{f.name}: 存在・承認済み"))

    for pat in RECOMMENDED:
        f = find(docs, pat)
        results.append(("OK", f"{f.name}: 存在") if f else ("警告", f"{pat}*.md が見当たらない"))

    # 2) 未確定・仮マークの残数(課題管理表・継続メモ以外)
    count, locs = 0, []
    for f in docs.rglob("*.md"):
        if "課題管理" in f.name or "wip" in f.parts or "scout" in f.parts:
            continue
        for ln, line in enumerate(f.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
            for mark in ("【未確定】", "【仮】", "【記入】", "【要件未確定】"):
                if mark in line:
                    count += 1
                    if len(locs) < 5:
                        locs.append(f"{f.name}:{ln} {mark}")
    if count:
        results.append(("NG", f"未確定/仮マークが本文に {count}件 残存(例: {'; '.join(locs)})"
                              " → 決定するか課題管理表へ移すこと"))
        ok = False
    else:
        results.append(("OK", "未確定/仮マークの残存なし"))

    # 3) トレーサビリティ(別スクリプトに委譲)
    r = subprocess.run([sys.executable, str(TOOLS / "check_traceability.py"), str(docs)],
                       capture_output=True, text=True)
    if r.returncode == 0:
        results.append(("OK", "トレーサビリティ: 未定義参照なし"))
    else:
        results.append(("NG", "トレーサビリティ: 未定義参照あり(詳細: check_traceability.py を単体実行)"))
        ok = False

    # 4) Mermaid構文(別スクリプトに委譲)
    r = subprocess.run([sys.executable, str(TOOLS / "validate_mermaid.py"), str(docs)],
                       capture_output=True, text=True)
    tag = "OK" if r.returncode == 0 else "NG"
    line = (r.stdout or "").strip().splitlines()
    results.append((tag, f"Mermaid: {line[-1] if line else '不明'}"))
    if r.returncode != 0:
        ok = False

    # 5) 人間チェック項目のリマインド(機械判定不能)
    human = ["MUST比率は5割以下か(POの判断)", "SPは全ストーリーでポーカー済みか",
             "3人全員が基本設計書を読んだか", "DoR/DoDにチーム合意したか"]

    print("=== 実装開始ゲート判定(機械チェック分)===")
    for tag, msg in results:
        print(f" [{tag}] {msg}")
    print("\n=== 人間が確認する項目(このスクリプトでは判定不能)===")
    for h in human:
        print(f" [ ] {h}")
    print(f"\n総合: {'通過(機械チェック分)' if ok else '不合格 — NG項目を解消してから再実行'}")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
