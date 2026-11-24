# Eerder opgeslagen spaarscenario’s

Eerder opgeslagen plannen zijn lokaal bewaard. Open een plan met de bestaande link `#goals/<plan-id>`. Gebruik [Rapportages](rapportages.md) voor nieuw spaaradvies. Een scenario laat zien hoeveel maandelijks naar een doel gaat, wat er vrij blijft en welk tekort op de einddatum kan ontstaan. Een opgeslagen scenario blijft per plan-ID beschikbaar.

## Welke keuze maakt AI?

- Vraag naar doelbedrag, begin- en eindmaand, reeds gespaard bedrag en het gewenste vrije maandbedrag. Kies met de gebruiker afgeleid inkomen of een opgegeven netto maandinkomen.
- Gebruik alleen volledige afschriftmaanden van alle geïmporteerde rekeningen, vóór de analysemaand. Er is minstens één volledige maand nodig. Afgeleid inkomen gebruikt de mediaan van salaris en terugkerende toeslagen uit maximaal drie maanden. Gewone uitgaven gebruiken maximaal zes maanden en periodieke posten maximaal twaalf.
- Sluit alleen bevestigde eenmalige uitgaven uit, samen met de gekoppelde retouren en kosten. Werkboekingen, kruisposten en losse betaalverzoekteruggaven vallen buiten de begrotingsraming. Vaste lasten en zorg zijn beschermd tegen verlaging via een budgetplafond.
- Reken het scenario eerst door en bespreek de uitkomst. Bewaar het als de gebruiker dat vraagt. Gebruik hetzelfde plan-ID voor een aanpassing en een nieuw ID voor een variant.

## Terminal

`npm run plan` leest JSON op stdin. Voeg `-- --save` toe om de plannen te bewaren. Bedragen zijn in hele eurocenten.

| Veld | Invullen |
| --- | --- |
| `analysisDate` | Analysedatum als `YYYY-MM-DD`. |
| `income` | Optionele opgave van het netto maandinkomen. |
| `oneOffs` | Optionele lijst met `label` en `ids` van bevestigde aankopen. |
| `plans` | Lijst met `id`, `title`, `target`, `startMonth` en `endMonth` per plan. Maanden zijn `YYYY-MM`. |
| Opties per plan | `saved`, `reserve`, `provision` met `label` en `monthly`, en `caps` per categorie met `monthly` en `action`. |

## Code

[goals.tsx](../../src/features/goals.tsx) toont opgeslagen plannen binnen Rapportages. [savings-request.ts](../../server/savings-request.ts) valideert invoer, [savings-baseline.ts](../../src/domain/savings-baseline.ts) maakt de begrotingsraming en [savings-projection.ts](../../src/domain/savings-projection.ts) rekent het verloop naar de einddatum door.
