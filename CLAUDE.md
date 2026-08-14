# プロジェクト設定(AIへの地図)

<!-- 中身は書きすぎない。「在り処」と「絶対ルール」だけ。詳細は各ドキュメントへ -->

## プロジェクト
- プロジェクト名: 【記入】(サンプルで試す場合: LessonHub — docs/input/ストーリーメモ.md 参照)
- チーム: 3名 / 2週間スプリント / 見積りはSP+ベロシティ
- 技術スタック: 【記入 or 要件定義・アーキ設計で決める】

## 在り処
- 憲法(最上位ルール): docs/00_プロジェクト憲法.md ※存在すれば必ず従う
- ドキュメント正本: docs/ 配下(番号順)。ひな形: templates/
- バックログ正本: GitHub Issues(俯瞰: docs/backlog/product_backlog.md)
- 課題: docs/issues/課題管理表.md / 変更提案: docs/changes/
- 進行状態: `python3 tools/pipeline.py status`

## 絶対ルール
- 調査は code-scout / doc-scout サブエージェントに委任。成果物は docs/ に保存しチャットに全文を出さない
- 機械的な検証・計算(ID整合・納期計算・Mermaid検証)は tools/ のスクリプトを使う。暗算しない
- 新しい要望・仕様変更は即実装せず /change(変更提案書)の手順に乗せる
- 迷ったら /go
