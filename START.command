#!/bin/zsh
set -e
cd "$(dirname "$0")"
DRIVECORE_NODE="$(command -v node || true)"
if [[ -z "$DRIVECORE_NODE" ]]; then
  DRIVECORE_NODE="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
fi
if [[ ! -x "$DRIVECORE_NODE" ]]; then
  echo "Node.js 22+ is required. See README.md."
  exit 1
fi
export PATH="$(dirname "$DRIVECORE_NODE"):$PATH"
if [[ ! -d node_modules ]]; then
  echo "Install dependencies first: pnpm install. See README.md."
  exit 1
fi
"$DRIVECORE_NODE" --import tsx scripts/setup-local.ts
"$DRIVECORE_NODE" node_modules/prisma/build/index.js generate --schema database/prisma/schema.prisma
"$DRIVECORE_NODE" node_modules/prisma/build/index.js migrate deploy --schema database/prisma/schema.prisma
"$DRIVECORE_NODE" --import tsx database/seed.ts
echo "DRIVECORE: http://localhost:5173"
echo "CRM: http://localhost:5173/crm"
echo "Administrator credentials: protected local .env; manage employee passwords in CRM."
exec "$DRIVECORE_NODE" --import tsx scripts/dev.ts
