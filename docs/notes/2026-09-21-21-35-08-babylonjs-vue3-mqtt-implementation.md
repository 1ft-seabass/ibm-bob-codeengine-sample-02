---
tags: [babylon-js, vue3, bootstrap5, mqtt, hono, code-engine]
---

> **⚠️ 機密情報保護ルール**
>
> このノートに記載する情報について:
> - API キー・パスワード・トークンは必ずプレースホルダー(`YOUR_API_KEY`等)で記載
> - 実際の機密情報は絶対に含めない
> - .env や設定ファイルの内容をそのまま転記しない

**作成日**: 2026-09-21
**関連タスク**: tmp/BABYLONJS_FRONTEND_TASK.md（Phase 2: Babylon.js フロントエンド + MQTT バックエンド）

## 問題

前セッションで構築した Hono サーバー（`/api/hello` のみ）と静的 HTML（挨拶文のみ）に、Babylon.js 3D フロントエンドと MQTT LED 制御バックエンドを追加する必要があった。

## 実装内容

### バックエンド（`server.js`）

**追加した依存パッケージ**:
- `mqtt` — Node.js MQTT クライアント
- `dotenv` — ローカル用 `.env` 読み込み

**MQTT クライアント設計**:
- サーバー起動時に接続を開始（環境変数 `MQTT_HOST` / `MQTT_PORT` / `MQTT_PROTOCOL` が揃っている場合のみ）
- 未設定時はワーニングログを出力してスキップ → サーバーは正常起動する
- `client.on('error', ...)` を必ず登録（未登録だと Node.js 未処理例外でクラッシュするため）
- 接続確立時に `codeengine/connected` トピックへ `{"type":"connected"}` を publish
- `SIGTERM` 受信時に `client.end()` でクリーンシャットダウン

**接続 URL の組み立て**:
```
${MQTT_PROTOCOL}://${MQTT_HOST}:${MQTT_PORT}
```
`MQTT_PROTOCOL` に `mqtts`（生MQTT over TLS）または `wss`（WebSocket over TLS）を入れ替えるだけでブローカー種別に対応できる。

**publish のタイムアウト設計**:
- `client.connected === false` の場合は即座に `{ ok: false, error: 'mqtt not connected' }` を返す
- `client.publish()` コールバックに 5 秒タイムアウトを設定 → ブローカー未応答時もハングしない
- QoS 0 / retain なし（デモ用途につき既定値）

**追加エンドポイント**:
| エンドポイント | トピック | ペイロード |
|---|---|---|
| `POST /api/led/on` | `codeengine/3d/click/on` | `{"type":"click","value":"on"}` |
| `POST /api/led/off` | `codeengine/3d/click/off` | `{"type":"click","value":"off"}` |

### フロントエンド（`public/index.html`）

**CDN バージョン固定**（`latest` 指定禁止）:
- Bootstrap: `5.3.3`
- Vue: `3.4.21`（グローバルビルド `vue.global.prod.js`）
- Babylon.js: `6.49.0`（`https://cdn.babylonjs.com/babylon.js`）

**画面構成**:
- Babylon.js キャンバスを全面背景（`position: fixed`）
- Vue3 の `#app` をキャンバスの上にオーバーレイ（`pointer-events: none`、UI 要素のみ `auto`）
- ハンバーガーボタン: 左上固定（`position: fixed; top: 16px; left: 16px`）
- Bootstrap Offcanvas でドロワー（左から開く）

**ドロワー内コントロール**:
- 回転トグルボタン（自転の停止・再開）
- アングルリセットボタン（カメラを初期状態に戻す）
- LED 状態バッジ（ON: 赤、OFF: グレー）

**Babylon.js ↔ Vue3 の連携方法**:
- `window.__vueRotating` フラグでレンダーループの自転制御（シンプルなグローバル変数連携）
- `window.__vueApp = { onBoxClick }` で Babylon の ActionManager から Vue の関数を呼び出す
- カメラ・立方体オブジェクトはモジュールスコープ変数で保持し、Vue の関数から直接操作

