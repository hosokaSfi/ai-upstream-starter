#!/usr/bin/env python3
"""PostToolUse hook: docs/配下のMarkdownが編集されたら自動で整合チェックを走らせる。

Claude Codeのhooksから呼ばれる。stdinにツール実行情報(JSON)が渡される。
docs/ 以外の編集や、チェックOKのときは何もしない(exit 0)。
NGのときは exit 2 で stderr に要約を返す → Claudeが即座に気づいて修正できる。
「チェックし忘れ」を構造的になくすための決定論的ゲート。
"""
import json, sys, subprocess, io
from pathlib import Path

sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8")
TOOLS = Path(__file__).resolve().parent


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0
    path = (payload.get("tool_input") or {}).get("file_path", "")
    if "/docs/" not in path.replace("\\", "/") and not path.replace("\\", "/").startswith("docs/"):
        return 0
    if not path.endswith(".md") or "/wip/" in path or "/scout/" in path:
        return 0

    r = subprocess.run([sys.executable, str(TOOLS / "check_traceability.py"), "docs"],
                       capture_output=True, text=True)
    if r.returncode == 0:
        return 0
    # NG要約のみをClaudeへ返す(全文は返さない=コンテキスト節約)
    lines = [l for l in r.stdout.splitlines() if l.startswith(("NG", "  "))][:12]
    print("docs編集後の自動整合チェックNG(check_traceability.py):", file=sys.stderr)
    print("\n".join(lines), file=sys.stderr)
    print("→ 未定義IDの定義追加 or 参照の修正をしてから先に進むこと。", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
