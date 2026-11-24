# Te controleren

Route `#review`. De transactietabel toont hier alleen boekingen met een controlemarkering. De teller op de pagina onderscheidt de actieve selectie van alle openstaande controles. Het transactiedetail toont de reden en eventueel **Gebruik voorstel**.

## Welke keuze maakt AI?

1. Zoek gericht met `npm run boeking -- zoek --controle`, desgewenst met datum, bedrag of tekst. Bekijk de bronbeschrijving, huidige categorie en eventuele koppeling.
2. Vergelijk een AI-voorstel met de afschriftinformatie en de uitleg van de gebruiker. Bij lage zekerheid toont de app het voorstel naast de bestaande indeling. Voor kruisposten of vergoedingen kan bevestiging van de gebruiker nodig zijn.
3. Gebruik voor een bevestigde indeling **Bevestig indeling** in het transactiedetail of de [correctieopdracht](transacties.md#terminal). Laat een boeking met onvoldoende informatie open staan en benoem welke informatie ontbreekt.
4. Als de gebruiker wil dat nieuwe vergelijkbare boekingen voortaan hetzelfde behandeld worden, volg de [lokale regels](../systeem.md#lokale-voorkeuren-en-regels). Een individuele correctie blijft gelden voor die ene boeking.

## Code

[app.tsx](../../src/app.tsx) filtert op `review`, [transactions.tsx](../../src/features/transactions.tsx) toont en bewaart de gekozen indeling, [ledger.ts](../../src/domain/ledger.ts) verwerkt voorstellen en correcties. [ai.test.ts](../../tests/ai.test.ts) dekt voorgestelde categorieën en het behoud van bestaande correcties.
