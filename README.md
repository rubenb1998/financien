# Financiën

Een lokaal financieel dashboard voor één gebruiker. Importeer Rabobank-afschriften, bekijk je uitgaven en bespreek met AI hoe je boekingen, abonnementen, declaraties en spaardoelen wilt verwerken.

## Starten

Installeer Node.js 24 of nieuwer en haal deze repository op. Open de startknop van je systeem vanuit de projectmap.

- **macOS.** Dubbelklik op **Financiën.app** en sleep de app vanuit Finder naar je Dock om hem vast te zetten.
- **Windows.** Dubbelklik op **Financien.exe**. Klik met rechts op de startknop en kies **Aan taakbalk vastmaken**. In Windows 11 staat die optie zo nodig onder **Meer opties weergeven**.

De startknop installeert bij de eerste start de Node-pakketten, bouwt het dashboard en opent het in je standaardbrowser. De lokale server blijft draaien als je de browser sluit. De volgende klik gebruikt dezelfde server. Laat de startknop in de projectmap staan. Bij een startfout staan eventuele installatiedetails in `.private/launcher.log`.

Je kunt het dashboard ook handmatig starten vanuit deze map.

```bash
npm ci
npm run build
npm start
```

Na `npm start` open je het lokale dashboard op poort 4317. De startknop kiest automatisch een andere lokale poort als die poort bezet is. [Lokaal dashboard](http://127.0.0.1:4317/)

### PDF-import instellen

Installeer Python 3 en voer deze eenmalige installatie uit als je afschriften wilt importeren.

**macOS**

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
```

**Windows**

```powershell
py -3 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

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

`npm run check` voert de typecontrole en tests uit. De workflow **Start op macOS en Windows** test ook de eerste start, het hergebruik van de achtergrondserver en de PDF-parser op beide systemen. Voor ontwikkeling start je de app met `npm run dev`.
