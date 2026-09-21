---
tags: [code-engine, npm-scripts, dotenv, deploy, ibmcloud, env]
---

**作成日**: 2026-09-21
**関連タスク**: IBM Code Engine デプロイ運用スクリプトの整備

## 問題

初回デプロイ後の日常更新（コード変更 → 再ビルド → アプリ更新）を毎回手動で `ibmcloud` コマンドを打つのは煩雑。
また、デプロイ先の環境情報（プロジェクト名・ビルド名・イメージ URI 等）をリポジトリに直書きすると、
別プロジェクトへの使い回しができなくなる。

## 試行錯誤

### アプローチA（採用）: dotenv-cli + `.env.ce` で環境情報を外部化

**試したこと**: `dotenv-cli` で `.env.ce` を読み込み、`npm run build` で全デプロイ手順を自動化

**結果**: 成功

**最終的な `npm run build` のフロー**:
```
npm run build
  ├─ build:target_region    → ibmcloud target -r $IBMCLOUD_TARGET_REGION
  ├─ build:target_group     → ibmcloud target -g $IBMCLOUD_TARGET_RESOURCE_GROUP
  ├─ build:select_project   → ibmcloud ce project select --name $IBMCLOUD_TARGET_PROJECT_NAME
  ├─ build:image_build      → ibmcloud ce buildrun submit --build $CE_BUILD_NAME --wait
  └─ build:update_app       → ibmcloud ce application update --name $CE_APP_NAME --image $CE_BUILD_IMAGE --wait
```

### `.env.ce` の段階的な強化

初期は最小限の3変数から始まり、セッション中に段階的に追加した：

| 追加タイミング | 変数 | 理由 |
|---------------|------|------|
| 初期 | `CE_BUILD_NAME` / `CE_APP_NAME` / `CE_BUILD_IMAGE` | `buildrun submit` と `application update` に必要な最小セット |
| 追加① | `IBMCLOUD_TARGET_PROJECT_NAME` | `project select` を自動化するため |
| 追加② | `IBMCLOUD_TARGET_REGION` / `IBMCLOUD_TARGET_RESOURCE_GROUP` | リージョン・リソースグループの切り替えも `npm run build` 完結にするため |

## 解決策

**`.env.ce` の構成**（実値は Git 管理外）:

```bash
# 必須設定
IBMCLOUD_TARGET_PROJECT_NAME=YOUR_PROJECT_NAME
CE_BUILD_NAME=YOUR_BUILD_NAME
CE_APP_NAME=YOUR_APP_NAME
CE_BUILD_IMAGE=private.<region>.icr.io/YOUR_NAMESPACE/build-YOUR_BUILD_NAME:latest

# 任意設定
IBMCLOUD_TARGET_REGION=jp-tok
IBMCLOUD_TARGET_RESOURCE_GROUP=default
```

**`.env.ce.example`** をリポジトリに追加し、`.gitignore` で `!.env.ce.example` を例外設定した。
新環境への展開時はこのファイルをコピーして値を埋めるだけで再現できる。

**主なポイント**:
1. `.env.ce` は `.gitignore` 済み。ICR の内部 URI 等の機密情報をリポジトリに含めない
2. `dotenv-cli` の `dotenv -e .env.ce -- <command>` で各 script に環境変数を注入
3. `build:target_region` → `build:target_group` → `build:select_project` の順で実行することで、ログイン済みセッションであればどのリージョン・プロジェクトへも切り替えて再デプロイできる

## 学び

- `npm run build` の各ステップを `build:xxx` として個別 script に切り出しておくと、部分実行やデバッグが容易
- `.env.example` パターンは dotenv-cli との相性が良く、チームや複数環境での使い回しに有効
- `ibmcloud target` のリージョン・リソースグループ指定をスクリプト化しておくと、ログイン後に手動で `target` を打つ手間が省ける

## 今後の改善案

- `CE_BUILD_COMMIT` を活用し、ステージング環境向けに特定ブランチを指定したビルドを追加する
- `CE_APP_CPU` / `CE_APP_MEMORY` を使ったスペック調整スクリプトを必要に応じて追加する

## 関連ドキュメント

- [.env.ce.example](../../.env.ce.example)
- [package.json](../../package.json)
- [前のノート: Code Engine デプロイ基盤の構築](./2026-09-21-21-11-08-codeengine-deploy-setup.md)

---

**最終更新**: 2026-09-21
**作成者**: Bob
