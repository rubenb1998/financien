# Systeemwerking

Financiën verwerkt Rabobank-PDF's voor betaalrekeningen en creditcards in een dashboard op localhost. SQLite bewaart de genormaliseerde afschriftgegevens en stabiele boekings-ID’s. Bedragen staan in hele eurocenten. Gebruik [START-HIER.md](../START-HIER.md) voor de eerste inrichting.

## Paginawijzer

| Scherm | Route | Handleiding |
| --- | --- | --- |
| Overzicht | `#overview` | [Totalen, filters, retouren en kruisposten](paginas/overzicht.md) |
| Vermogen | `#wealth` | [Saldi, dekking, spaarruimte en vaste lasten](paginas/vermogen.md) |
| Transacties | `#transactions` | [Boekingen zoeken, tags en correcties](paginas/transacties.md) |
| Categorieën | `#categories` | [Indeling, labels en herkenningsregels](paginas/categorieen.md) |
| Categorie-dashboard | `#category-dashboard` | [Perioden, aanbieders en boekingsdetails](paginas/categorie-dashboard.md) |
| Abonnementen | `#subscriptions` | [Terugkerende kosten, gas, water en licht](paginas/abonnementen.md) |
| Rapportages | `#reports` | [Uitgavenrapporten, spaarscenario’s en PDF](paginas/rapportages.md) |
| Declaraties | `#work` | [Werkuitgaven, statussen en vergoedingen](paginas/declaraties.md) |
| AI-chat | `#chat` | [Codex, Claude Code, modeltest, paginacontext en privégeheugen](paginas/ai-chat.md) |
| Te controleren | `#review` | [Onzekere indelingen en AI-voorstellen](paginas/te-controleren.md) |
| Bronnen & import | `#sources` | [PDF-import, overlap en modelclassificatie](paginas/bronnen-en-import.md) |

## Van afschrift naar dashboard

1. [server/pdf.ts](../server/pdf.ts) roept de Rabobank-parser aan. [server/store.ts](../server/store.ts) bewaart afschriften, ruwe boekingen, handmatige correcties, AI-beoordelingen en voorkeuren afzonderlijk.
2. `buildLedger()` in [ledger.ts](../src/domain/ledger.ts) verwerkt bronboekingen met de algemene en lokale regels. Het voegt toegestane AI-indelingen toe, past correcties toe en koppelt kruisposten, retouren en koersopslag. Handmatige correcties hebben voorrang en blijven bij herimport behouden.
3. [server/api.ts](../server/api.ts) levert de verwerkte boekingen en presentatievoorkeuren. [app.tsx](../src/app.tsx) filtert die voor het actieve scherm. [pages.ts](../src/domain/pages.ts) bevat de schermnamen en [routes.ts](../src/routes.ts) koppelt de URL aan een scherm of detailweergave.
4. De terminalopdrachten in [package.json](../package.json) hergebruiken de domeinlogica en opslag. Gebruik de bestaande opdrachten of de app om persoonlijke boekingen te wijzigen. Controleer bij wijzigingen in de AI-workflows ook de afzonderlijke chat- en importprompts in [server/ai/](../server/ai).

## Projectkennis en persoonlijke opslag

[AGENTS.md](../AGENTS.md) bevat de gedeelde werkinstructies. [CLAUDE.md](../CLAUDE.md) laadt die instructies voor Claude Code. De schermdocumentatie beschrijft algemene werking die elke installatie kan gebruiken. Pas de betrokken schermhandleiding aan als een functionaliteit, bestandsroute of beslisregel verandert.

| Opslag | Inhoud |
| --- | --- |
| Lokaal `profiel.md` | Voor de terminalassistent leesbare notities met bevestigde persoonlijke afspraken. |
| Lokaal `regels.json` | Uitvoerbare classificatie-, aanbieder-, werk- en weergaveregels. |
| Lokaal `financien.sqlite` | Boekingen, individuele correcties, rapporten, spaarscenario’s, saldi, spaarpercentage, abonnementsweergave en AI-keuzes zoals provider, chatgeschiedenis en bevestigde chatvoorkeuren. |

De standaarddatamap is `.private`. De app en terminal gebruiken dezelfde datamap wanneer ze met dezelfde `FINANCIEN_DATA_DIR` starten. Houd een aangepaste datamap buiten de Git-checkout. Afschriften, persoonlijke bestanden en voorbeelden met echte gegevens blijven privé. Gebruik fictieve bedragen en namen in de documentatie en tests. Gebruik voor GitHub de [publicatiehandleiding](publiceren.md).

## Lokale voorkeuren en regels

Het dashboard, `npm run plan` en `npm run report` gebruiken dezelfde uitvoerbare regels uit `regels.json`. De terminalassistent kan `profiel.md` raadplegen voor achtergrond bij die keuzes. Gebruik `npm run instellingen -- geheugen` voor bevestigde voorkeuren uit de dashboardchat. De app valideert `regels.json` bij het laden. Na het wijzigen van dit bestand controleer je het met `npm run instellingen` en herlaad je het dashboard. `npm run instellingen -- categorieen` toont de beschikbare categorie-ID’s.

Alle velden hieronder zijn optioneel behalve `version`. Voeg regels alleen toe voor bevestigde afspraken.

| Veld | Betekenis |
|---|---|
| `version` | Gebruik `1`. |
| `classifications` | Lijst met `match` en `result`. Het resultaat bevat `kind` en `category`, eventueel met `merchant`, `subscription`, `reason`, `review`, `tags` of `claimStatus`. De eerste passende regel wint na de automatische herkenning van zekere kruisposten. |
| `merchants` | Lijst met `pattern` en `category`, eventueel met `name` en `evidence`. Lokale patronen krijgen voorrang op de algemene aanbiederscatalogus. |
| `subscriptions` | Lijst met `pattern`, `name` en `category` om een dienst expliciet als abonnement te herkennen. |
| `work` | Lijst met voorwaarden voor automatische tagging van werkkosten. Gebruik bijvoorbeeld `merchant`, `category`, `subscription` of `minAbsoluteAmount`. |
| `display` | `period` is `latestYear` of `allTime`. `labels` hernoemt categorieën op basis van hun ID. `collections` groepeert categorieën uit één hoofdgroep met `label` en `categories`. Met `featuredCollection` licht je er één uit op het overzicht. `providerAliases` groepeert aanbieders onder een gezamenlijke naam. |

Gebruik bij een tabblad met actieve filters **Filters → Datumbereik verfijnen → Hele afschriftperiode** om direct de volledige afschriftperiode te zien. De profielkeuze `allTime` geldt als startweergave zonder eerder ingestelde filters. Jaar-, kwartaal- en maandselectie staan bij Periode. Een maandgrafiek toont dagen. Een kwartaal- of jaargrafiek toont maanden.

Patronen in `merchant`, `details`, `sender`, `exceptDetails` en `pattern` zijn reguliere expressies zonder onderscheid in hoofdletters. `sender` kan een afzender uit een Rabobank-betaalverzoek gebruiken. Extra voorwaarden zijn `source` (`bank` of `card`), `code`, `exceptCode`, `date`, `before`, `amount`, `minAmount`, `maxAmount` en `minAbsoluteAmount`. Datums hebben de vorm YYYY-MM-DD. Afgeschreven bedragen zijn negatief.
