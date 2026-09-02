# Sales Mail Studio

Excel / CSVの営業リストを取り込み、顧客ごとのテキストメールを作成・確認し、Garoonから個別送信または下書き保存する営業支援Webアプリです。Cloudflare Workers、D1、Queues、Static Assetsを使い、外部の有料メール配信サービスを必須にしないMVPとして構成しています。

> 重要: 本アプリは、正当な取引関係や適切な同意に基づく営業活動のためのものです。購入リストへの無差別配信、配信停止先への送信、フィッシング、なりすまし、違法な勧誘には使用しないでください。

## 実装済み機能

- 日本語のレスポンシブ管理画面（PC固定サイドバー／スマホメニュー）
- ダッシュボード、営業リスト、メール作成・配信、テンプレート、フォロー、案件、履歴、除外リスト、メールアカウント、設定
- `.xlsx` / `.xls` / `.csv` のブラウザ内解析（最大10MB、UTF-8 / Shift_JIS CSV）
- Excel列とアプリ項目の自動・手動マッピング
- 必須項目、メール形式、メール重複、同一企業、配信停止、過去送信、数式インジェクションの検査
- 顧客13項目の差し込み、未展開変数の検知、顧客ごとのプレビュー、ランダム3件確認
- 100件を初期上限とする一括処理、確認件数の一致チェック、5/10/30/60秒の送信間隔
- モック送信、自分宛テスト、Garoon `MailSendMails`、`MailSaveDraftMails`
- Cloudflare Queueによる1宛先ずつの個別非同期処理
- 送信・下書き・失敗ログ、キャンペーン進捗、フォロー期限、簡易案件管理
- メール単位の除外リスト。サーバー側でも送信直前に再照合
- HMAC署名付きHttpOnlyセッション、SameSite Cookie、Origin検査、Zod入力検証
- D1プリペアドステートメント、全データの`user_id`分離、APIレート制限
- Garoon認証情報をlocalStorageやD1へ保存しない設計

## アーキテクチャ

```text
Browser (React / Tailwind)
  ├─ Excel / CSVをブラウザ内解析
  └─ /api/*
       ↓
Cloudflare Worker
  ├─ 認証・権限・入力検証・レート制限
  ├─ D1: 営業先、テンプレート、履歴、CRMデータ
  └─ Queue: 1メッセージ = 1宛先
       ↓
MailProvider
  ├─ MockProvider（ローカル。外部送信なし）
  └─ GaroonProvider（SOAP API）
```

送信プロバイダーは`MailProvider`インターフェースで分離されています。Gmail、Microsoft 365、SMTPは同じインターフェースへ後から追加できます。

## 技術構成

- React 19 / TypeScript / Vite 8
- Tailwind CSS 4 / Lucide Icons
- Cloudflare Workers / Static Assets / D1 / Queues / Rate Limiting binding
- Zod
- SheetJS CE 0.20.3（公式配布tarball。旧npm版0.18.5は既知脆弱性のため不使用）
- Vitest

## ディレクトリ

```text
src/                  React UI
shared/               ブラウザ・Worker共通の型、差し込み、取込検証
worker/               Workers API、認証、Garoon/Mock Provider
migrations/           D1 migrationと架空デモデータ
public/                CSVサンプル
scripts/               ローカルmigration、migration検証
tests/                 単体テスト
wrangler.jsonc         Cloudflare binding / dev・production設定
```

## 必要環境

- Node.js 22 LTS以上
- npm 10以上
- Cloudflareへ公開する場合はCloudflareアカウント
- Garoon連携する場合はクラウド版Garoonの利用権限とメールアカウント

## ローカル起動

### 1. インストール

```powershell
npm install
```

### 2. ローカルDBを作成

```powershell
npm run db:migrate:local
```

同期フォルダーやネットワークドライブではSQLiteのローカル状態作成が失敗する場合があるため、このプロジェクトは既定でOSの一時領域にD1状態を保存します。保存先を固定したい場合は、同じPowerShellで次を実行してからmigrationとdevを起動します。

```powershell
$env:SALES_MAIL_STUDIO_STATE_PATH = "$env:LOCALAPPDATA\SalesMailStudio\state"
npm run db:migrate:local
npm run dev
```

### 3. 必要な場合だけローカルSecretsを作成

モックで画面を確認するだけなら、開発用フォールバック認証があるため`.dev.vars`は不要です。Garoon接続テストなどで環境変数を使う場合だけ作成します。

```powershell
Copy-Item .dev.vars.example .dev.vars
```

`.dev.vars`には実値を設定し、Gitへコミットしないでください。本番ビルド・配布前にはローカル用`.dev.vars`を成果物へコピーしないでください。

### 4. 起動

```powershell
npm run dev
```

ブラウザで `http://localhost:5173` を開きます。

ローカルデモ認証:

- メール: `sales@example.com`
- パスワード: `demo-pass`

ローカルでは`MAIL_PROVIDER=mock`です。テスト送信や一括配信を実行しても外部へメールを送りません。

サンプル: `public/sample-sales-list.csv`

## テストと検証

