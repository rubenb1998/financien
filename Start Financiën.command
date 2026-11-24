#!/bin/zsh
set -e
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
cd -- "${0:A:h}"
if curl --connect-timeout 1 -fsS http://127.0.0.1:4317/api/ledger -o /dev/null; then
  open http://127.0.0.1:4317/
  exit
fi
if [[ ! -d node_modules ]]; then
  npm ci
fi
npm run build
exec npm start -- --open
