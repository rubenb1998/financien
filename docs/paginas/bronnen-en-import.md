# Bronnen & import

Route `#sources`. De knop **Importeren** rechtsboven opent deze pagina. Hetzelfde importformulier staat in **AI-chat → Afschriften importeren**. Elke bronkaart toont de afschriftperiode, het aantal afschriftregels en de debet- en credittotalen. **Saldi beheren** opent Vermogen voor een saldo-invoer per bankrekening.

De huidige import ondersteunt rekeningafschriften en creditcardoverzichten van Rabobank in PDF-formaat. De [installatiestappen](../../README.md#downloaden-en-openen) beschrijven de benodigde Python-omgeving.

## Welke keuze maakt AI?

1. Vraag welke Rabobank-betaalrekeningen en creditcards de gebruiker wil meenemen. Begin bijvoorbeeld met ongeveer anderhalf jaar aan PDF-afschriften over zoveel mogelijk dezelfde periode. Controleer dekking per rekening en let op gaten. Een oudste en nieuwste datum kan tussenliggende gaten bevatten.
2. Importeer via het formulier of met `npm run import -- afschrift.pdf`. De parser vergelijkt de gelezen bedragen met de afschrifttotalen inclusief kruisposten en telt het aantal gelezen boekingen. Stabiele boekings-ID’s voorkomen dubbele opslag bij herimport of herkende overlap. Controleer eerst **Bekijk boekingen** en de kruisposten bij een onverwacht totaal.
3. Kies op het formulier **Zonder AI**, **Codex** of **Claude Code**, en zo gewenst een model. Het originele PDF-bestand wordt lokaal gelezen. De gekozen CLI krijgt de benodigde boekingsvelden voor beoordeling, zoals datum, bedrag, omschrijving en beschikbare categorieën. De terminalopdracht voor PDF-import verwerkt het afschrift met de gewone app-regels. Voor modelclassificatie kun je daarna op de bronkaart **Beoordeel met AI** kiezen.
4. De app bewaart een gevalideerd afschrift vóór de modelbeoordeling. Ze slaat handmatige correcties, kruisposten, onbesliste boekingen, werkboekingen, gekoppelde retouren en specifieke lokale regels over bij AI-classificatie. Na een onderbreking kan **Classificatie hervatten** of **Beoordeel met AI** verder met nog onbeoordeelde boekingen. Controleer onzekere voorstellen onder [Te controleren](te-controleren.md).

## Code

- [sources.tsx](../../src/features/sources.tsx) bevat het formulier en bronoverzicht. [api.ts](../../server/api.ts) valideert de upload en start optioneel een AI-taak.
- [rabobank.py](../../server/importers/rabobank.py) leest de PDF, [pdf.ts](../../server/pdf.ts) roept de parser aan en [store.ts](../../server/store.ts) schrijft het afschrift en de boekingen.
- [classify.ts](../../server/ai/classify.ts) maakt de importprompt, valideert de antwoorden en bewaart voltooide groepen. [ledger.ts](../../src/domain/ledger.ts) bepaalt welke boekingen geschikt zijn en past de voorstellen toe.