**立方体クリック処理**:
- `BABYLON.ActionManager` + `OnPickTrigger` でヒットテスト
- `requesting` フラグで二重リクエスト防止
- 楽観的更新なし → API 成功後に色・状態を更新
- エラー時はトースト表示（5秒後自動消去）、状態・色はクリック前のまま維持

### 設定ファイル・環境変数

**ローカル用** (`.env`、gitignore 対象):
```
MQTT_HOST=YOUR_MQTT_HOST
MQTT_PORT=8883
MQTT_PROTOCOL=mqtts
MQTT_USERNAME=YOUR_MQTT_USERNAME
MQTT_PASSWORD=YOUR_MQTT_PASSWORD
```

**Code Engine 本番用**: `.env` / `.env.ce` ではなくアプリケーションの Secret として管理。
```bash
ibmcloud ce secret create --name mqtt-secret --from-env-file .env.production
ibmcloud ce application update --name $CE_APP_NAME --env-from-secret mqtt-secret
```

**Secret 更新のワンコマンド**:
```bash
npm run env:update
# → target_region → target_group → select_project → secret update の順に実行
```

### npm scripts 追加

| スクリプト | 内容 |
|---|---|
| `build:env_update` | `.env.production` から `mqtt-secret` を更新 |
| `env:update` | リージョン/プロジェクト選択 → Secret 更新をワンコマンドで実行 |

## 試行錯誤

### MQTT 未接続エラーの原因

**事象**: ブラウザで立方体クリック時に `[led] mqtt not connected` エラーが出続けた。

**原因**: 以前の `execute_command` で起動したプロセス（MQTT 設定なしで起動したもの）が 8080 番ポートを占有したまま残っていた。新しい `.env` を用意してもそのプロセスは再起動されておらず、環境変数が反映されていなかった。

**解決**: `Stop-Process` で旧プロセスを停止 → `npm start` で再起動 → MQTT 接続成功。

**学び**: サーバーは必ず手動ターミナルで起動・再起動する。AI 側の `execute_command` で起動したプロセスはセッション管理が不透明なため、動作確認は人間側のターミナルで行うこと。

## 解決策（最終構成）

**実装ファイル**:
- `server.js` — MQTT クライアント + `/api/led/on|off` エンドポイント追加
- `public/index.html` — Vue3 + Bootstrap5 + Babylon.js フロントエンド全面差し替え
- `.env.example` — ローカル用 MQTT 設定サンプル（新規作成）
- `README.md` — Code Engine 本番用 MQTT 環境変数設定手順を追記
- `package.json` — `mqtt` / `dotenv` 依存追加、`env:update` スクリプト追加

**動作確認済み**:
- ローカルで `npm start` 後、3D 立方体表示・自転・カメラ操作が動作
- MQTT 接続確立時に `codeengine/connected` が publish される
- 立方体クリックで `/api/led/on|off` が呼ばれ MQTT publish が成功する
- MQTT 未設定時もサーバーが正常起動し、API が即座にエラーレスポンスを返す

## 学び

- **CDN バージョン固定**: `latest` は禁止。実装時点の安定版を明示的にピン留めする
- **Babylon.js と Vue の統合**: 複雑なリアクティブ連携より `window.__xxx` によるシンプルなグローバルフラグの橋渡しが CDN 構成では実用的
- **MQTT error リスナー**: 未登録だと Node.js の未処理例外でプロセスがクラッシュする。必ず登録すること
- **`.env.ce` の役割分担**: デプロイスクリプト専用。MQTT 設定はここに混入しない。ローカル用 `.env` と本番用 Secret を明確に分ける

## 今後の改善案

- Code Engine 本番デプロイ後に MQTT 接続を本番ブローカーで確認する
- ローカルテスト用に Docker で Mosquitto を立てる手順を追記する

## 関連ドキュメント

- [申し送り](../letters/2026-09-21-21-13-09-initial-setup-complete.md)
- [実装指示書](../../tmp/BABYLONJS_FRONTEND_TASK.md)
- [MQTT env 注入メモ](../../tmp/MQTT_ENV_INJECTION_NOTE.md)

---

**最終更新**: 2026-09-21
**作成者**: Bob