```powershell
npm test
node scripts/validate-migration.mjs
npm audit
npm run build
npm run deploy:dry
```

テスト対象には、CSV、XLSX、XLS、メール形式、重複・除外・同一企業・過去送信、数式無害化、差し込み、未展開変数、Garoon SOAP XMLが含まれます。実メールは送信しません。

## Cloudflareへ公開する手順

### 1. ログイン

```powershell
npx wrangler login
```

### 2. D1を作成

```powershell
npx wrangler d1 create sales-mail-studio-db
```

表示された`database_id`を、`wrangler.jsonc`内の2か所（ルートと`env.production`）にあるゼロ埋めIDへ設定します。

### 3. QueueとDLQを作成

```powershell
npx wrangler queues create sales-mail-studio-mail
npx wrangler queues create sales-mail-studio-mail-dlq
```

`API_RATE_LIMITER`の`namespace_id`はCloudflareアカウント内で一意の正整数文字列です。既存のRate Limiting bindingと重複する場合は、`wrangler.jsonc`のルートとproductionを同じ別番号へ変更してください。

### 4. 型を再生成

```powershell
npm run cf-typegen
```

### 5. 本番Secretsを登録

各コマンドを実行すると値の入力を求められます。値はソースコードや`wrangler.jsonc`へ直接書かないでください。

```powershell
npx wrangler secret put SESSION_SECRET --env production
npx wrangler secret put APP_PASSWORD --env production
npx wrangler secret put DEMO_USER_EMAIL --env production
npx wrangler secret put GAROON_BASE_URL --env production
npx wrangler secret put GAROON_USERNAME --env production
npx wrangler secret put GAROON_PASSWORD --env production
npx wrangler secret put GAROON_ACCOUNT_ID --env production
```

Cloudflare Access等でBasic認証が必要な環境のみ追加します。

```powershell
npx wrangler secret put GAROON_BASIC_USERNAME --env production
npx wrangler secret put GAROON_BASIC_PASSWORD --env production
```

`SESSION_SECRET`は最低32文字のランダム値、`APP_PASSWORD`は推測困難な値にしてください。`DEMO_USER_EMAIL`は実運用管理者のログインメールへ変更します。

### 6. 本番DBへmigration

```powershell
npm run db:migrate:remote
```

このコマンドは本番D1へ書き込むため、`database_id`を再確認してから実行してください。

### 7. dry-runとデプロイ

```powershell
npm run deploy:dry
npm run deploy
```

`deploy`はビルド時に`CLOUDFLARE_ENV=production`を設定し、production環境を選択します。Cloudflare Vite Pluginではデプロイ時の`--env`ではなくビルド時の環境選択が必要です。Cloudflareが表示した`workers.dev` URL、または設定したカスタムドメインへアクセスします。

## Garoon設定

このMVPはクラウド版Garoon（`https://<subdomain>.cybozu.com/`）だけを許可します。URLはHTTPS必須で、任意ホストへのSOAP転送はできません。

必要な値:

- Garoon URL: `https://xxxxx.cybozu.com/`
- Garoonログイン名
- Garoonパスワード
- 利用するメールアカウントID
- 必要な場合のみBasic認証情報

画面の「メールアカウント」では接続テストを行えます。フォームへ入力した認証情報はWorkerへのそのリクエストだけに使用し、ブラウザのlocalStorageやD1には保存しません。継続的な送信処理はCloudflare Secretsに登録した値を使用します。

実装仕様:

- 接続確認: `BaseGetApplicationStatus`
- 即時送信: `MailSendMails`
- 下書き保存: `MailSaveDraftMails`
- endpoint: `/g/cbpapi/base/api.csp`、`/g/cbpapi/mail/api.csp`
- SOAP 1.2 envelope、`Content-Type: text/xml; charset=UTF-8`
- WS-Security UsernameToken、任意のHTTP Basic認証
- テキストメールのみ

公式仕様:

