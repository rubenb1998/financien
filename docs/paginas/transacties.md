# Transacties

Route `#transactions`. Zoek op tekst, periode, rekening, type, categorie of tag. Open een rij voor de afschrifttekst, indelingsreden, eventuele koppeling en de correctievelden. De routes voor één afschrift, abonnement of kruispost beperken de selectie verder.

## Welke keuze maakt AI?

- Zoek eerst op datum, aanbieder en bedrag. Vraag welke boeking bedoeld is als er meerdere overeenkomen. Bedragen voor de terminal zijn hele eurocenten met het teken van de bronboeking.
- Wijzig de indeling via een correctie op het stabiele boekings-ID. Laat bedrag, datum en originele afschrifttekst als brongegevens staan. Als het bronbedrag afwijkt, controleer het originele afschrift en de import.
- Gebruik een tag om herkenbare boekingen terug te vinden. Meerdere gekozen tags werken met **één of meer van deze tags**. Automatische tags volgen bijvoorbeeld uit een retourkoppeling, de categorie of de declaratiestatus. Bewaar bestaande eigen tags als je er één toevoegt.
- Controleer bij een kruispost de eigen rekeningen, soort boeking en datums. Automatische koppeling zoekt onder herkende kruisposten naar een unieke passende tegenboeking op een andere rekening met omgekeerd bedrag binnen vier dagen. Waar de koppeling dubbelzinnig is, laat de app de regels los staan.
- Bespreek bij een onbekende bijschrijving of het om een retour, gedeelde terugbetaling, werkvergoeding, salaris of iets anders gaat. Zie ook [Declaraties](declaraties.md).

## Terminal

```bash
npm run boeking -- zoek "Voorbeeldwinkel" --datum 2026-01-15 --bedrag=-2500
npm run boeking -- corrigeer BOEKING-ID <<'JSON'
{"kind":"expense","category":"groceries"}
JSON
```

De zoekopdracht toont het totale aantal en maximaal dertig resultaten. Correcties zijn gedeeltelijk. Geef je `tags` mee, lever dan de volledige gewenste lijst van handmatige tags aan. Gebruik **Automatische indeling herstellen** in de app om een bestaande correctie te verwijderen.

## Code

[transactions.tsx](../../src/features/transactions.tsx) voor tabel en dialoog, [matching.ts](../../src/domain/matching.ts) voor kruisposten, retouren en koersopslag, [tags.ts](../../src/domain/tags.ts) voor tagfilters en [booking-correction.ts](../../server/booking-correction.ts) voor correcties vanuit chat en terminal.
