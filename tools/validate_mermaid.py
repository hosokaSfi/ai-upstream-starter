#!/usr/bin/env python3
"""Mermaid図の構文検証(AI不使用のロジック層)。

docs/ 配下のMarkdownから ```mermaid ブロックを抽出し、mermaid-cli(mmdc)でレンダリング検証する。
mmdc が無い環境では簡易チェック(ブロックの開始キーワード確認)のみ行う。

使い方: python3 tools/validate_mermaid.py [対象ディレクトリ=docs]
終了コード: 0=全てOK / 1=エラーあり
"""
import re, sys, subprocess, tempfile, shutil, json, io
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
KNOWN = ("flowchart", "graph", "sequenceDiagram", "erDiagram", "gantt",
         "classDiagram", "stateDiagram", "xychart-beta", "pie", "journey", "timeline")


def main():
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("docs")
    blocks = []
    for f in sorted(target.rglob("*.md")):
        text = f.read_text(encoding="utf-8", errors="replace")
        for i, m in enumerate(re.finditer(r"```mermaid\n(.*?)```", text, re.S)):
            blocks.append((f, i, m.group(1)))
    if not blocks:
        print("mermaidブロックなし")
        return 0

    mmdc = shutil.which("mmdc")
    fails = 0
    tmp = Path(tempfile.mkdtemp())
    pptr = tmp / "pptr.json"
    # CI/コンテナ環境向け設定。ブラウザの場所は環境変数でも指定可能
    conf = {"args": ["--no-sandbox"]}
    import os
    chrome = os.environ.get("MERMAID_CHROME") or os.environ.get("PUPPETEER_EXECUTABLE_PATH")
    if not chrome:
        for cand in ("/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell",):
            if Path(cand).exists():
                chrome = cand
    if chrome:
        conf["executablePath"] = chrome
    pptr.write_text(json.dumps(conf), encoding="utf-8")

    render_ok = bool(mmdc)
    for f, i, src in blocks:
        first = next((l.strip() for l in src.splitlines() if l.strip()), "")
        if not first.startswith(KNOWN):
            print(f"NG {f}#{i+1}: 未知の図タイプ「{first[:40]}」")
            fails += 1
            continue
        if render_ok:
            mmd = tmp / f"b{len(list(tmp.glob('*.mmd')))}.mmd"
            mmd.write_text(src, encoding="utf-8")
            r = subprocess.run(
                [mmdc, "-p", str(pptr), "-i", str(mmd), "-o", str(mmd.with_suffix(".svg"))],
                capture_output=True, text=True)
            if r.returncode != 0:
                err = (r.stderr or r.stdout).strip()
                if "Could not find Chrome" in err or "Could not find browser" in err:
                    # 環境問題(構文エラーではない)→ 簡易検証モードに切替
                    render_ok = False
                    print("警告: mmdcのブラウザが見つからないため簡易検証に切替"
                          "(環境変数 MERMAID_CHROME にChrome/Chromiumのパスを設定すると復帰)")
                    continue
                lines = err.splitlines()
                print(f"NG {f}#{i+1}: " + (lines[0] if lines else "レンダリング失敗"))
                fails += 1
    mode = ("mmdcレンダリング検証" if render_ok
            else "簡易検証のみ" + ("" if mmdc else "(mmdc未インストール: npm i -g @mermaid-js/mermaid-cli)"))
    print(f"{'NG' if fails else 'OK'}: {len(blocks)}ブロック中 {fails}件エラー({mode})")
    shutil.rmtree(tmp, ignore_errors=True)
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
