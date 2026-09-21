---
tags: [code-engine, hono, nodejs, dockerfile, deploy, ibmcloud]
---

**作成日**: 2026-09-21
**関連タスク**: IBM Code Engine デプロイ基盤の構築

## 問題

Node.js（Hono）アプリを IBM Cloud Code Engine 上で動かすための基盤がなかった。
静的ファイル配信と API エンドポイントを備えたサーバーを Docker イメージ化し、
GitHub リポジトリを直接ソースとしてビルド・デプロイする仕組みが必要だった。

## 試行錯誤

### アプローチA（採用）: `application create` で一括ビルド＆デプロイ

**試したこと**: `ibmcloud ce application create --build-source` でビルドとデプロイを1コマンドに集約

**結果**: 成功

**コード例**:
```bash
ibmcloud target -g default
ibmcloud ce project select --name ce-project-7c

ibmcloud ce application create \
  --name ibm-bob-codeengine-sample-02 \
  --build-source https://github.com/1ft-seabass/ibm-bob-codeengine-sample-02 \
  --build-strategy dockerfile \
  --build-size medium \
  --port 8080 \
  --wait
```

**ポイント**:
- `--wait` を付けることでビルド完了・起動確認まで待機し、公開 URL をその場で取得できる
- `application create` では `--build-source`、`ibmcloud ce build create` 単体では `--source` とオプション名が異なる点に注意

### build 定義の別途作成

**試したこと**: `application create` 後に `ibmcloud ce build list` でビルド定義を確認

**結果**: `application create` は独立した build 定義を作らない方式だった

**対処**: 日常更新の `buildrun submit` に使うため、別途 `ibmcloud ce build create` で build 定義を作成した

```bash
ibmcloud ce build create \
  --name ibm-bob-codeengine-sample-02-build \
  --source https://github.com/1ft-seabass/ibm-bob-codeengine-sample-02 \
  --strategy dockerfile \
  --size medium \
  --image private.jp.icr.io/YOUR_NAMESPACE/build-ibm-bob-codeengine-sample-02-build:latest \
  --registry-secret ce-auto-icr-private-jp-tok
```

## 解決策

以下の構成で初回デプロイが完了した：

| ファイル | 役割 |
|----------|------|
| `server.js` | Hono サーバー（静的配信 + `/api/hello`） |
| `public/index.html` | 静的ページ（動作確認用） |
| `Dockerfile` | `icr.io/codeengine/node:22-alpine` ベース、`--omit=dev` で軽量化 |

**動作確認結果**:
- `https://ibm-bob-codeengine-sample-02.1e6cl2vzbcl7.jp-tok.codeengine.appdomain.cloud/` → HTTP 200
- `https://ibm-bob-codeengine-sample-02.1e6cl2vzbcl7.jp-tok.codeengine.appdomain.cloud/api/hello` → `{"message":"Hello from Hono!"}`

**主なポイント**:
1. IBM Code Engine はコンテナに `PORT` 環境変数を自動設定するため `process.env.PORT || 8080` で受ける
2. Dockerfile の `npm install` は `--omit=dev` で devDependencies（secretlint 等）を除外し軽量化
3. `git push` してリモートに Dockerfile が存在する状態にしてから `application create` を実行する必要がある

## 学び

- `application create` と `build create` はビルド定義の扱いが異なる。日常更新に `buildrun submit` を使う場合は別途 `build create` が必要
- `--wait` はデプロイ結果をその場で確認できるため初回は特に有効

## 今後の改善案

- フロントエンド（Vue 等）を導入する場合は `public/` 配下を差し替える
- スケール設定（最小インスタンス数等）はトラフィックに応じて調整する

## 関連ドキュメント

- [Dockerfile](../../Dockerfile)
- [server.js](../../server.js)
- [次のノート: デプロイ運用スクリプトの整備](./2026-09-21-21-11-08-codeengine-deploy-scripts.md)

---

**最終更新**: 2026-09-21
**作成者**: Bob
