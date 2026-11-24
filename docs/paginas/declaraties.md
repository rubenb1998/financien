# Declaraties

Route `#work`. De pagina toont boekingen met de tag `Declareren werk`. Ze laat netto werkkosten, ontvangen vergoedingen en het bedrag **Te declareren** afzonderlijk zien. Open een werkuitgave om de declaratiestatus bij te werken.

## Welke keuze maakt AI?

- Vraag bij een onbekende bijschrijving expliciet of het een werkvergoeding is. Controleer datum, tegenpartij en bedrag. Een mogelijke vergoeding bij AI-import blijft een voorstel in [Te controleren](te-controleren.md).
- Bevestig een werkvergoeding als `kind: income` en `category: reimbursement` met de tag `Declareren werk`. De app toont vervolgens de automatische tag `Vergoeding ontvangen`.
- Vraag voor welke werkuitgaven de ontvangst geldt. Eén vergoeding kan meerdere uitgaven dekken. Zet alleen de bevestigde uitgaven op `paid` (**Vergoed**). Andere statussen zijn `toSubmit` (**Te declareren**) en `submitted` (**Ingediend**).
- Vraag om de uitsplitsing als één ontvangst zowel salaris als vergoeding bevat. Bespreek de verwerking met de gebruiker. Het huidige model bewaart één transactietype en categorie per bronboeking.

## Terminal

Zoek de ontvangst eerst op zoals bij [Transacties](transacties.md#terminal). Pas de volgende gedeeltelijke correctie toe op het bevestigde ID. Als je `tags` weglaat, voegt de opdracht de werk-tag toe met behoud van bestaande handmatige tags.

```bash
npm run boeking -- corrigeer BOEKING-ID <<'JSON'
{"kind":"income","category":"reimbursement"}
JSON
```

## Code

[work-claims.tsx](../../src/features/work-claims.tsx) berekent de schermtotalen, [work.ts](../../src/domain/work.ts) definieert de werk-tag en statussen, [tags.ts](../../src/domain/tags.ts) leidt de aanvullende tags af en [booking-correction.ts](../../server/booking-correction.ts) valideert declaratiecorrecties vanuit chat en terminal.
