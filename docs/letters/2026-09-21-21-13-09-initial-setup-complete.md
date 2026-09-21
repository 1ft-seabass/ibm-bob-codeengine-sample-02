---
tags: [session-handoff, code-engine, hono, setup-complete, babylon-js-next]
---

> **⚠️ 機密情報保護ルール**
>
> この申し送りに記載する情報について:
> - API キー・パスワード・トークンは必ずプレースホルダー(`YOUR_API_KEY`等)で記載
> - 実際の機密情報は絶対に含めない
> - .env や設定ファイルの内容をそのまま転記しない
> - コミット前に git diff で内容を確認
> - プッシュはせずコミットのみ(人間がレビュー後にプッシュ)

## 🔍 次のセッション開始時の検証プロトコル

**次のAIへ: セッション開始時に必ず以下を実行してください**

### 1. 前セッションの完了状態を検証

```bash
# サーバーが起動するか確認
npm start
# → "app listening at http://localhost:8080" が出ればOK

# ヘルスチェック
curl http://localhost:8080/
curl http://localhost:8080/api/hello
# → / が 200、/api/hello が {"message":"Hello from Hono!"} ならOK

# セキュリティチェック
node .security-check/cli.js verify
# → 15/15 passed ならOK
```

### 2. 検証結果を人間に報告

- ✅ **全て成功**: 「前セッションの完了状態を確認しました。Babylon.js フロントエンド実装から開始します。」
- ⚠️ **失敗あり**: 「[項目]が未完了でした（理由: [エラー内容]）。[該当箇所]から再開します。」

---

## 🔧 コマンド実行ルール

実行前に `package.json` の `scripts` を確認すること。

| コマンド | 用途 |
|---------|------|
| `npm start` | ローカルサーバー起動（`node server.js`） |
| `npm run security` | セキュリティチェック（secretlint + gitleaks） |
| `npm run build` | Code Engine へ再デプロイ（ibmcloud 操作。`.env.ce` 必須） |

**`npm run build*` は Code Engine へのデプロイコマンドであり、アプリのビルドとは無関係。** 混同しないこと。

---

## 現在の状況

### Phase 1: 基盤構築 ✅ 完了

**完了内容**:
- ✅ `docs-structure` パターン導入（`docs/actions/`, `docs/notes/`, `docs/letters/`, `docs/tasks/`）
- ✅ secretlint + gitleaks + simple-git-hooks による pre-commit セキュリティチェック（15/15 passed）
- ✅ Hono サーバー（`server.js`）+ 静的配信（`public/index.html`）+ Dockerfile 作成
- ✅ IBM Code Engine へ初回デプロイ済み（`ibmcloud ce application create` 完了）
- ✅ `npm run build` で `git push` 後の再デプロイが2手順で完結する仕組みを整備
- ✅ `.env.ce` / `.env.ce.example` で環境情報を外部化・ドキュメント化

**デプロイ済みアプリ**:
- URL: `https://ibm-bob-codeengine-sample-02.1e6cl2vzbcl7.jp-tok.codeengine.appdomain.cloud`
- プロジェクト: `ce-project-7c`（jp-tok / default リソースグループ）

### Phase 2: Babylon.js フロントエンド + MQTT バックエンド ❌ 未着手

次セッションのメインタスク。詳細は `tmp/BABYLONJS_FRONTEND_TASK.md` を参照。

---

## 次にやること

1. **最優先**: `tmp/BABYLONJS_FRONTEND_TASK.md` を読み、Babylon.js + Vue3 + Bootstrap5 フロントエンドと MQTT バックエンドを実装する
2. **実装完了後**: Code Engine 本番アプリに MQTT 環境変数を設定する（`ibmcloud ce application update --env` または Secret 経由）
3. **任意**: `tmp/BABYLONJS_FRONTEND_TASK.md` の内容を `docs/notes/` に要約して移した上でファイルを削除する

---

## 注意事項

- ⚠️ **`.env.ce` はデプロイスクリプト専用**。MQTT 接続情報はここに追加しない。ローカル実行用は `.env`（新規作成・gitignore 追加）、Code Engine 本番は `ibmcloud ce application update --env` で別途設定する
- ⚠️ **フロントエンドはビルドパイプライン不要**。Vue3 / Bootstrap5 / Babylon.js はすべて CDN 経由。webpack/vite 等のバンドラは導入しない
- ⚠️ **CDN バージョンは最新安定版を明示的にピン留めする**（`latest` 指定は禁止）
- ⚠️ `npm run build` 実行前に必ず `git push origin main` でリモートを更新すること（Code Engine はリモートを参照してビルドする）
- ⚠️ `node_modules/` は `.gitignore` 済みだが `npm install` は必要（clone 後など）

---

## 技術的な文脈

- **サーバー**: Hono v4 + `@hono/node-server`（CommonJS / `require` 形式）
- **静的配信**: `serveStatic({ root: './public' })` で `public/` 配下をそのまま配信
- **Dockerfile**: `icr.io/codeengine/node:22-alpine` ベース、`--omit=dev` で devDependencies 除外
- **セキュリティ**: pre-commit フックで secretlint + gitleaks が自動実行。`node .security-check/cli.js verify` で15項目チェック可能
- **重要ファイル**:
  - `server.js` — サーバー本体（MQTT 追加先）
  - `public/index.html` — フロントエンド（差し替え先）
  - `.env.ce.example` — デプロイ設定サンプル
  - `tmp/BABYLONJS_FRONTEND_TASK.md` — 次フェーズの実装指示書（ワンショット）

---

## セッション文脈サマリー

### 核心的な設計決定

- **決定事項**: フロントエンドはビルドパイプラインなし・CDN 直読み込み
  - 理由: シンプルさの維持。`public/` に置くだけで Hono の静的配信でそのまま動く
- **決定事項**: MQTT 設定は `.env.ce` に混入させず独立した `.env` を使う
  - 理由: `.env.ce` はデプロイスクリプト（`ibmcloud ce` コマンド）専用であり、実行中のコンテナは一切参照しない
- **決定事項**: セキュリティチェックを pre-commit フックで自動化
  - 理由: AI がドキュメント作成時に機密情報を混入するリスクを防ぐ

### 議論の流れ

1. **docs-structure / setup-securecheck** パターンを `npx degit` で導入してプロジェクト基盤を整備
2. **Hono サーバー + Dockerfile** を作成し `ibmcloud ce application create` で初回デプロイ
3. **`npm run build` スクリプト**を段階的に強化（project select → target region/group の自動化）
4. **`.env.ce.example`** でデプロイ設定を文書化。次フェーズは Babylon.js 実装

### 次のセッションに引き継ぐ「空気感」

- **優先順位**: まず動くものを作ること。過度な設計より「ローカルで動く」「Code Engine で動く」を優先
- **避けるべきアンチパターン**: `.env.ce` への MQTT 設定混入、フロントへのバンドラ導入、CDN バージョン未固定
- **重視している価値観**: シンプルさ・Git 管理の整合性・機密情報の扱いに慎重
- **現在フェーズ**: 基盤完成。次は機能実装フェーズ（Babylon.js + MQTT）

---

**作成日時**: 2026-09-21 21:13:09
**作成者**: Bob
