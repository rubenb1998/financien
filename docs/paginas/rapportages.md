# Rapportages

Route `#reports`. Kies **Uitgaven** voor inzicht in een periode, categorie of aanbieder. Kies **Spaarscenario** voor een maandbedrag of geef een totaalbedrag met een eindmaand. Als de eindmaand ontbreekt, vraagt de chat ernaar. De app rekent de benodigde maandinleg uit. Onder **Eerdere rapporten** staan de opgeslagen analyses en de PDF-download. Je bepaalt welke grafieken meegaan.

Een spaaradvies houdt vaste lasten, zorg en abonnementen in de begroting. Het rapport toont maximaal vier voorstellen voor losse uitgaven. Bij gemengde categorieën wordt alleen het deel zonder abonnement als beïnvloedbaar beschouwd. Bespaarvoorstellen gebruiken de beschikbare volledige maanden in het laatste kwartaal. Bij een duidelijke daling over drie volledige maanden past de prognose de gewone uitgaven aan en rekent ze die daling mee in het uitgangsscenario. Voor oude of sporadische uitgaven is er geen extra maandelijkse besparing. Periodieke reserveringen blijven staan. Los getoonde abonnementsopties zijn maandindicaties. Een abonnement levert pas ruimte op zodra het stopt of een lager tarief is bevestigd.

De vermogensgrafiek vergelijkt het gebruikelijke patroon, het effect van de voorgestelde aanpassingen en een scenario waarin het maanddoel volledig wordt gehaald. Als een gezamenlijk referentiesaldo beschikbaar is, begint de grafiek bij dat bedrag op de laatst beschikbare datum. Bij ontbrekende saldi toont ze de verandering ten opzichte van de uitgangspositie. De projectie gebruikt standaard zes maanden bij een maanddoel en loopt bij een totaalbedrag zo mogelijk tot de opgegeven eindmaand. De projectie gaat uit van netto geld dat per maand overblijft. Voor gewone uitgaven gebruikt de berekening maximaal zes volledige afschriftmaanden en voor periodieke posten maximaal twaalf.

## AI-provider

Kies Codex, Claude Code of Lokaal. Wanneer je een CLI hebt verbonden, stelt Financiën die provider voor. Model en redeneerniveau komen uit de beschikbare opties van de CLI. De CLI-keuze geldt ook in [AI-chat](ai-chat.md). Bij gebruik van Codex of Claude krijgt die provider je vraag, relevante lokale chatvoorkeuren en de context die nodig is om een rapport samen te stellen. Je beheert bewaarde voorkeuren in [Lokaal geheugen](ai-chat.md#paginacontext-en-lokaal-geheugen). Boekingsregels, saldi en berekeningen blijven lokaal.

Voor **Lokaal** installeer en start je Ollama en haal je bijvoorbeeld `qwen3:1.7b` op met `ollama pull qwen3:1.7b`. Met `FINANCIEN_REPORT_MODEL` kun je een specifiek lokaal model kiezen. Als `qwen3:1.7b` al in `report-models` binnen de datamap staat, kan Financiën Ollama zelf starten met de cloudfunctie uitgeschakeld. Is er geen geschikt model beschikbaar, gebruik dan **Kopieer voor AI-chat** en plak de vraag in de assistent die je vanuit deze projectmap hebt geopend. Een opgeslagen resultaat verschijnt onder **Eerdere rapporten**.

## Terminal

Geef JSON via stdin aan `npm run --silent report`. Gebruik `question` en `mode` met de waarde `spending` of `saving`. Geef voor een spaaradvies ook `target` in hele eurocenten op. Gebruik optioneel `projectionMonths` van 1 tot en met 24 en kies de grafiek `projection` voor het banksaldo. Lees eerst de uitkomst en kies passende grafieken uit `availableCharts`. Voer dezelfde opdracht met `-- save` uit om het rapport lokaal op te slaan. Gebruik `-- save <id>` om een bestaande rapportage op hetzelfde adres bij te werken. De volledige invoer staat in [AGENTS.md](../../AGENTS.md#rapportages-in-financiën).

## Code

[reports.tsx](../../src/features/reports.tsx) toont de chat en opgeslagen rapporten. [server/reports.ts](../../server/reports.ts) verwerkt vragen en secties. [report-savings.ts](../../server/report-savings.ts) bepaalt het maanddoel en vraagt zo nodig de eindmaand uit. [Domeinberekeningen](../../src/domain/reports.ts) rekenen met de gecategoriseerde boekingen. [report-spending-pattern.ts](../../src/domain/report-spending-pattern.ts) verwerkt recente uitgaven in de begroting en voorstellen. [report-pdf.ts](../../server/report-pdf.ts) rendert de PDF.
