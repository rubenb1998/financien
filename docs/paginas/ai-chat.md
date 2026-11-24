# AI-chat

Route `#chat`. De pagina en de knop rechtsonder delen hetzelfde gesprek, conceptbericht en de keuze om wijzigingen toe te staan. Klik op de Codex- of Claude Code-tegel. Kies daarna een model en redeneerniveau uit de lijst van die CLI. Dezelfde CLI-keuze geldt in Rapportages. **Actief** geeft de selectie aan. **Verbonden · model getest** betekent dat het model ook een testvraag heeft beantwoord.

## Welke keuze maakt AI?

- Gebruik **CLI verbinden** om op hetzelfde apparaat de geïnstalleerde provider te zoeken en te testen. Bij een nieuwe aanmelding opent de CLI zijn officiële browseraanmelding. **Open inlogscherm** gebruikt de tijdelijke link van diezelfde poging. De app test het model na de aanmelding met een fictieve vraag.
- Gebruik vanuit de projectmap `npm run ai -- verbind codex` of `npm run ai -- verbind claude` om dezelfde provider via de terminal in te stellen. `npm run ai -- status` toont de aanmelding en teststatus. Gebruik `npm run ai -- controleer` voor een afzonderlijke modeltest. Kies desgewenst `--model` en `--effort`.
- De dashboardchat gebruikt gerichte zoekopdrachten voor transacties, overzicht, vermogen, abonnementen, bronnen, rapporten, opgeslagen spaarscenario’s, declaraties en onzekere boekingen. Specificeer bij feitelijke vragen een periode, aanbieder of bedrag. Vraag door bij onduidelijkheid. Open [Rapportages](rapportages.md) voor een downloadbaar uitgavenrapport of spaaradvies.
- Geef voor een bewerking een expliciete opdracht en schakel **Wijzigingen toestaan** in. In het kleine venster heet dit **Bewerken toestaan**. De app ondersteunt boekingscorrecties, abonnementsweergave en het bewaren van spaarscenario’s. Doorrekenen kan ook met alleen lezen. **Laatste correctie terugdraaien** is beschikbaar voor chatcorrecties op boekingen die sindsdien dezelfde correctie hebben.
- De provider en het model op het [importformulier](bronnen-en-import.md) gelden voor de beoordeling van afschriften. De actieve chatprovider kan als standaard voor import worden gekozen. Bij een schone installatie staat AI-classificatie bij import uit.

## Paginacontext en lokaal geheugen

- Open de knop rechtsonder op een dashboardpagina. Onder de titel zie je de actieve pagina. Wanneer je een bericht verstuurt, krijgt de chat ook de toepasselijke periode, categorie, aanbieder en verwijzing naar een geopend rapport of afschrift mee. Als je vraagt wat je op die pagina ziet, vraagt de chat de noodzakelijke gegevens gericht op.
- Begin een bericht met **Onthoud dat …** om een terugkerende voorkeur op te slaan, bijvoorbeeld *‘Onthoud dat ik bij een spaarrapport eerst de vermogensgrafiek wil zien.’* Een CLI-verbinding is voor het opslaan niet nodig. Onder **Lokaal geheugen** staan je voorkeuren en kun je ze met **Vergeten** verwijderen. Ze kunnen worden gebruikt bij latere gesprekken en AI-rapportages. Uitvoerbare boekingsregels beheer je afzonderlijk.
- Het chatgesprek blijft beschikbaar na sluiten en herstarten. Het model kan ook gerelateerde eerdere vragen bij een nieuw bericht betrekken. Met **Wis gesprek** leeg je de gesprekshistorie. Je bewaarde voorkeuren beheer je via **Lokaal geheugen**.
- De app bewaart het gesprek en de voorkeuren in de lokale SQLite-database. Gebruik een aparte datamap per gebruiker. Bij een verzoek via Codex of Claude Code kan die provider het bericht, actieve paginacontext, relevante eerdere vragen en voorkeuren en gericht opgehaalde cijfers ontvangen. Zie [persoonlijke opslag](../systeem.md#projectkennis-en-persoonlijke-opslag).

## Context voor beide CLI’s

Start je een gewone Codex- of Claude Code-sessie in de projectmap, dan wijst de [gedeelde projectinstructie](../../AGENTS.md) naar de documentatie en broncode.

De dashboardchat start de CLI in een tijdelijke map en geeft een gestructureerde prompt mee. De server valideert zoekopdrachten en wijzigingen en past die toe via de app. De systeemregels voor deze modus staan in `instructions()` in [server/ai/chat.ts](../../server/ai/chat.ts). Controleer die prompt wanneer een wijziging inhoudelijk gevolgen heeft voor de dashboardchat. Rekeningnummers, lange nummercodes en e-mailadressen worden waar mogelijk uit meegestuurde boekingstekst gefilterd.

## Code

[chat.tsx](../../src/features/chat.tsx) toont de provider en beide chatweergaven. [ai-conversation.ts](../../src/hooks/ai-conversation.ts) beheert de gedeelde chatstatus. [executable.ts](../../server/ai/executable.ts) zoekt de CLI, [cli.ts](../../server/ai/cli.ts) start die en [connection.ts](../../server/ai/connection.ts) verifieert het model. [models.ts](../../server/ai/models.ts) leest de modellen en niveaus uit de CLI. [context.ts](../../server/ai/context.ts) valideert de paginacontext en [memory.ts](../../server/ai/memory.ts) selecteert lokaal bewaarde voorkeuren en eerdere vragen.
