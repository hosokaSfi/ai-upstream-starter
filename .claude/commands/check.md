---
description: ロジックチェック一括実行(整合・Mermaid・ゲート判定。AIは結果の解釈のみ)
argument-hint: [gate | trace | mermaid | 省略で全部]
---

ドキュメントの機械チェックを実行してください。指定: $ARGUMENTS

実行するもの(自分で表を突き合わせたりせず、スクリプトの出力だけを読むこと):

- trace 指定 or 省略: `python3 tools/check_traceability.py docs`
- mermaid 指定 or 省略: `python3 tools/validate_mermaid.py docs`
- gate 指定 or 省略: `python3 tools/check_gate.py docs`

結果の報告フォーマット:
1. 各チェックの OK/NG と件数(1行ずつ)
2. NGがある場合: 修正方針の提案(どのドキュメントの§をどう直すか)。
   修正対象の特定に既存ドキュメントの内容確認が必要なら doc-scout に委任する
3. 「人間が確認する項目」はそのまま列挙してチームに委ねる

NGの修正を指示されたら、修正→該当スクリプトを再実行→OKになるまで繰り返す(最大3周。
3周で解消しない場合は原因の仮説と選択肢を出して人間の判断を仰ぐ)。
