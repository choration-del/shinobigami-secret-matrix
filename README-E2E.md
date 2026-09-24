# ブラウザE2E環境

リポジトリのルートで実行します。Node.jsとnpmが必要です。

## 初回準備

~~~powershell
npm ci
npm run test:install
~~~

## コマンド

| コマンド | 用途 |
| --- | --- |
| npm test | Chromiumで正式版表示とv8操作の環境確認2件 |
| npm run test:headed | 同じ2件を画面表示して実行 |
| npm run test:debug | Playwright Inspectorでステップ実行 |
| npm run test:ui | テスト選択・再実行UI |
| npm run test:video | 動画も保存して環境確認 |
| npm run test:v8 | 既存v8回帰・バグ調査テスト |
| npm run test:all | 環境確認と既存v8テスト |
| npm run test:examples | 保存してある外部Playwrightサイトのサンプル |
| npm run test:report | HTMLレポートを開く |
| npm run test:trace -- "trace.zipのパス" | 保存traceを開く |
| npm start | 手動操作用サーバーを起動 |

例えば npm run test:headed -- tests/environment.spec.js で操作テストのみ実行できます。
既存v8のデバッグは npm run test:v8 -- --debug -g "テスト名"。
直接 npx playwright test を実行すると外部サイトのサンプルも含め全プロジェクトが対象になるため、通常はnpm scriptsを使います。

## localhost

http://127.0.0.1:4173/シノビガミ秘密管理_v8_test.html

PlaywrightのwebServerがサーバーを自動起動します。ローカルでは起動済みサーバーを再利用し、CIでは再利用しません。手動サーバーはCtrl+Cで終了します。4173番が別アプリで使用されている場合は解消してから実行してください。
サーバーはループバックにのみバインドし、3つのHTMLのみ配信します。

## 記録と調査

- 失敗時スクリーンショット: test-results/e2e/<テスト名>/test-failed-1.png
- 失敗時trace: test-results/e2e/<テスト名>/trace.zip
- 動画指定時: test-results/e2e/<テスト名>/*.webm
- HTMLレポート: playwright-report/index.html
- console error / warning / page error: レポートのbrowser-log添付(JSON)。errorは端末にも表示しテストを失敗させます。
- 成功時も操作テストはCanvas画像canvas-afterをレポートに添付します。

テスト開始時に出力先は更新されます。残したい結果は次の実行前にコピーしてください。ブラウザ起動前の失敗には画面がないためスクリーンショットや動画は生成されません。
traceはリトライしないローカル実行でも失敗時に保存します。

## Canvasと今後の開発

viewportは1280×900に固定。tests/helpers/canvas.jsがv8のlastLayout、secretDataの列幅、行高、実際のCanvas描画サイズと表示サイズから座標を求めます。スクロール後に位置を再取得し、Playwrightのmouseでクリック・ドラッグします。固定列幅の重複定義はありません。
アプリ内の既存グローバル変数を読み取るためHTMLの変更は不要です。将来描画処理をモジュール化する場合は、このヘルパーの読み取り部分を公開された読み取り専用の状態APIへ移してください。
各テストは独立したBrowserContextを使うため通常ブラウザの保存データを変更しません。

機能修正時はhelpers/fixturesからtestとexpectを読み込み、DOMの入力・ボタン操作を優先し、Canvas操作はhelpers/canvasを利用してください。操作後はlocalStorageの状態だけでなく表示も検証してください。失敗時はbrowser-log、画面、traceを確認してから修正し、対象テストを再実行します。
正式版HTMLを変更する場合は別途その変更が依頼されていることを確認してください。

## 今回の確認結果 (2026-09-24)

通常実行・headed実行とも環境確認2件が成功しました。正式版の表示と、localhost上のv8で入力・Canvasクリック・ヘッダードラッグ・再読み込みを確認しています。操作後のCanvas画像も確認済みです。ブラウザのconsole error / page errorは検出されませんでした。

### spawn EPERMの原因と対処

Node.jsの子プロセスは起動できる一方、AppData/Local/ms-playwright配下のChromium起動とACL参照が拒否されていました。Codexのrequest_permissionsでブラウザ保存先と実体ディレクトリへのアクセスを許可すると、同じインストール済みChromiumが起動してテストが成功しました。アプリHTMLやブラウザの再インストールは不要でした。観測結果はCodex実行環境のファイルアクセス制限が原因であることを示します。

今回の権限はターン単位です。今後Codexから実行するときに同じエラーが出た場合は、リポジトリの書き込みに加えて、Playwrightのブラウザ保存先（通常 C:/Users/chora/AppData/Local/ms-playwright）と対象バージョンの実体ディレクトリへの権限をrequest_permissionsで取得してから再実行してください。バージョン更新で実体ディレクトリ名は変わります。全端末で恒久的に起動制限を変更したわけではありません。

Playwrightの自動サーバー起動はnode scripts/serve.cjsを直接実行する設定にしました。npm経由の余分な親プロセスを避けます。手動起動は引き続きnpm startです。さらにscripts/stop-server.cjsが実行ごとのランダムトークンで自分が起動したサーバーだけを停止し、Windows環境での終了待ちを防ぎます。再利用した手動サーバーは停止しません。

正式版HTMLとv8 HTMLのSHA256は構築前と一致しています。GitHubへのpushは行っていません。

最終確認: npm run test:video -- --headed --trace on は 2 passed (12.3s)、終了コード0。trace ZIPとWebM動画の生成を確認しました。npm testも2件成功・終了コード0を確認しています。

## 正式版への反映（2026-09-24）

デバッグ済みv8を正式版HTMLへ反映しました。上記の「正式版未変更」は環境構築時点の記録です。現在の公開入口index.htmlは更新された正式版を開きます。開発用v8とE2Eテストも保持しています。CIはnpm run test:allで実行します。
