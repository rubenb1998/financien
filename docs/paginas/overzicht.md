# Overzicht

Route `#overview`. Hier zie je netto-uitgaven, inkomsten en het verschil voor de actieve selectie. Een jaar of kwartaal toont maanden. Een gekozen maand toont de boekingen per dag. De kaart bovenaan toont het bekende banksaldo op zijn eigen saldodatum. **Bekijk kruisposten** onderaan opent de interne overboekingen in Transacties.

## Welke keuze maakt AI?

1. Controleer bij een vraag over een totaal eerst periode, rekening en eventuele categorie- of tagfilters. Geef in het antwoord aan welke selectie je gebruikt. **Filters → Datumbereik verfijnen → Hele afschriftperiode** opent de volledige afschriftperiode. **Wis filters** bewaart de gekozen periode.
2. Gebruik voor netto-uitgaven de afschrijvingen min de retouren in hun eigen boekingsmaand. Gebruik voor inkomsten de externe bijschrijvingen met type `income`. Kruisposten en onbesliste boekingen dragen aan beide totalen nul bij.
3. Werkboekingen vallen standaard buiten de persoonlijke cijfers. **Werkdeclaraties meetellen** of een actieve tagselectie kan ze zichtbaar maken. Controleer [de afschriftdekking](bronnen-en-import.md) voordat je een maand met weinig boekingen of een deelmaand vergelijkt.
4. Lees **Verschil** als inkomsten min netto-uitgaven in deze selectie. Gebruik [Vermogen](vermogen.md) voor banksaldo en een algemeen spaarpercentage, en [Rapportages](rapportages.md) voor nieuwe spaarscenario’s.

## Code

- [overzichtsscherm](../../src/features/overview.tsx) toont de cijfers en koppelt ze aan categorieën en kruisposten.
- [app.tsx](../../src/app.tsx) bepaalt de selectie voor de kaarten, trend en verdeling. [dashboard-navigation.ts](../../src/hooks/dashboard-navigation.ts) beheert de navigatie en filters.
- [ledger.ts](../../src/domain/ledger.ts) bevat `filterLedger`, `netSpend` en `summarize`. [analytics.ts](../../src/domain/analytics.ts) aggregeert dezelfde boekingen per maand, categorie en hoofdgroep.
