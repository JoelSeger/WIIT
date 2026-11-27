#!/usr/bin/env bash
# scripts/check-db-rules.sh
set -u
fail=0

GREEN='\033[0;32m'
RED='\033[0;31m'
RESET='\033[0m'

# 1. .transaction( only in unitOfWork.ts and src/ead/
hits=$(grep -rnE '\.transaction\(' src \
  --include='*.ts' \
  --exclude-dir=unit_tests --exclude-dir=ead \
  | grep -vE '^src/config/db.ts')

if [ -n "$hits" ]; then
  printf '%b\n' "${RED}❌ .transaction( outside UnitOfWork:${RESET}"
  echo "$hits"
  fail=1
else
  printf '%b\n' "${GREEN}✔ .transaction( usage is within UnitOfWork and allowed paths${RESET}"
fi

# 2. importing knex only in repos/, config/, middleware-free layers
hits=$(grep -rnE "from ['\"]knex['\"]" src/services src/controllers src/routers \
  --include='*.ts' | grep -v 'import type')

if [ -n "$hits" ]; then
  printf '%b\n' "${RED}❌ runtime knex import in services/controllers/routers:${RESET}"
  echo "$hits"
  fail=1
else
  printf '%b\n' "${GREEN}✔ No runtime knex imports in services/controllers/routers${RESET}"
fi

# 3. raw table queries in services: trx("nodes"), knex("nodes"), db("nodes")
hits=$(grep -rnE '\b(trx|knex|db)\(["'"'"'`][a-z_]+' src/services src/controllers \
  --include='*.ts')

if [ -n "$hits" ]; then
  printf '%b\n' "${RED}❌ raw table query in service/controller (move it into a repository):${RESET}"
  echo "$hits"
  fail=1
else
  printf '%b\n' "${GREEN}✔ No raw table queries in services/controllers${RESET}"
fi

exit $fail
