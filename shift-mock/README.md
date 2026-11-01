# シフト管理・部屋管理システム 操作モック

複数店舗を運営するサービス業(スタッフ約145名・管理者約20名)向け「シフト管理・部屋管理Webシステム」の、**触って動くモック**です。
バックエンドはなく、ダミーデータはブラウザ内で生成し、操作結果はその端末の localStorage に保存されます。

- Next.js 16(App Router)/ TypeScript / Tailwind CSS v4 / shadcn/ui 互換コンポーネント(Radix UI)
- 状態管理: Zustand + persist(localStorage)
- ドラッグ操作: dnd-kit / Excel・CSV: SheetJS(xlsx)
- PWA 対応(manifest・アイコン・Service Worker。ホーム画面に追加するとアプリ風に起動)

## 動かし方

```bash
cd shift-mock
npm install
npm run dev        # http://localhost:3000
npm run build      # 本番ビルド
npm run lint       # ESLint
npm test           # 自動仮組み・スコア計算の単体テスト(Vitest)
```

### Vercel へのデプロイ

1. Vercel で GitHub リポジトリをインポート
2. **Root Directory に `shift-mock` を指定**(Framework は Next.js が自動選択されます)
3. そのまま Deploy。環境変数は不要です

> データは端末ごとの localStorage に保存されます。デモ前に右上メニューの「デモデータを初期化」で初期状態に戻せます。

## 画面一覧

| 役割 | パス | 画面 |
|---|---|---|
| 共通 | `/` | ログイン(スタッフ / 管理者 / オーナーの3ボタン) |
| スタッフ | `/staff` | ホーム(ログイン時お知らせ・申し送り・罰金残金・次回シフト) |
| | `/staff/requests` | シフト希望提出(月カレンダー×時間帯、期限カウントダウン、期限後ロック) |
| | `/staff/shifts` | 確定シフト / 空き枠(早い者順で取得) |
| | `/staff/report` | 入退室報告(撮影テンプレート+備品・清掃チェック) |
| | `/staff/absence` | 急な休みの報告 |
| 管理者 | `/admin` | 配置ボード(初期画面)・自動仮組み・空き枠公開 |
| | `/admin/staff` | スタッフ一覧(スコア・期間タブ・並べ替え・検索・アラート) |
| | `/admin/score` | スコア設定(比重スライダーで即時再計算) |
| | `/admin/alerts` | アラート設定(スタッフ個別の閾値) |
| | `/admin/rooms` | 部屋管理(エリア・部屋・チェック項目・撮影箇所/枚数) |
| | `/admin/roster` | 名簿管理(ブランド別名義、Excel/CSV 一括登録) |
| | `/admin/requests` | シフト希望の集計(ヒートマップ・未提出者) |
| | `/admin/reports` | 入退室報告の確認(写真・チェック結果) |
| | `/admin/notices` | お知らせ・申し送り・罰金 |
| | `/admin/sheets` | Google スプレッドシート連携(プレビュー+CSV) |
| オーナー | `/owner/admins` | 管理者アカウントの発行・停止・画面単位の権限 |
| | `/owner/logs` | 操作履歴(モック内の操作を実際に記録) |
| | `/owner/settings` | 店舗ごとの設定・セッションタイムアウト(表示のみ) |

データモデルと設計メモ: [`docs/設計メモ_データモデルと画面一覧.md`](docs/設計メモ_データモデルと画面一覧.md)(型の正本は `lib/types.ts`)

---

## デモの進め方(5分程度の台本)

事前準備: PC のブラウザで開き、右上メニュー →「デモデータを初期化」。スマホ表示を見せる場合は、開発者ツールのデバイス表示(iPhone 幅)を用意しておくか、実機で URL を開いておく。

**0:00 ログイン(20秒)**
- 「認証は本番で実装します。今日は役割を選ぶだけで入れます」→ **管理者として入る**
- ヘッダーの店舗セレクタで3店舗を切り替えられることを見せ、中央店に戻す

**0:20 配置ボード(1分30秒)**
- 縦が部屋(エリアごと)、横が時間。チップの色はスコア帯(緑=8以上 … 赤=4未満)
- 上部の赤い帯:「スタッフから急な休み報告が来るとここに出ます」→ 該当チップにも警告マーク
- 左の「出勤希望」から1人を部屋の空き時間へ **ドラッグして配置**。配置済みのチップを別の部屋へ **ドラッグで移動**、左の一覧へ戻すと **外せる**。チップをタップすると時間変更
- 右上の **全画面表示** ボタンで会議室のモニター向け表示を見せる

**1:50 自動仮組み(1分)**
- 日付を「>」で4日後へ(まだ配置が空の日)→ **自動仮組み**
- 「固定部屋の人を最優先 → エリアごと → スコアの高い順 → 同じ部屋の入れ替えは30分空ける、の順で仮に組みます」
- 斜線+「仮」の表示が仮配置。気になる所だけドラッグで直して **確定** → 通常表示になる

