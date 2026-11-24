# Categorieën

Route `#categories`. Het overzicht groepeert inkomsten en netto-uitgaven per hoofd- en subcategorie binnen de actieve selectie. Een groep of categorie opent het [Categorie-dashboard](categorie-dashboard.md).

## Welke keuze maakt AI?

- Gebruik `npm run instellingen -- categorieen` voor bestaande categorie-ID’s, labels en hoofdgroepen. Controleer bij een correctie ook het transactietype. Het type bepaalt welke categorieën beschikbaar zijn.
- Vraag of de gebruiker één boeking anders wil indelen, een bestaand label wil hernoemen of een patroon voortaan automatisch wil herkennen. Een boekingscorrectie, een label en een classificatieregel hebben elk een ander effect.
- Gebruik het lokale `display.labels` voor een persoonlijk label en `display.collections` voor een eigen verzameling categorieën uit één hoofdgroep. Noteer een bevestigde automatische indeling als een specifiek patroon in `regels.json`. [Formaat van lokale regels](../systeem.md#lokale-voorkeuren-en-regels)
- Controleer bij een onbekende aankoop welke aanwijzing er in de omschrijving staat. Een marktplaats of supermarkt kan uiteenlopende soorten aankopen hebben. Gebruik [Te controleren](te-controleren.md) zolang de aard van de aankoop onzeker is.

## Code

[categories.tsx](../../src/features/categories.tsx) toont de groepen. [categories.ts](../../src/domain/categories.ts) definieert de ID’s, groepen en beschikbare categorieën per type. [classify.ts](../../src/domain/classify.ts) deelt bronboekingen in. [profile.ts](../../server/profile.ts) valideert lokale regels en presentatie.
