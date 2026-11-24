# Abonnementen

Route `#subscriptions`. **Soorten kosten** bepaalt welke terugkerende betalingen hier zichtbaar zijn. De opties zijn **Persoonlijke abonnementen**, **Werkdeclaraties**, **Vaste lasten** en **Gas, water & licht**. Een nieuwe installatie toont persoonlijke abonnementen en gebruikt **Alles**.

## Welke keuze maakt AI?

- Vraag bij de setup expliciet of gas, water en licht zichtbaar moeten zijn. `includeUtilities` schakelt nutsvoorzieningen onafhankelijk van overige vaste lasten. De keuze beïnvloedt dit scherm. De uitgaven en begroting blijven de onderliggende boekingen gebruiken.
- Vraag of de gebruiker **Recent** of **Alles** wil. Recent gebruikt de laatste betaling ten opzichte van de laatste afschriften van de betrokken rekeningen. Alles toont ook eerder betaalde diensten binnen de geselecteerde periode.
- Maak onderscheid tussen geboekt totaal na retouren, geschat maandbedrag en twaalf keer dat maandbedrag. Een maandbedrag vereist minstens drie vergelijkbare maandbedragen. Voor bepaalde vaste lasten kan een sterk maandritme volstaan om een dienst te herkennen.
- Ontbreekt een bekende dienst, zoek de betrokken boekingen op. Bevestig een abonnementsnaam op de relevante boekingen of maak na bevestiging een lokale herkenningsregel voor volgende afschriften.

## Terminal

Lees met `npm run instellingen -- abonnementen` en behoud keuzes die de gebruiker niet wil aanpassen. De opslagopdracht verwacht de volledige weergave. Dit fictieve voorbeeld toont persoonlijke abonnementen en nutsvoorzieningen.

```bash
npm run instellingen -- abonnementen --save <<'JSON'
{"types":["personal"],"period":"all","includeUtilities":true}
JSON
```

Geldige `types` zijn `personal`, `work` en `fixed`. `period` is `recent` of `all`.

## Code

[subscriptions.tsx](../../src/features/subscriptions.tsx) voor het scherm, [subscriptions.ts](../../src/domain/subscriptions.ts) voor terugkerende posten en ramingen, [subscription-view.ts](../../src/domain/subscription-view.ts) voor kostenfilters en [preferences-cli.ts](../../server/preferences-cli.ts) voor de terminal.