**2:50 スタッフ側(1分20秒)** ※スマホ幅で
- 右上メニュー → ログアウト → **スタッフとして入る** → ログイン時お知らせのポップアップ →「確認しました」
- ホーム: ヘッダーに **罰金残金を常時表示**、個別の申し送り(タップで既読)、次回シフト
- 「希望提出」: 提出期限までのカウントダウン。日付をタップして早番/中番/遅番を選び **提出**。「デモ: 期限切れ表示」を ON にするとロックされる
- 「シフト」→「空き枠」タブ → **取得する**。「早い者順なので、取った瞬間にほかの人の一覧から消えます」
  - ホーム下部の「デモ用: 表示するスタッフを切り替え」で別のスタッフにすると、取った枠が消えていることを確認できる
- 「入退室」: 撮影テンプレートに沿って1枚ずつ撮影(スマホではカメラが起動)。PC では「デモ: ダミー写真で埋める」→ チェックを付けて送信

**4:10 管理者側の確認・設定(40秒)**
- 管理者で入り直し →「入退室報告の確認」で今送った写真とチェック結果が見える
- 「スコア設定」で当日欠勤の比重を上げる → 分布が変わる →「スタッフ一覧」でスコアが再計算されている。期間タブ(1か月/半年/1年)・アラートバッジ

**4:50 オーナー(10秒〜)**
- **オーナーとして入る** →「操作履歴」に、今のデモ操作(配置・仮組み確定・空き枠取得・報告など)が誰が・いつ・何をで記録されている
- 時間があれば「管理者・権限」(画面単位のチェックボックス)、「店舗設定」(店舗ごとに営業時間・刻み・提出期限を変更)

---

## 本番化で Firebase に置き換える箇所

画面は `lib/repositories` のインターフェースと `lib/hooks.ts` の読み取りフックだけに依存しています。置き換えは主にこの2か所です。

| 現在(モック) | 置き換え先(本番) | 該当ファイル |
|---|---|---|
| 役割ボタンでログイン(`repo.auth.login`) | Firebase Authentication(メール/パスワード等)+ カスタムクレームで role・店舗・権限を付与 | `app/page.tsx`, `lib/repositories/mock.ts` の `auth`, `components/role-guard.tsx`, `components/permission-gate.tsx` |
| Zustand + localStorage への書き込み | Firestore への書き込み(`Repositories` を実装した `firestore.ts` を作り、`lib/repositories/index.ts` の1行を差し替え) | `lib/repositories/types.ts`(インターフェース), `mock.ts`(参考実装) |
| ストアからの読み取り(`useData`) | Firestore の購読(`onSnapshot`)。店舗IDと日付で絞るクエリにする | `lib/hooks.ts`, `lib/store.ts` |
| ダミーデータ生成(シード固定) | 初期データ投入スクリプト / 既存名簿の一括取込 | `mock/` 一式, `components/data-provider.tsx` |
| 過去1年の勤怠記録をメモリ生成 | Firestore の勤怠コレクション。集計は Cloud Functions で日次バッチ(スタッフ×期間の集計値を保存) | `mock/attendance.ts`, `lib/stats.ts`, `lib/metrics.ts` |
| 空き枠の早い者順(単純な書き換え) | **Firestore トランザクション**で `takenBy` が空のときだけ取得(同時押し対策) | `repo.openSlots.take` |
| 写真を縮小して dataURL で保存 | Cloud Storage にアップロードし、パスを `RoomReport.photos` に保存。セキュリティルールで本人と管理者のみ閲覧 | `lib/image.ts`, `app/staff/report/page.tsx` |
| 操作ログを画面操作時に追記 | Cloud Functions(Firestore トリガー)でサーバー側記録。改ざん不可にする | `mock.ts` の `log()` |
| リマインド送信(ログのみ) | FCM プッシュ通知 / メール送信(Cloud Functions) | `repo.comms.sendReminder` |
| スプレッドシート連携(プレビュー+CSV) | Cloud Functions から Google Sheets API(サービスアカウント)で書き出し/読み取り | `app/admin/sheets/page.tsx`, `repo.sheets` |
| セッションタイムアウト(表示のみ) | Auth のトークン有効期限 + 無操作検知でサインアウト | `app/owner/settings/page.tsx` |
| 店舗設定(localStorage) | `stores/{storeId}` ドキュメント。将来の店舗追加は同じ構造で増やすだけ | `lib/types.ts` の `StoreSettings` |

そのまま本番でも使える部分:

- `lib/autoAssign.ts`(自動仮組み)、`lib/score.ts` / `lib/stats.ts`(スコア計算)は UI・保存先に依存しない純粋関数です。テストは `tests/`。データ量が増えたら Cloud Functions 側で同じ関数を動かせます
- 画面・コンポーネント一式

Firestore のコレクション案: `stores`, `areas`, `rooms`, `staff`(サブコレクション `aliases` でも可), `admins`, `shiftRequests`(`{staffId}_{month}`), `assignments`(店舗×日付で検索), `openSlots`, `absences`, `roomReports`, `notices`, `handovers`, `fines`, `finePayments`, `settings/score`, `alertSettings`, `logs`。

## やっていないこと(モックの範囲外)

- 本物の認証、Firebase 接続、Google API 接続
- 外部予約システムや HP との連携(本番で可否調査予定)

## 補足

- 名前・名義はすべて架空です。
- `xlsx` は npm 版(0.18.5)を使っています。既知の脆弱性があるため、本番では SheetJS 公式 CDN 配布の最新版に差し替えてください。
- 「今日」は端末の日付です。ダミーデータは初回起動日(またはデモデータ初期化日)を基準に作られます。
