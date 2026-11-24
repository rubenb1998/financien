# Categorie-dashboard

Route `#category-dashboard`. Kies een hoofdgroep, subcategorie of verzameling voor maandtotalen, aantallen betalingen en aanbieders. **Bekijk boekingen** opent de doorlopende lijst binnen dezelfde selectie. Via een aanbieder kun je wisselen tussen diens totale activiteit en activiteit binnen de gekozen categorie.

Kies boven of naast het dashboard een periode. Jaar en kwartaal tonen maanden. Een maand toont dagen. Categorieën en zoekfilters beperken de boekingen in de vaste schermonderdelen. Via de aanbieder en **Bekijk boekingen** zoom je in.

## Welke keuze maakt AI?

- Leg bij een vergelijking vast of de gebruiker bedragen of aantallen bedoelt en welke periode, categorie en aanbieder gelden. Een aanbieder kan tegelijk boekingen in meerdere categorieën hebben.
- Een retour verlaagt de netto-uitgaven. Een gekoppelde koersopslag kan meetellen in het bedrag bij de aanbieder. Retouren en koersopslag tellen elk nul mee als afzonderlijke aankoop.
- Gebruik voor het samenvoegen van aanbieders in deze weergave `display.providerAliases`. Controleer eerst welke namen bij dezelfde aanbieder horen. Een correctie van de achterliggende bronboeking loopt via [Transacties](transacties.md).

## Code

- [category-dashboard.tsx](../../src/features/category-dashboard.tsx) verwerkt het bereik en kiest omzetting naar bedragen of aantallen. [provider-dashboard.tsx](../../src/features/provider-dashboard.tsx) toont het aanbiederdetail.
- [merchant-breakdown.ts](../../src/domain/merchant-breakdown.ts) groepeert aanbieders en berekent netto, aantallen en gemiddelde. [routes.ts](../../src/routes.ts) bouwt en leest routes naar categorieën, aanbieders en boekingen. [routes.test.ts](../../tests/routes.test.ts) dekt de navigatie naar detailweergaven.