- [Garoon SOAP API共通仕様](https://cybozu.dev/ja/garoon/docs/soap-api/overview/soap/)
- [メールを送信／下書き保存する](https://cybozu.dev/ja/garoon/docs/soap-api/mail/operate-mail/)
- [メールデータの構造](https://cybozu.dev/ja/garoon/docs/soap-api/mail/api-data-structure/)
- [メールアカウントを取得する](https://cybozu.dev/ja/garoon/docs/soap-api/mail/operate-account/)

### Garoon認証上の制約

現在の実装はWS-Security方式です。Garoon公式仕様では、高頻度実行にはCookie認証が推奨され、2要素認証を有効にしたcybozu.comユーザーはWS-Securityを利用できません。その場合は、API専用の運用方針を組織管理者・セキュリティ担当と合意するか、Phase 2で別認証方式を実装してください。2要素認証を回避する運用は行わないでください。

## DB構造

| テーブル | 用途 |
|---|---|
| `users` | 利用者・テナント境界 |
| `mail_accounts` | プロバイダーの非機密メタデータ |
| `contacts` | 営業先 |
| `custom_fields` | カスタム項目定義 |
| `contact_custom_values` | カスタム値 |
| `templates` | 件名・本文・署名テンプレート |
| `campaigns` | 一括送信単位と集計 |
| `campaign_contacts` | キャンペーン対象 |
| `mail_logs` | 1通単位の結果・本文・エラー |
| `unsubscribes` | 配信禁止メール |
| `followups` | 次回対応 |
| `deals` | 簡易案件 |
| `settings` | 利用者別設定 |

全業務テーブルは`user_id`で分離し、主要検索列へINDEXを設定しています。SQLはD1のbindを使い、入力文字列をSQLへ連結しません。

## セキュリティと誤送信防止

- 認証CookieはHttpOnly / SameSite=Lax。本番はSecure
- 更新APIは同一OriginとJSON Content-Typeを検査
- 変更APIはCloudflare Rate Limiting bindingで利用者・パス単位に毎分60回
- サーバー入力はZodでサイズと型を制限
- Garoon URLはHTTPSの`*.cybozu.com`だけを許可し、SSRFを抑止
- 認証情報はCloudflare Secrets。D1、localStorage、ログへ保存しない
- 一括送信は初期100件上限。対象件数の再確認と未展開変数のブロックあり
- Queueは1宛先ずつ処理し、失敗時は二重送信を避けるため自動再送を閉じる
- 配信停止をUIとWorkerの双方で照合
- Excelセルの先頭`= + - @`を文字列化
- Reactの通常レンダリングを使い、メール本文を`dangerouslySetInnerHTML`へ渡さない
- ログへパスワードやCookieを出さない

本番公開時は、Cloudflare Access、組織のSSO、Turnstile、監査ログ、データ保持期間、個人情報保護方針も合わせて設計してください。MVPの単一パスワード認証を不特定多数向けSaaSでそのまま利用しないでください。

## 無料枠について

外部の有料メール配信サービスは使用しません。Workers、D1、Queuesの無料枠内で小規模利用を始められる構成ですが、上限と価格は変更されるため公開前に公式ページを確認してください。

- [Workers Limits](https://developers.cloudflare.com/workers/platform/limits/)
- [D1 Pricing](https://developers.cloudflare.com/d1/platform/pricing/)
- [Queues Pricing](https://developers.cloudflare.com/queues/platform/pricing/)
- [Rate Limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)

送信1通につきQueue操作とD1読み書きが発生します。無料枠は大量配信の許可を意味しません。Garoon側のAPI制限、社内規程、特定電子メール法等の適用可否を確認し、少数から運用してください。

## トラブルシューティング

### `npm run db:migrate:local`でSQLite internal error

同期フォルダー上のロック問題が考えられます。`SALES_MAIL_STUDIO_STATE_PATH`をローカルディスクへ設定し、migrationとdevを同じシェルで再実行してください。

### ログインできない

- ローカル: `sales@example.com` / `demo-pass`
- 本番: `DEMO_USER_EMAIL`と`APP_PASSWORD`のproduction Secretを再確認
- Secret変更後は再デプロイし、古いCookieを削除して再ログイン

### D1テーブルがない

ローカルは`npm run db:migrate:local`、本番は`npm run db:migrate:remote`を実行します。本番では`wrangler.jsonc`の`database_id`を先に確認してください。

### Queueが見つからない

producerとconsumerの両方が参照する` sales-mail-studio-mail `とDLQを作成し、production環境へデプロイしてください。Cloudflare DashboardのQueue名も確認します。

### Garoon接続に失敗する

- URLが`https://<subdomain>.cybozu.com/`か
- ログイン名・パスワード・メールアカウントIDが正しいか
- ユーザーがGaroonメールを利用できるか
- Basic認証やIP制限が必要か
- 2要素認証ユーザーでWS-Securityを使おうとしていないか
- Cloudflare WorkersからGaroonへ到達できるネットワーク設定か

### buildに`.dev.vars`が含まれる

ローカル用`.dev.vars`を削除して`dist`を作り直します。`.gitignore`済みでも、配布物へ含めないことを必ず確認してください。

## Phase 2候補

- Google / Microsoft OAuthとマルチユーザー認証
- CookieベースのGaroonセッション方式を含む認証拡張
- SMTP（Workers TCP socketsまたは各社REST APIを比較して実装）
- 送信予約 / Cron
- 添付ファイルとサイズ・MIME検証
- 公開`/unsubscribe/:token`
- カスタム項目・ステータス・ランクの編集UI
- AIメール生成（任意、BYOKまたはWorkers AI）
- CRMカンバン、返信分析、監査ログ

## 運用前チェックリスト

- [ ] D1 ID、Queue、Rate Limiter namespaceを本番値に設定
- [ ] すべてのproduction Secretsを登録
- [ ] `.dev.vars`や実認証情報が配布物・Gitにない
- [ ] `npm audit`、`npm test`、`npm run build`、`npm run deploy:dry`が成功
- [ ] Garoonの接続テストと自分宛テストが成功
- [ ] 1件の下書き保存で件名・本文・宛先を目視確認
- [ ] 除外リストと送信上限を確認
- [ ] 組織のメール送信・個人情報・ログ保持方針を確認
- [ ] 少数の承認済み対象から開始
