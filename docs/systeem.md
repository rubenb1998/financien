# Systeemwerking

Financiën leest Rabobank-PDF's voor betaalrekening en creditcard. Het dashboard draait op localhost. SQLite bewaart de genormaliseerde gegevens en stabiele boekings-ID’s. Bedragen staan in hele eurocenten.

## Import, indeling en koppelingen

- **Bronnen & import** bewaart de afschriftperiode en controleert de debet- en credittotalen. Importeer via het dashboard of met `npm run import -- afschrift.pdf`. Originele bestanden blijven op hun eigen locatie. Herkende overlappende boekingen worden eenmaal opgenomen.
- De app herkent kaartafrekeningen en eigen overboekingen op onder meer Rabobank-codes, omschrijvingen en geïmporteerde rekeningen. Kruisposten tellen nul mee in de financiële analyses. Voor gegroepeerde bank- en kaartboekingen zoekt de app naar bedragen met tegengesteld teken op verschillende rekeningen binnen een tijdvenster. Dubbelzinnige koppelingen vragen controle.
- Bekende aanbieders en lokale regels helpen bij het indelen. **Te controleren** toont boekingen met onvoldoende zekerheid. Individuele correcties hebben voorrang en blijven staan bij herimport.
- Bij retouren gebruikt de app bijvoorbeeld tegenpartij of retourtekst, tegengesteld bedrag en boekingsdatum. Een gekoppelde retour verlaagt de netto-uitgaven in de maand waarin het geld terugkomt. Kaartkoersopslag kan de categorie, het abonnement en de tags van de oorspronkelijke kaartbetaling volgen.
- Een tag is een filter of werkkenmerk. Het transactietype en de categorie bepalen hoe een boeking meetelt. De tag `Declareren werk` markeert een werkboeking. **Vergoed** is de status van een werkuitgave, **Vergoeding ontvangen** hoort bij een bevestigde declaratiebijschrijving. Gebruik de app of de boekingsopdracht om een ontvangen werkvergoeding expliciet te bevestigen.

## Abonnementen en weergave

De pagina toont persoonlijke abonnementen, werkdeclaraties, overige vaste lasten en gas, water en licht als afzonderlijke weergavekeuzes. De categorie-ID voor energie en water is `utilities`. Een aanbieder verschijnt bij een herkenbare abonnementsnaam of, voor bepaalde vaste lasten, bij een sterk terugkerend incassopatroon. Een maandindicatie vereist minstens drie vergelijkbare maandbedragen. De werkelijke totalen gebruiken de geselecteerde boekingen na retouren.

Onder **Soorten kosten** en **Recent / Alles** worden de keuzes lokaal bewaard. Lees ze met `npm run instellingen -- abonnementen`. Om via AI bijvoorbeeld alleen persoonlijke abonnementen en nutsvoorzieningen te tonen, geef je dit aan de opdracht door op stdin.

```bash
npm run instellingen -- abonnementen --save <<'JSON'
{"types":["personal"],"period":"all","includeUtilities":true}
JSON
```

Geldige kostensoorten zijn `personal`, `work` en `fixed`. `includeUtilities` schakelt gas, water en licht onafhankelijk in. `period` is `all` of `recent`. Kosten kunnen verborgen worden op deze pagina en blijven beschikbaar voor de normale uitgavenanalyse. De overige filters zijn toegankelijk in de zijbalk van het dashboard.

## Voor AI en de terminal

Zoek de relevante boeking. Zonder zoekterm kun je op datum, bedrag of controlemarkering zoeken. De terminal geeft maximaal dertig resultaten en het aantal gevonden boekingen.

```bash
npm run boeking -- zoek "Werkgever" --datum 2026-10-14 --bedrag=6300
```

Kopieer het ID van de bevestigde boeking en voer een gedeeltelijke correctie in als JSON op stdin.

```bash
npm run boeking -- corrigeer BOEKING-ID <<'JSON'
{"kind":"income","category":"reimbursement"}
JSON
```

