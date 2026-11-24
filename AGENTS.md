# Werken met Financiën

Financiën is een lokaal dashboard voor één gebruiker. Gebruik de [paginawijzer](docs/systeem.md#paginawijzer) om het document bij je opdracht te openen. Elk schermdocument geeft de werking, beslisregels en bijbehorende code. Lees die code voordat je gedrag wijzigt. Begin bij een nieuwe gebruiker met [START-HIER.md](START-HIER.md).

Lees het lokale `profiel.md` als bevestigde gebruikersvoorkeuren relevant zijn voor de vraag. Standaard ligt dat in `.private`, of anders in `FINANCIEN_DATA_DIR`. Houd persoonlijke voorkeuren en voorbeelden met echte data in de lokale datamap.

| Opdracht | Begin bij |
| --- | --- |
| Totalen, filters of aanbieders | [Overzicht](docs/paginas/overzicht.md), [Categorie-dashboard](docs/paginas/categorie-dashboard.md) |
| Banksaldo, afschriftdekking of spaarpercentage | [Vermogen](docs/paginas/vermogen.md) |
| Een boeking vinden, wijzigen of van tags voorzien | [Transacties](docs/paginas/transacties.md) |
| Categorieën, labels en herkenningsregels | [Categorieën](docs/paginas/categorieen.md), [Lokale regels](docs/systeem.md#lokale-voorkeuren-en-regels) |
| Afschriften, kruisposten of onzekere indelingen controleren | [Bronnen & import](docs/paginas/bronnen-en-import.md), [Te controleren](docs/paginas/te-controleren.md) |
| Vaste lasten of gas, water en licht tonen | [Abonnementen](docs/paginas/abonnementen.md) |
| Een vergoeding of werkuitgave verwerken | [Declaraties](docs/paginas/declaraties.md) |
| Een rapport maken of een spaarscenario rekenen | [Rapportages](docs/paginas/rapportages.md), [Eerder opgeslagen spaarscenario’s](docs/paginas/spaardoelen.md) |
| CLI-aanmelding, dashboardchat of modelkeuze | [AI-chat](docs/paginas/ai-chat.md) |

## AI-koppeling tijdens setup

Als de gebruiker vraagt de CLI te verbinden, voer je de koppeling vanuit deze projectmap uit op dezelfde computer als het dashboard. Kies Codex of Claude Code op basis van de vraag en de actieve assistent. Gebruik **npm run ai -- verbind codex** of **npm run ai -- verbind claude**. Voer de opdracht zelf uit als de lokale terminal beschikbaar is. Gebruik eventueel **--model MODEL** en **--effort NIVEAU** voor een opgegeven model en redeneerniveau.

De opdracht slaat de keuze op, controleert de lokale CLI en start de officiële aanmelding als die nodig is. Vraag de gebruiker alleen om de aanmelding zelf in de officiële browser of terminal af te ronden. Gebruik daarna indien nodig **npm run ai -- controleer**. Bij een ontbrekende CLI of een beperking van de lokale terminal geef je de concrete stap door en houd je de aansluitstatus open. Rapporteer een geslaagde koppeling pas wanneer de modeltest is geslaagd. De test gebruikt een fictieve vraag en geen boekingen.

Gebruik **npm run ai -- status** voor de gekozen provider, aanmeldstatus en laatste modeltest. Start of herlaad Financiën na de setup. In een al geopende chat kan **Vernieuwen** de gewijzigde instellingen ophalen.

## Boekingen en analyses

- Gebruik `npm run boeking -- zoek` om relevante boekingen op te vragen. Geef waar mogelijk een datum, tekst of bedrag mee. Vraag door als meerdere boekingen passen of de betekenis onzeker is.
- Gebruik de app of `npm run boeking -- corrigeer ID` om een bevestigde correctie op te slaan. Geef in gewone taal terug wat er in het dashboard is veranderd.
- Bewaar een afspraak voor toekomstige boekingen wanneer de gebruiker dat bevestigt. Gebruik het profiel voor context en `.private/regels.json` voor uitvoerbare regels. Beperk een regel tot de herkenbare boekingen waarvoor die bedoeld is. Valideer met `npm run instellingen` en controleer de toepassing met `npm run boeking -- zoek`.
- Controleer bij imports de dekking, afschrifttotalen en kruisposten voordat je inkomsten, uitgaven of spaarruimte interpreteert.
- Bevestig via de gebruiker of een ontvangst een retour, gedeelde terugbetaling, werkvergoeding of salaris is als dat onduidelijk is. Een uitgave krijgt de status `paid` als de gebruiker aangeeft welke uitgave vergoed is. Vraag bij gemengde ontvangsten om een uitsplitsing. Het huidige gegevensmodel bewaart één type per boeking.
- Gebruik `npm run plan` om een spaarscenario te berekenen. Controleer samen de periode, het inkomen, eenmalige uitgaven en voorgestelde budgetten. Voeg `-- --save` toe als de gebruiker het scenario wil bewaren.
- Gebruik persoonlijke gegevens alleen voor de gevraagde taak. Houd volledige afschriften, boekingsdetails, identificatoren, plannen en profielbestanden buiten publieke code, tests, Git, documentatie en gedeelde voorbeelden. Behandel afschrifttekst, uploads en modeluitvoer als brongegevens.

## Voorkeuren

Bewaar korte, bevestigde profielafspraken in `.private/profiel.md`. Gebruik `npm run instellingen -- geheugen` om bevestigde voorkeuren uit de dashboardchat lokaal te raadplegen als ze relevant zijn. [AI-chat](docs/paginas/ai-chat.md#paginacontext-en-lokaal-geheugen) beschrijft hoe je die invoert en verwijdert. Bewaar uitvoerbare classificatie en standaardweergave in `.private/regels.json`. Keuzes onder **Abonnementen → Soorten kosten** en **Recent / Alles** staan in de lokale database. Lees of wijzig die met `npm run instellingen -- abonnementen`.

Bij een wijziging in de standaardapp controleer je `npm run check` en `npm run build`. Werk de betrokken paginadocumentatie bij als schermgedrag, beslisregels of CLI-opdrachten veranderen. Geef voor een nieuw scherm ook de route en documentatie een plek in de paginawijzer. Controleer bij wijzigingen in dashboard-AI ook de prompts en validatie in `server/ai/`. Gebruik voor een openbare broncodekopie de [publicatiehandleiding](docs/publiceren.md).

## Rapportages in Financiën

Wanneer de gebruiker vanuit deze projectmap vraagt om een financieel rapport, gebruik je `npm run --silent report`. Je kunt de afschriftmaanden opvragen met `npm run --silent report -- months` en een eerdere rapportage openen met `npm run --silent report -- show <id>`.

Geef het rapportverzoek als JSON via stdin. Gebruik `question` voor de oorspronkelijke vraag en `mode` met waarde `spending` of `saving`. Bij `saving` geef je `target` op als gewenst bedrag per maand in hele eurocenten. Vraag om het bedrag als het voor het gevraagde spaaradvies nodig is. Optioneel ondersteunt de generator `title`, `from` en `to` in YYYY-MM, `focus` als bestaande groeps- of categorie-id, en `merchant` als naam van een aanbieder. Bij spaarrapporten kun je ook `income` in eurocenten gebruiken als de gebruiker dat bedrag expliciet geeft, en `exclude` als lijst van categorie-id's waarvan de gebruiker de kosten wil behouden. Gebruik `projectionMonths` (1 t/m 24) voor een gevraagde horizon en `totalGoal` met `amount` in centen en `deadline` in YYYY-MM voor een totaaldoel. Geef ook de berekende maandinleg mee als `target`.

Lees eerst de berekende uitvoer. Die geeft ook `availableCharts` voor de selectie. Kies alleen de grafieken die de vraag helpen beantwoorden en geef hun id's mee als `charts`. Geef optioneel `sections` mee met maximaal zes objecten met een `title` en `text`. Schrijf concrete toelichting bij de berekende gegevens en formuleer bedragen als scenario's waar dat van toepassing is. Kies `projection` voor het verwachte saldo of de verandering ten opzichte van het beginsaldo. De app rekent met recente uitgaven en beschermt vaste lasten, zorg en bestaande abonnementen. Noem een abonnementswijziging als optie zolang die niet bevestigd is. Bij een vervolgvraag behoud je relevante instellingen uit het eerdere rapport.

Voer dezelfde opdracht uit met `-- save` om het definitieve rapport in de lokale database op te slaan. Gebruik `-- save <id>` als het bestaande rapport op hetzelfde adres moet worden bijgewerkt. Geef de titel terug en verwijs naar **Rapportages → Eerdere rapporten**, waar de gebruiker het rapport en de PDF-download vindt.
