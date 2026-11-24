# Werken met Financiën

Lees [de systeemdocumentatie](docs/systeem.md) en, indien aanwezig, het persoonlijke geheugen in `.private/profiel.md`. Begin bij een nieuwe gebruiker met [START-HIER.md](START-HIER.md). Het dashboard werkt lokaal voor één gebruiker.

## Boekingen en analyses

- Gebruik `npm run boeking -- zoek` om relevante boekingen op te vragen. Geef waar mogelijk een datum, tekst of bedrag mee. Vraag door als meerdere boekingen passen of de betekenis onzeker is.
- Gebruik de app of `npm run boeking -- corrigeer ID` om een bevestigde correctie op te slaan. Geef in gewone taal terug wat er in het dashboard is veranderd.
- Bewaar een afspraak voor toekomstige boekingen wanneer de gebruiker dat bevestigt. Gebruik het profiel voor context en `.private/regels.json` voor uitvoerbare regels. Beperk een regel tot de herkenbare boekingen waarvoor die bedoeld is. Valideer met `npm run instellingen` en controleer de toepassing met `npm run boeking -- zoek`.
- Controleer bij imports de dekking, afschrifttotalen en kruisposten voordat je inkomsten, uitgaven of spaarruimte interpreteert.
- Bevestig via de gebruiker of een ontvangst een retour, gedeelde terugbetaling, werkvergoeding of salaris is als dat onduidelijk is. Een uitgave krijgt de status `paid` als de gebruiker aangeeft welke uitgave vergoed is. Vraag bij gemengde ontvangsten om een uitsplitsing. Het huidige gegevensmodel bewaart één type per boeking.
- Gebruik `npm run plan` om een spaarscenario te berekenen. Controleer samen de periode, het inkomen, eenmalige uitgaven en voorgestelde budgetten. Voeg `-- --save` toe als de gebruiker het scenario wil bewaren.
- Gebruik persoonlijke gegevens alleen voor de gevraagde taak. Houd volledige afschriften, boekingsdetails, identificatoren, plannen en profielbestanden buiten publieke code, tests, Git, documentatie en gedeelde voorbeelden.

## Voorkeuren

Bewaar korte, bevestigde voorkeuren in `.private/profiel.md`. Bewaar uitvoerbare classificatie en standaardweergave in `.private/regels.json`. Keuzes onder **Abonnementen → Soorten kosten** en **Recent / Alles** staan in de lokale database. Lees of wijzig die met `npm run instellingen -- abonnementen`.

Bij een wijziging in de standaardapp controleer je `npm run check` en `npm run build`. Werk de generieke Markdown-documentatie bij als de systeemwerking of werkwijze voor gebruikers verandert.
