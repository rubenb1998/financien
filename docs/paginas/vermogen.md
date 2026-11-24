# Vermogen

Route `#wealth`. Het scherm toont het laatst berekende banksaldo per rekening, het saldoverloop en spaarruimte op basis van volledige afschriftmaanden. De kaart op Overzicht toont maximaal 90 dagen. Op Vermogen kies je 90, 180 of 365 dagen voor het saldoverloop of gebruik je het filterpaneel.

## Filters

- Kies een jaar, kwartaal, maand of datumbereik onder **Periode**. **Volledige periode** toont alle beschikbare saldodatums en alle volledige afschriftmaanden. Bij een expliciete periode volgt het saldoverloop de gekozen dagen waarvoor een saldo bekend is. De kaarten en grafieken bij **Sparen & vaste lasten** gebruiken de volledig gedekte, afgeronde maanden die binnen de selectie vallen.
- Kies onder **Rekening** één bankrekening of **Alle rekeningen** voor het saldoverloop. De lijst **Bankrekeningen** blijft het laatst bekende saldo per rekening tonen en geeft toegang tot de saldo-instellingen. Voor spaarruimte blijven alle relevante afschriften, inclusief creditcardaankopen, meetellen.
- Gebruik **Wis filters** om terug te gaan naar de gebruikelijke periodes. De filters van Vermogen staan los van de selectie op Overzicht en Transacties.

## Saldo en datum

- Vul per bankrekening het saldo aan het einde van een gekozen dag in. Gebruik bijvoorbeeld het eindsaldo op het meest recente afschrift. Kies **Wijzigen** om het referentiebedrag of de datum te corrigeren.
- De app telt getekende bronboekingen op de eigen bankrekening. Een overboeking tussen twee opgenomen rekeningen verandert elk rekeningsaldo. Een creditcardafrekening en een gestorte declaratievergoeding tellen mee via de bankboeking. Een declaratiestatus verandert het berekende bedrag pas als de betaling in de brongegevens staat.
- De app rekent vooruit en terug zolang afschriften aansluiten. Het totaal gebruikt één gezamenlijke datum. Ontbrekende instelsaldi en ontbrekende afschriftdekking zijn zichtbaar. Bij handmatige rekeningen geldt de ingevoerde datum tot een bankafschrift kan worden gekoppeld.
- **Saldo instellen**, **Rekening toevoegen**, **Wijzigen** en **Afschriften koppelen** veranderen lokaal opgeslagen gegevens. Vraag de gebruiker altijd om rekening, datum en bedrag wanneer die gegevens ontbreken. Gebruik geen geschat startsaldo.

## Sparen en vaste lasten

Het spaarpercentage staat boven de grafieken. Op brede schermen beginnen en eindigen Verdeling vaste lasten en Spaarruimte per maand op dezelfde hoogte. Op smalle schermen staan de kaarten onder elkaar.

- Zonder periodefilter gebruikt de app maximaal zes recente volledige afschriftmaanden. Het netto maandinkomen is het gemiddelde geregistreerde salaris plus toeslagen. Persoonlijke netto-uitgaven omvatten ook creditcardaankopen. Werkuitgaven, werkvergoedingen en kruisposten vallen buiten de persoonlijke spaarruimte.
- Vermenigvuldig het gemiddelde maandinkomen met het opgeslagen spaarpercentage. De grafiek gebruikt dat ene bedrag als horizontale doelreferentie. De balken tonen per maand wat werkelijk overbleef.
- De verdeling van vaste lasten omvat de hoofdcategorieën Vaste lasten en Abonnementen. Het spaarpercentage is een algemeen doel. Voor een nieuw spaarscenario met een prognose van je banksaldo ga je naar [Rapportages](rapportages.md).

## Code

- [wealth.ts](../../src/domain/wealth.ts) berekent dekking, saldi en spaarruimte. [wealth.tsx](../../src/features/wealth.tsx) toont de inzichten. [wealth-charts.tsx](../../src/features/wealth-charts.tsx) tekent de horizontale spaardoellijn.
- [balance-editor.tsx](../../src/features/balance-editor.tsx) bevat het saldoformulier. [store.ts](../../server/store.ts) bewaart referenties en het spaarpercentage. De dashboardchat krijgt de gekozen periode en bankrekening mee en kan vermogensinzichten lezen via `lookup.scope = 'wealth'` in [chat.ts](../../server/ai/chat.ts).
