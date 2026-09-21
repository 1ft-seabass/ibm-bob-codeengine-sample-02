---
tags: [docs-structure, degit, template, setup, docs]
---

**作成日**: 2026-09-21
**関連タスク**: docs-structure テンプレート導入

## 問題

プロジェクトに AI コラボレーション向けのドキュメント構造が存在せず、ノート・タスク・レター・アクションを整理する仕組みが必要だった。

## 試行錯誤

### アプローチA（採用）
**試したこと**: `npx degit` で `1ft-seabass/my-ai-collaboration-patterns/patterns/docs-structure` を取得し、`templates/` 配下のみを `docs/` 直下に配置する

**結果**: 成功

**コード例**:
```bash
npx degit 1ft-seabass/my-ai-collaboration-patterns/patterns/docs-structure _tmp_degit_check
New-Item -ItemType Directory -Force -Path docs
Copy-Item -Recurse -Force "_tmp_degit_check\templates\*" "docs\"
Remove-Item -Recurse -Force "_tmp_degit_check"
```

**ポイント**: `templates/` フォルダ自体は作らず、その中身だけを `docs/` 直下にコピーすることで期待通りの構造を実現した。

## 解決策

`docs/` 直下に以下の構造を配置した：

```
docs/
├── README.md
├── actions/
│   ├── 00_session_end.md
│   ├── 01_git_push.md
│   ├── check_my_security_prepare_level.md
│   ├── dev_refactoring.md
│   ├── dev_review.md
│   ├── dev_security.md
│   ├── dev_testing.md
│   ├── doc_letter.md
│   ├── doc_note.md
│   ├── doc_note_and_commit.md
│   ├── git_commit.md
│   ├── help.md
│   └── README.md
├── letters/
│   ├── README.md
│   └── TEMPLATE.md
├── notes/
│   ├── README.md
│   └── TEMPLATE.md
└── tasks/
    ├── README.md
    └── TEMPLATE.md
```

**主なポイント**:
1. `npx degit` はリポジトリのサブディレクトリ指定が可能（`user/repo/path/to/dir` 形式）
2. `templates/` という名前のフォルダを作らないよう、`Copy-Item` でワイルドカード指定してコピー
3. 一時フォルダ `_tmp_degit_check` は作業後に削除

## 学び

- `npx degit` はサブディレクトリ単位で取得できるため、モノレポ形式のテンプレートリポジトリと相性が良い
- 初期段階では汎用テンプレートのままで使用し、プロジェクトが成熟してから各テンプレートをカスタマイズするのが推奨方針

## 今後の改善案

- プロジェクト固有の要件が固まったタイミングで各テンプレート（`letters/TEMPLATE.md`, `notes/TEMPLATE.md`, `tasks/TEMPLATE.md`）をカスタマイズする
- `actions/` 配下の指示書をプロジェクトのワークフローに合わせて調整する

## 関連ドキュメント

- [docs/README.md](../README.md)
- [actions/doc_note_and_commit.md](../actions/doc_note_and_commit.md)

---

**最終更新**: 2026-09-21
**作成者**: Bob
