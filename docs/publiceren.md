# Broncode delen via GitHub

Maak vanuit de projectmap een schone kopie in een nieuwe map naast je eigen installatie.

```bash
npm run release:copy -- ../Financien-publicatie
```

De kopie bevat de broncode, testgevallen met fictieve gegevens, documentatie en startknoppen. Persoonlijke data zoals afschriften, rapporten, chatgeheugen, `profiel.md` en `regels.json` staat in je eigen datamap. Maak voor een privéverhuizing van die gegevens een afzonderlijke beveiligde kopie. Houd persoonlijke data ook buiten screenshots en bijlagen bij issues.

Zet de schone kopie in de Git-checkout die je wilt publiceren. Voer de volgende controles uit op de bestanden die je voor de commit hebt klaargezet.

```bash
git add .
npm run release:check
npm ci
npm run check
npm run build
```

De publicatiecontrole vergelijkt de Git-index met de bekende projectbestanden en zoekt naar enkele herkenbare soorten rekeningnummers en sleutels. Controleer zelf ook de wijzigingen en voorbeelden op herkenbare privé-informatie. Voer de geschiedeniscontrole apart uit als de repository eerder persoonlijke gegevens heeft bevat. Een nieuwe commit verandert oude commits niet.

Test een vers uitgepakte ZIP of clone op een lege datamap. Volg [Downloaden en openen](../README.md#downloaden-en-openen), start via de knop en controleer dat het dashboard om de eerste import vraagt. De [GitHub-workflow](../.github/workflows/launcher.yml) test de native startknop op macOS en Windows, inclusief een gescheiden datamap. Distribueer de volledige projectmap zodat de startknoppen de broncode en afhankelijkheden kunnen vinden.
