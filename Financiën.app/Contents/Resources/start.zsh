#!/bin/zsh

mode="${1:-}"

show_error() {
  if [[ "$mode" == --print-url ]]; then
    print -r -- "$1" >&2
    exit 1
  fi
  /usr/bin/osascript -e 'on run argv' \
    -e 'display alert "Financiën" message (item 1 of argv) as critical' \
    -e 'end run' -- "$1"
  exit 1
}

project="${0:A:h:h:h:h}"
export PATH="/opt/homebrew/bin:/usr/local/bin:/opt/homebrew/opt/node@24/bin:/usr/local/opt/node@24/bin:$HOME/.volta/bin:$HOME/.nvm/current/bin:$PATH"

if [[ ! -f "$project/scripts/start.mjs" ]]; then
  show_error "Zet Financiën.app terug in de projectmap Financien."
fi
if ! command -v node >/dev/null; then
  show_error "Installeer Node.js 24 of nieuwer om Financiën te starten."
fi

result=$(node --no-warnings "$project/scripts/start.mjs" 2>&1) || show_error "$result"
[[ "$result" == http://127.0.0.1:* ]] || show_error "De lokale server gaf geen geldig adres terug."
if [[ "$mode" == --print-url ]]; then
  print -r -- "$result"
  exit
fi
/usr/bin/open "$result" || show_error "De browser kon niet worden geopend. Open $result handmatig."
