---
tags: [npm-scripts, powershell, dotenv-cli, code-engine, windows]
---

> **⚠️ 機密情報保護ルール**
>
> このノートに記載する情報について:
> - API キー・パスワード・トークンは必ずプレースホルダー(`YOUR_API_KEY`等)で記載
> - 実際の機密情報は絶対に含めない
> - .env や設定ファイルの内容をそのまま転記しない

**作成日**: 2026-09-21
**関連タスク**: Code Engine デプロイスクリプトの修正・Secret 紐付け対応

## 問題

`npm run build:target_region` 等の Code Engine デプロイスクリプトが Windows PowerShell 環境で動かなかった。原因は2つ重なっていた。

### 問題1: `dotenv-cli` v11 で `-e` オプションが廃止

`dotenv-cli` が v11 にアップデートされており、従来の構文が変わっていた。

**旧構文（v10以前）**:
```
dotenv -e .env.ce -- <command>
```

**新構文（v11）**:
```
dotenv run -f .env.ce -- <command>
```

`-e` を渡すとヘルプが表示されてコマンドが実行されない。

### 問題2: PowerShell で `$VAR` がシェル変数として解釈される

`dotenv run -f .env.ce -- ibmcloud target -r $IBMCLOUD_TARGET_REGION` のように書いても、PowerShell が `$IBMCLOUD_TARGET_REGION` を PowerShell 変数（未定義 = 空文字）として展開してしまい、dotenv で注入した環境変数が ibmcloud コマンドに渡らなかった。

## 試行錯誤

### アプローチA: `-e` → `-f` に変更
**結果**: 失敗
**理由**: `-f` に直しても PowerShell の `$VAR` 展開問題が残った。

### アプローチB: `cross-env` の導入
**結果**: 不採用
**理由**: `cross-env` は環境変数を `KEY=VALUE command` 形式でセットするものであり、dotenv ファイルを読み込んで展開する用途には合わない。

### アプローチC: Node.js ヘルパースクリプト `scripts/ce-run.js`（採用）
**結果**: 成功

`dotenv` パッケージで `.env.ce` を読み込み、引数の `$VAR` を Node.js 側で展開してから `spawnSync` でコマンドを実行するスクリプトを作成。

```js
require('dotenv').config({ path: '.env.ce' });
const { spawnSync } = require('child_process');

const args = process.argv.slice(2).map((arg) =>
  arg.replace(/\$([A-Z_][A-Z0-9_]*)/g, (_, name) => process.env[name] ?? '')
);

const [cmd, ...rest] = args;
const result = spawnSync(cmd, rest, { stdio: 'inherit', shell: true });
process.exit(result.status ?? 1);
```

これにより `package.json` の scripts を以下のように統一できた：
```
node scripts/ce-run.js ibmcloud target -r $IBMCLOUD_TARGET_REGION
```

## 解決策（最終構成）

**実装ファイル**: `scripts/ce-run.js`（新規作成）

**`package.json` scripts の変更**:

| スクリプト | 内容 |
|---|---|
| `build:target_region` | リージョン設定 |
| `build:target_group` | リソースグループ設定 |
| `build:select_project` | CE プロジェクト選択 |
| `build:image_build` | イメージビルド |
| `build:update_app` | アプリ更新（イメージ） |
| `build:env_create` | mqtt-secret を新規作成（初回のみ） |
| `build:env_update` | mqtt-secret を更新 |
| `build:env_attach` | アプリに mqtt-secret を紐付け |
| `build` | フルデプロイ（region→group→project→build→update） |
| `env:create` | Secret 初回作成（region→group→project→create） |
| `env:update` | Secret 更新（region→group→project→update） |
| `env:attach` | Secret 紐付け（region→group→project→attach） |

**Code Engine への MQTT Secret 設定フロー（初回）**:
```bash
npm run env:create   # .env.production から mqtt-secret を作成
npm run env:attach   # アプリに mqtt-secret を紐付け
```

**2回目以降の更新**:
```bash
npm run env:update   # mqtt-secret の内容を更新
```

## 学び

- **dotenv-cli はバージョンによって構文が大きく変わる**。v11 で `dotenv <cmd>` → `dotenv run <cmd>`、`-e` → `-f` に変更された。`package.json` に固定バージョンを明示するか、アップデート時に動作確認が必要。
- **PowerShell では `$VAR` はシェル変数**。bash/zsh と異なり、npm scripts 内の `$VAR` は PowerShell 変数として解釈される。Node.js スクリプト経由で展開する方式がクロスプラットフォーム対応として有効。
- **PowerShell では `&&` が使えない**（Windows PowerShell 5.1）。npm scripts 内で `&&` を使う場合は `npm run` 経由でチェーンするか、Node.js スクリプトにまとめる。

## 今後の改善案

- `dotenv-cli` のバージョンを `package.json` の `devDependencies` で固定する（現在 `^11.0.0`）
- `scripts/ce-run.js` は汎用的なので他の CE コマンドにも流用できる

## 関連ドキュメント

- [Babylon.js 実装ノート](./2026-09-21-21-35-08-babylonjs-vue3-mqtt-implementation.md)
- [申し送り](../letters/2026-09-21-21-13-09-initial-setup-complete.md)

---

**最終更新**: 2026-09-21
**作成者**: Bob
