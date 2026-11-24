# Financiën

Een lokaal financieel dashboard voor één gebruiker. Importeer Rabobank-afschriften, bekijk je uitgaven en bespreek met AI hoe je boekingen, abonnementen, declaraties en spaardoelen wilt verwerken.

## Starten

Installeer Node.js 24 of nieuwer en Python 3. Open een terminal in deze map.

```bash
npm ci
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
npm run build
npm start
```

Open **Financiën** op je computer. [Lokaal dashboard](http://127.0.0.1:4317/)

Op macOS kun je daarna ook **Start Financiën.command** openen. Op Windows gebruik je `py -3 -m venv .venv` en `.venv\Scripts\python.exe -m pip install -r requirements.txt`.

## Samen met AI instellen

Open deze projectmap in een AI-assistent met toegang tot lokale bestanden en een terminal. Begin met deze opdracht.

> Lees AGENTS.md en START-HIER.md. Richt Financiën samen met mij in. Stel de vragen één voor één en leg uit hoe ik via jou boekingen kan indelen, vergoedingen kan doorgeven en een spaardoel kan doorrekenen.

Je kunt PDF-afschriften toevoegen via **Bronnen & import**. Begin bijvoorbeeld met ongeveer anderhalf jaar van je betaalrekening en creditcard over dezelfde periode. Meer over de volgorde en keuzes staat in de introductie. [START-HIER.md](START-HIER.md)

## Opslag en delen

De eerste start maakt een leeg lokaal profiel aan. Je boekingen, correcties en plannen staan in `.private/financien.sqlite`. AI leest je bevestigde voorkeuren in `.private/profiel.md`. Automatische persoonlijke regels staan in `.private/regels.json`. Je oorspronkelijke afschriften blijven op de plek waar je ze bewaart.

De app draait op localhost. Een AI-assistent met cloudverwerking kan de context ontvangen die hij leest. Deel voor een vraag alleen de relevante boekingen of totalen en geef expliciet aan wanneer je volledige afschriften wilt laten lezen.

Deel openbaar de broncode en de generieke Markdown-bestanden. Houd de volledige lokale datamap en je afschriften privé. Gebruik bij een eigen datamap via `FINANCIEN_DATA_DIR` een pad buiten de Git-checkout.

## Verder werken

- [Systeemwerking en opdrachten](docs/systeem.md)
- [Werkinstructies voor AI](AGENTS.md)

`npm run check` voert de typecontrole en tests uit. Voor ontwikkeling start je de app met `npm run dev`.
