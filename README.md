# ibm-bob-codeengine-sample-02

Hono + Node.js サーバー + Babylon.js フロントエンドのサンプルアプリ。  
立方体クリックで LED ON/OFF をトグルし、MQTT publish する。

---

## ローカル起動

```bash
npm install
npm start
# → http://localhost:8080
```

### MQTT 設定（ローカル用）

`.env.example` をコピーして `.env` を作成し、実際のブローカー情報を入力する。

```bash
cp .env.example .env
# .env を編集して MQTT_HOST / MQTT_PORT / MQTT_PROTOCOL / MQTT_USERNAME / MQTT_PASSWORD を設定
```

> ⚠️ `.env` は `.gitignore` 対象のため Git には含まれない。  
> ⚠️ `.env.ce` はデプロイスクリプト（`ibmcloud ce ...`）専用であり、MQTT 設定の置き場所ではない。

MQTT 環境変数が未設定の場合、サーバーは起動するが MQTT 接続は行われない。  
`/api/led/on|off` を叩くと `{ ok: false, error: 'mqtt not connected' }` が返る。

---

## Code Engine へのデプロイ

### 1. MQTT 環境変数を Code Engine アプリに設定する

Code Engine 上のコンテナはリポジトリの `.env` / `.env.ce` を参照しないため、
アプリケーション自体に環境変数を設定する必要がある。

**本番用設定ファイルから Secret をまとめて登録する方法（推奨）：**

```bash
# ローカルの .env とは別に本番用ファイルを用意（.gitignore 対象）
cp .env.example .env.production
# .env.production を編集して本番ブローカー情報を入力

# Secret を作成（初回のみ）
ibmcloud ce secret create --name mqtt-secret --from-env-file .env.production

# アプリに Secret を紐付け
ibmcloud ce application update --name ibm-bob-codeengine-sample-02 \
  --env-from-secret mqtt-secret
```

> ⚠️ ローカルの `.env`（テスト用ブローカー）をそのまま本番 Secret に使うと
>    テスト用接続先が本番に入るため、本番用ファイルを分けることを推奨。
> ✅ 設定後は `ibmcloud ce application get --name ibm-bob-codeengine-sample-02` で反映を確認する。

Secret を更新する場合：

```bash
ibmcloud ce secret update --name mqtt-secret --from-env-file .env.production
```

`npm run build:*` のリージョン/プロジェクト選択を流用してワンコマンドでも実行できる：

```bash
npm run env:update   # target_region → target_group → select_project → secret update
```

### 2. アプリをビルド・デプロイする

```bash
git push origin main   # Code Engine はリモートを参照してビルドする
npm run build          # ibmcloud ce buildrun submit → application update
```

> ⚠️ `npm run build` 実行前に必ず `git push` でリモートを更新すること。

---

## セキュリティチェック

```bash
node .security-check/cli.js verify
# → 15/15 passed ならOK
```

pre-commit フックで secretlint + gitleaks が自動実行される。
