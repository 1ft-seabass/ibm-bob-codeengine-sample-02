#!/usr/bin/env node
/**
 * .env.ce を読み込み、引数のコマンドを環境変数展開した上で実行するヘルパー。
 * PowerShell では $VAR がシェル変数として解釈されるため、このスクリプトで展開する。
 *
 * 使い方: node scripts/ce-run.js <command> [args...]
 * 例: node scripts/ce-run.js ibmcloud target -r $IBMCLOUD_TARGET_REGION
 */
require('dotenv').config({ path: '.env.ce' });
const { spawnSync } = require('child_process');

const args = process.argv.slice(2).map((arg) =>
  arg.replace(/\$([A-Z_][A-Z0-9_]*)/g, (_, name) => process.env[name] ?? '')
);

const [cmd, ...rest] = args;
const result = spawnSync(cmd, rest, { stdio: 'inherit', shell: true });
process.exit(result.status ?? 1);
