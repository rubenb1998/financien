# Financiën

Financiën is een lokaal dashboard voor je persoonlijke financiën. Importeer bankafschriften om te zien waar je geld naartoe gaat, welke kosten terugkomen en hoeveel ruimte je hebt om te sparen. Deze repository bevat de broncode, startknoppen voor macOS en Windows, tests en handleidingen.

- **Inzicht in je geld** — bekijk inkomsten, uitgaven, banksaldi, categorieën en aanbieders. Filter het vermogen op periode of bankrekening. Zoek boekingen terug, pas de indeling aan en volg abonnementen en werkdeclaraties.
- **Rapportages en spaarscenario’s** — vergelijk uitgaven over een periode, bekijk hoe je saldo zich kan ontwikkelen en download een rapport met de grafieken die je kiest.
- **Optionele AI-chat** — stel vragen over je cijfers vanuit het dashboard, kies je model en bewaar terugkerende voorkeuren in je lokale chatgeheugen.

## Downloaden en openen

1. Download op GitHub via **Code → Download ZIP** en pak de hele map uit, of kloon de repository.
2. Installeer [Node.js 24 LTS](https://nodejs.org/en/download). Voor PDF-import installeer je ook [Python 3.13 of 3.14](https://www.python.org/downloads/) en voer je hieronder de opdrachten voor je systeem uit.
3. Dubbelklik op **Financiën.app** (macOS) of **Financien.exe** (Windows) in de uitgepakte map. Sleep de app op macOS naar je Dock of maak op Windows een snelkoppeling naar het startbestand.

Op macOS, vanuit de uitgepakte projectmap:

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
```

Op Windows, vanuit de uitgepakte projectmap in PowerShell:

```powershell
python -m venv .venv
.\\.venv\\Scripts\\python.exe -m pip install -r requirements.txt
```

Als Windows de opdracht `python` niet vindt en de Python-launcher wel geïnstalleerd is, gebruik je `py -3 -m venv .venv` voor de eerste regel.

Laat de startknop in de projectmap staan. Bij de eerste start worden de Node-pakketten geïnstalleerd en wordt het dashboard gebouwd. Daarna opent Financiën in je standaardbrowser. De server blijft lokaal draaien wanneer je de browser sluit. De gebruikelijke poort is 4317. Als die bezet is, probeert de startknop 4318 tot en met 4326.

Als het besturingssysteem de startknop blokkeert, kun je dezelfde app vanuit de projectmap starten. Bij een startfout via de startknop kan `.private/launcher.log` meer informatie geven.

```bash
npm ci
npm run build
npm start
```

Open [het dashboard](http://127.0.0.1:4317/) of volg de URL in de terminal.

## Eerste afschrift importeren

Open **Bronnen & import** en voeg een PDF-afschrift toe. De huidige PDF-import ondersteunt rekeningafschriften en creditcardoverzichten van **Rabobank**. Controleer na import of de periode en afschrifttotalen kloppen. Ga naar **Vermogen** om per rekening een bekend eindsaldo en de bijbehorende datum vast te leggen. Daarmee kan de app het saldo op andere dagen berekenen op basis van de beschikbare afschriften. [Eerste inrichting](START-HIER.md) · [Importhandleiding](docs/paginas/bronnen-en-import.md)

## AI-chat en geheugen

Het dashboard en PDF-import werken zelfstandig. Wil je AI gebruiken, installeer dan **Codex CLI** of **Claude Code**, open **AI-chat**, selecteer je provider en klik op **CLI verbinden**. De app test de koppeling met een fictieve vraag. Je kunt daarna het model en redeneerniveau kiezen uit de opties van de gekozen CLI.

De snelle chat rechtsonder krijgt de actieve pagina en relevante selectie mee. Het gesprek wordt lokaal bewaard. Gebruik **‘Onthoud dat …’** voor een voorkeur die bij volgende vragen en rapportages kan worden gebruikt. Onder **AI-chat → Lokaal geheugen** zie je je voorkeuren en kun je die verwijderen. **Wis gesprek** leegt de gesprekshistorie. Classificatie bij import en wijzigingen door de chat schakel je zelf in. [AI-chat-handleiding](docs/paginas/ai-chat.md)

## Rapportages

Open **Rapportages** en vraag bijvoorbeeld *‘Waar gaat het meeste van mijn geld naartoe?’* of *‘Hoe ontwikkelt mijn banksaldo zich als ik zes maanden € 600 per maand wil sparen?’* De spaargrafiek vergelijkt je gebruikelijke uitgavenpatroon, het effect van voorgestelde aanpassingen en het scenario waarin je het doel haalt. Het advies houdt rekening met recente uitgaven en beschermt vaste lasten, zorg en bestaande abonnementen. Open het rapport onder **Eerdere rapporten** en kies welke grafieken meegaan via **Download PDF**.

Rapportages ondersteunen een verbonden Codex- of Claude Code-CLI en **Lokaal** via Ollama. Voor de lokale optie kun je na installatie van Ollama bijvoorbeeld `ollama pull qwen3:1.7b` uitvoeren. De berekeningen zijn ook beschikbaar via `npm run --silent report`. [Rapportages-handleiding](docs/paginas/rapportages.md) · [Eerdere spaarscenario’s](docs/paginas/spaardoelen.md)

## Jouw gegevens

Een nieuwe installatie begint leeg. Originele afschriften blijven op hun eigen locatie. De app bewaart geïmporteerde boekingen, instellingen, rapporten, gesprekken en geheugen standaard in `.private/financien.sqlite`. Gebruik een eigen projectmap of een aparte `FINANCIEN_DATA_DIR` per gebruiker. Gebruik afzonderlijke accounts op een gedeelde computer om die mappen met toegangsrechten af te schermen. Neem bij een privéverhuizing alleen je eigen datamap mee via een afgeschermde kopie.

Het dashboard en de database draaien op je eigen apparaat. Als je Codex of Claude Code gebruikt, kan de provider je vraag, relevante paginacontext, voorkeuren en gericht opgevraagde gegevens ontvangen. Als je AI-classificatie bij import aanzet, kan die provider de benodigde boekingsvelden ontvangen. De PDF zelf wordt lokaal gelezen. [Opslag en instellingen](docs/systeem.md#projectkennis-en-persoonlijke-opslag)

## Ontwikkeling en documentatie

`src/` bevat het dashboard en de financiële berekeningen. `server/` bevat de API, SQLite-opslag, import en AI-koppelingen. Gebruik `npm run dev` om te ontwikkelen, `npm run check` voor typecontrole en tests en `npm run build` voor de productiebuild.

De [paginawijzer](docs/systeem.md#paginawijzer) beschrijft alle schermen. In [AGENTS.md](AGENTS.md) staan de instructies voor Codex en Claude Code. De [publicatiehandleiding](docs/publiceren.md) legt uit hoe je een broncodekopie maakt en controleert voordat je die deelt.