De boekingsopdracht voegt bij een bevestigde vergoeding de werk-tag toe wanneer je het tagveld weglaat. Als je `tags` zelf opgeeft, geef je de volledige gewenste lijst op. Bij een uitgave met de tag `Declareren werk` kun je `claimStatus` instellen op `toSubmit`, `submitted` of `paid`. Een vergoeding kan meerdere uitgaven betreffen. Als een bijschrijving salaris en vergoeding combineert, vraag eerst om de bedragen en bespreek een passende verwerking. Een individuele bankboeking heeft één transactietype.

## Lokale voorkeuren en regels

Het dashboard en `npm run plan` gebruiken hetzelfde lokale profiel. `.private/profiel.md` bevat samenvattingen in gewone taal. `.private/regels.json` wordt bij het laden gevalideerd. Na het wijzigen van dit bestand controleer je het met `npm run instellingen` en herlaad je het dashboard. `npm run instellingen -- categorieen` toont de beschikbare categorie-ID’s.

Alle velden hieronder zijn optioneel behalve `version`. Voeg regels alleen toe voor bevestigde afspraken.

| Veld | Betekenis |
|---|---|
| `version` | Gebruik `1`. |
| `classifications` | Lijst met `match` en `result`. Het resultaat bevat `kind` en `category`, eventueel met `merchant`, `subscription`, `reason`, `review`, `tags` of `claimStatus`. De eerste passende regel wint na de automatische herkenning van zekere kruisposten. |
| `merchants` | Lijst met `pattern` en `category`, eventueel met `name` en `evidence`. Lokale patronen krijgen voorrang op de algemene aanbiederscatalogus. |
| `subscriptions` | Lijst met `pattern`, `name` en `category` om een dienst expliciet als abonnement te herkennen. |
| `work` | Lijst met voorwaarden voor automatische tagging van werkkosten. Gebruik bijvoorbeeld `merchant`, `category`, `subscription` of `minAbsoluteAmount`. |
| `display` | `period` is `latestYear` of `allTime`. `labels` hernoemt categorieën op basis van hun ID. `collections` groepeert categorieën uit één hoofdgroep met `label` en `categories`. Met `featuredCollection` licht je er één uit op het overzicht. `providerAliases` groepeert aanbieders onder een gezamenlijke naam. |

Gebruik bij een tabblad met actieve filters **Filters → Periode → Alles** om direct de volledige afschriftperiode te zien. De profielkeuze `allTime` geldt als startweergave zonder eerder ingestelde filters.

Patronen in `merchant`, `details`, `sender`, `exceptDetails` en `pattern` zijn reguliere expressies zonder onderscheid in hoofdletters. `sender` kan een afzender uit een Rabobank-betaalverzoek gebruiken. Extra voorwaarden zijn `source` (`bank` of `card`), `code`, `exceptCode`, `date`, `before`, `amount`, `minAmount`, `maxAmount` en `minAbsoluteAmount`. Datums hebben de vorm YYYY-MM-DD. Afgeschreven bedragen zijn negatief.

## Spaarscenario’s

`npm run plan` leest JSON via stdin en rekent de aanvraag door met lokale boekingen. Met `npm run plan -- --save` bewaar je het resultaat. Gebruik hetzelfde plan-ID om een scenario te actualiseren. Gebruik een nieuw ID voor een variant.

Geef `analysisDate` (YYYY-MM-DD), optioneel `income` en `oneOffs` met `label` en boekings-ID’s op, plus een lijst `plans`. Elk plan heeft `id`, `title`, `target`, `startMonth` en `endMonth` (YYYY-MM). Optionele velden zijn `saved`, `reserve`, `provision` met `label` en `monthly`, en `caps` per uitgavencategorie met `monthly` en `action`.

De raming gebruikt alleen volledige maanden voor alle meegenomen rekeningen, voorafgaand aan de analysemaand. Met afgeleide inkomsten gebruikt de app de mediaan van salaris en terugkerende toeslagen uit maximaal drie volledige maanden. Gewone uitgaven gebruiken maximaal zes maanden. Periodieke kosten gebruiken maximaal twaalf maanden. Bevestigde eenmalige uitgaven en bijbehorende retouren worden uitgesloten van de raming. Werkboekingen, kruisposten en losse betaalverzoekteruggaven vallen buiten die raming. Vaste lasten en zorg zijn beschermde begrotingsposten.
