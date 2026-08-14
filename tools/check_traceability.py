#!/usr/bin/env python3
"""トレーサビリティ検査(AI不使用のロジック層)。

docs/ 配下のMarkdownから ID(F-xxx, US-xxx, SC-xxx, API-xxx, E-xx, T-xxx)を収集し、
  - 未定義参照: どこかで参照されているが、一覧表で定義されていないID
  - 孤児ID:     定義されているが、定義行以外のどこからも参照されていないID
を機械的に検出する。AIに表を読ませて突き合わせる必要はない。

「定義」= Markdownの表の行で、行頭セルがIDそのものである行(例: | F-001 | ... |)
「参照」= それ以外の場所での出現

使い方: python3 tools/check_traceability.py [docsディレクトリ] [--json]
終了コード: 0=問題なし / 1=未定義参照あり(孤児は警告のみ)
"""
import re, sys, json, io
from pathlib import Path
from collections import defaultdict

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
ID_RE = re.compile(r"\b(F|US|SC|API|E|T)-(\d{2,4})\b")
DEF_RE = re.compile(r"^\s*\|\s*(?:\d+\s*\|\s*)?((?:F|US|SC|API|E|T)-\d{2,4})\s*\|")
EXCLUDE_DIRS = {".state", "scout", "wip"}


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    as_json = "--json" in sys.argv
    docs = Path(args[0]) if args else Path("docs")
    if not docs.exists():
        print(f"NG: {docs} が存在しません")
        return 1

    defined = defaultdict(set)    # id -> {file:line}
    referenced = defaultdict(set)
    files = [p for p in docs.rglob("*.md")
             if not any(part in EXCLUDE_DIRS for part in p.parts)]
    for f in files:
        for ln, line in enumerate(f.read_text(encoding="utf-8", errors="replace").splitlines(), 1):
            loc = f"{f}:{ln}"
            m = DEF_RE.match(line)
            def_id = m.group(1) if m else None
            if def_id:
                defined[def_id].add(loc)
            for mm in ID_RE.finditer(line):
                _id = f"{mm.group(1)}-{mm.group(2)}"
                if _id != def_id:
                    referenced[_id].add(loc)

    undefined = {i: sorted(l) for i, l in referenced.items() if i not in defined}
    orphans = {i: sorted(l) for i, l in defined.items() if i not in referenced}
    # T-xxx(タスク)はスプリント計画書内で完結するので孤児扱いしない
    orphans = {i: l for i, l in orphans.items() if not i.startswith("T-")}

    result = {
        "files_scanned": len(files),
        "defined": {k: len([i for i in defined if i.startswith(k + "-")])
                    for k in ["F", "US", "SC", "API", "E", "T"]},
        "undefined_refs": undefined,
        "orphans": orphans,
        "ok": not undefined,
    }
    if as_json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(f"走査: {len(files)}ファイル / 定義済みID: " +
              ", ".join(f"{k}:{v}" for k, v in result["defined"].items() if v))
        if undefined:
            print(f"\nNG 未定義参照 {len(undefined)}件(定義表に無いIDが参照されている=設計漏れの疑い):")
            for i, locs in sorted(undefined.items()):
                print(f"  {i}  参照元: {locs[0]}" + (f" 他{len(locs)-1}箇所" if len(locs) > 1 else ""))
        if orphans:
            print(f"\n警告 孤児ID {len(orphans)}件(定義されているがどこからも参照されていない=迷子の疑い):")
            for i, locs in sorted(orphans.items()):
                print(f"  {i}  定義: {locs[0]}")
        if not undefined and not orphans:
            print("OK: 未定義参照・孤児IDなし")
    return 0 if result["ok"] else 1


if __name__ == "__main__":
    sys.exit(main())
