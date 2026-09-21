---
tags: [security, secretlint, gitleaks, pre-commit, setup]
---

**作成日**: 2026-09-21
**関連タスク**: secretlint + gitleaks セキュリティチェック導入

## 問題

AI がドキュメントを書く際に認証情報が混入するリスクがある。特に `docs/notes` に経緯を残す運用では、curl 例や API 設定メモに本物の値が紛れやすいため、コミット前に自動で検出する仕組みが必要だった。

## 試行錯誤

### アプローチA（採用）

**試したこと**: `npx degit` で `1ft-seabass/my-ai-collaboration-patterns/patterns/setup-pattern/setup-securecheck` を取得し、`tmp/security-setup/setup-securecheck.md` のウィザードに従って導入

**結果**: 成功

**コード例**:
```bash
npx degit 1ft-seabass/my-ai-collaboration-patterns/patterns/setup-pattern/setup-securecheck ./tmp/security-setup

# Phase 1: テンプレート配置
Copy-Item "tmp\security-setup\templates\.secretlintrc.json" .
Copy-Item "tmp\security-setup\templates\gitleaks.toml" .
Copy-Item -Recurse -Force "tmp\security-setup\templates\.security-check" .

# secretlint インストール
npm install -D secretlint @secretlint/secretlint-rule-preset-recommend

# gitleaks インストール（OS自動判定）
node .security-check/cli.js install-gitleaks

# Phase 2: npm scripts 追加（package.json に追記）
# "security": "node .security-check/cli.js"

# Phase 3: simple-git-hooks インストール・設定
npm install -D simple-git-hooks
# package.json に追記:
# "postinstall": "npx simple-git-hooks"
# "simple-git-hooks": { "pre-commit": "node .security-check/cli.js pre-commit" }
npx simple-git-hooks
```

### ネガティブテストでのまごつき

**試したこと**: 手順書のカナリア値（`ghp_A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8` <!-- gitleaks:allow secretlint-disable-line -->）をそのままテストファイルに書いてコミット

**結果**: ブロックされなかった

**理由**: `pre-commit.js` が自動カナリア注入に同じ値を使っており、カナリア自己検証扱いでスルーされる仕様だった。別のシークレット形式（AWS キー）でテストしたところ正常にブロックされた。

### コミット分割のやり直し

**試したこと**: セキュリティチェック導入を `test: pre-commit hook` という1コミットにまとめてしまった

**結果**: メッセージと内容が乖離していた

**対処**: `git reset HEAD~1` でコミットを取り消し、以下の4コミットに分割した
1. `chore: npm init および secretlint・simple-git-hooks を追加`
2. `chore: secretlint + gitleaks のセキュリティチェックを導入`
3. `chore: tmp/ を .gitignore に追加`
4. `docs: セキュリティチェック導入の作業ノートを追加`（本ノート）

## 解決策

`setup-securecheck` パターン v3 を導入し、以下の構成になった：

```
.security-check/   # cli.js・検証ロジック一式（git 管理下）
.security-check/bin/    # gitleaks バイナリ（.gitignore 除外）
.security-check/logs/   # 実行ログ（.gitignore 除外）
.secretlintrc.json      # secretlint 設定
gitleaks.toml           # gitleaks 設定
```

**動作確認結果**: `node .security-check/cli.js verify` → **15/15 passed**

**主なポイント**:
1. secretlint と gitleaks の二重チェック体制
2. gitleaks バイナリが不在の場合はフェイルクローズでコミットをブロック
3. `postinstall` で `npm install` 後に全員の hooks が自動有効化される
4. `tmp/` は `.gitignore` に追加し、ウィザードファイルをリポジトリに含めない

## 学び

- `pre-commit.js` の自動カナリア注入と同じ値（`ghp_A1b2C3...`）でネガティブテストをしてもスルーされる。別のシークレット形式で確認が必要
- コミットは作業の途中でもこまめに分割する。「動いたからまとめてコミット」は後で分割コストがかかる
- `tmp/` のような作業用フォルダは最初から `.gitignore` に入れておく

## 今後の改善案

- プロジェクト固有の false positive が出たら `.secretlintrc.json` の `ignores` にパターンを追加する
- `gitleaks.toml` の `allowlist` をプロジェクトの実情に合わせて調整する

## 関連ドキュメント

- [.security-check/README.md](../../.security-check/README.md)
- [docs/actions/check_my_security_prepare_level.md](../actions/check_my_security_prepare_level.md)
- [前回の導入ノート](./2026-09-21-19-25-57-docs-structure-setup.md)

---

**最終更新**: 2026-09-21
**作成者**: Bob
