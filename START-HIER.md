# Richt Financiën in

Volg [Downloaden en openen](README.md#downloaden-en-openen) voor je eerste start. Een schone installatie krijgt een eigen lege datamap. Je kunt afschriften importeren en het dashboard gebruiken zonder AI-provider. In **AI-chat** kun je de aangemelde Codex of Claude Code CLI kiezen. Klik op de tegel van de provider die je wilt gebruiken. Kies het model en redeneerniveau dat je wilt gebruiken. Vraag de chat om je te helpen bij je eerste import, of doorloop deze introductie in je gewone AI-assistent. Je kunt vragen overslaan en voorkeuren later aanpassen.

Gebruik de [paginawijzer](docs/systeem.md#paginawijzer) om per scherm te zien wat de opties doen. Een assistent die je vanuit de projectmap start, vindt daar ook de bijbehorende code en opdrachten.

## Optioneel: verbind de AI-CLI

**Wil je Codex of Claude Code in Financiën gebruiken?**

Als je deze introductie met een lokale assistent doorloopt, laat die de gekozen koppeling uitvoeren en testen. Vanuit de projectmap voert de assistent een van deze opdrachten uit.

```bash
npm run ai -- verbind codex
npm run ai -- verbind claude
```

Kies één opdracht voor je actieve chat. Je kunt ook in **AI-chat** op de tegel van de gewenste provider klikken en **CLI verbinden** kiezen. De app zoekt op dit apparaat naar de CLI. Voltooi de officiële browseraanmelding als die nodig is. Met **Open inlogscherm** open je de link die de CLI bij deze aanmelding heeft gemaakt. Zodra het model de testvraag beantwoordt, staat er **Verbonden · model getest**.

## 1. Afschriften en periode

**Welke betaalrekeningen en creditcards wil je meenemen, en hoe ver wil je terugkijken?**

Begin met de periode die je wilt analyseren. Voor inzicht in jaarlijkse kosten is minstens een jaar aan afschriften handig. Exporteer de boekingen als PDF en neem zowel je betaalrekening als je creditcard mee over zo veel mogelijk dezelfde periode. Voeg de bestanden toe onder **Bronnen & import** of via **AI-chat → Afschriften importeren**. Zet **Classificatie bij import** aan en kies Codex of Claude Code als je geselecteerde boekingen door die provider wilt laten beoordelen. Als je losse of overlappende afschriften hebt, verwerkt de app herkende dubbele boekingen één keer.

Bekijk met AI de afschriftperioden en de aansluiting met de debet- en credittotalen. Ontbreken afschriften voor een bron, dan kan die maand onvolledig zijn voor de spaarraming. Kies **Filters → Datumbereik verfijnen → Hele afschriftperiode** om ook het deel vóór dit kalenderjaar te bekijken.

## 2. Kruisposten en retouren

**Tussen welke eigen rekeningen verplaats je geld? Gebruik je een creditcard die via je betaalrekening wordt afgerekend?**

Kaartafrekeningen, bijstortingen en herkende overboekingen tussen eigen rekeningen zijn kruisposten. Je vindt ze via **Overzicht → Bekijk kruisposten**. Ze dragen nul bij aan inkomsten, uitgaven en spaarruimte. De aankopen op de creditcard tellen als uitgaven. Controleer met AI onder **Te controleren** of dubieuze tegenrekeningen echt van jou zijn. Hetzelfde bedrag op twee boekingen is onvoldoende om een koppeling te bevestigen.

Een winkelretour verlaagt de netto-uitgaven in de boekingsmaand. Een betaalverzoek kan het terugontvangen deel van gedeelde kosten zijn. Geef bij twijfel aan welke aankoop of afspraak erbij hoort.

## 3. Categorieën, tags en dashboard

**Passen de standaardcategorieën? Wil je iets hernoemen, uitlichten of volgen met een tag? Wil je standaard het nieuwste afschriftjaar of alle jaren zien?**

Bekijk **Categorieën** voor de indeling, het **Categorie-dashboard** voor aanbieders en maandtotalen en **Transacties** voor de originele boekingen. Met de filters kies je een periode, rekening, categorie, transactietype of tag. Werkboekingen kun je in de persoonlijke analyse zichtbaar maken met de werkfilter of een tagselectie.

Een eigen tag, zoals `Vakantie` of `Gedeeld huishouden`, helpt bij terugzoeken. Automatische tags zoals `Retour`, `Retour ontvangen`, `Geld teruggekregen`, `Vaste lasten` en `Zorgkosten` volgen uit de indeling en koppelingen. Bij meerdere gekozen tags verschijnt een boeking zodra één gekozen tag past.

> Geef de twee boekingen van deze reis de tag Vakantie. Laat me zien om welke boekingen het gaat.

## 4. Abonnementen en vaste lasten

**Wat wil je standaard zien op Abonnementen? Wil je gas, water en licht erbij, of laat je die standaard uit?**

Open **Abonnementen → Soorten kosten**. Je kunt elk van deze keuzes apart aan- of uitzetten.

- **Persoonlijke abonnementen** zoals streaming, software of een sportclub.
- **Werkdeclaraties** voor terugkerende kosten die je als werk hebt gemarkeerd.
- **Vaste lasten** voor andere herkende terugkerende lasten, zoals verzekeringen of telecom.
- **Gas, water & licht** voor herkende terugkerende energiekosten en water. Deze keuze werkt ook wanneer **Vaste lasten** uit staat.

Bij een nieuwe installatie staan persoonlijke abonnementen aan. De andere soorten staan uit. Kies **Recent** voor diensten met een recente betaling of **Alles** voor de herkende betalingen in de gekozen periode. Je voorkeur wordt lokaal bewaard. De keuze op deze pagina beïnvloedt de weergave en totalen op **Abonnementen**. Gas, water en licht blijven gewoon meetellen bij je uitgaven en begroting.

Vergelijk het werkelijke totaal met de maandindicatie. De app toont een maandindicatie zodra er voldoende vergelijkbare maanden zijn. Als je een terugkerende betaling mist, kun je AI vragen om de juiste boekingen een abonnementsnaam te geven of een herkenningsregel voor volgende afschriften te maken.

> Toon in Abonnementen persoonlijke abonnementen en gas, water en licht. Zet werkdeclaraties en overige vaste lasten uit. Laat de periode op Alles staan.

## 5. Werkdeclaraties en ontvangen vergoedingen

**Welke kosten zijn voor werk? Hoe herken jij de bijschrijvingen die je werkgever of opdrachtgever vergoedt?**

Zeg expliciet tegen AI dat een bijschrijving een werkvergoeding is. Noem de boekingsdatum, tegenpartij of het bedrag. AI zet de ontvangst in **Declaraties & vergoedingen** met de tag `Declareren werk`. De app toont er vervolgens `Vergoeding ontvangen` bij. Voor een uitgave kun je de status **Te declareren**, **Ingediend** of **Vergoed** doorgeven. De laatste status geeft de uitgave de tag `Vergoed`.

> De bijschrijving van € 63 op 14 oktober is een werkvergoeding. Zet het treinkaartje van 8 oktober op Vergoed. Pas dit alleen op die boekingen toe.

Een werkgever kan verschillende uitgaven samen vergoeden. Zeg daarom welke uitgaven op **Vergoed** mogen. Als één ontvangst salaris én vergoeding bevat, geef AI de bekende verdeling door. Voor de verwerking blijft er één bronboeking. Met *“herken dit voortaan”* kun je een specifieke terugkerende regel bevestigen.

## 6. Rapportages en spaarscenario’s

**Waar wil je voor sparen, tegen wanneer en hoeveel heb je al apart gezet? Wil je rekenen met inkomen uit je afschriften of met een opgegeven maandbedrag?**

Voor een raming is minstens één volledige afschriftmaand nodig. Vul in [Vermogen](docs/paginas/vermogen.md) per rekening een bekend eindsaldo en de datum daarvan in als je het verwachte banksaldo in de grafiek wilt zien. Bespreek met AI welke bevestigde eenmalige aankopen buiten de raming mogen, welk bedrag je per maand vrij wilt houden en welke uitgaven je kunt aanpassen. Vaste lasten, zorg en bestaande abonnementen blijven in de begroting. De app gebruikt recent gedrag om bespaarvoorstellen te toetsen. Beschrijf je vraag onder **Rapportages**. Een gegenereerd rapport staat onder **Eerdere rapporten** en is als PDF te downloaden. Voor een totaalbedrag kun je erbij zetten wanneer je het bij elkaar wilt hebben.

> Laat in een grafiek zien hoe mijn banksaldo zich ontwikkelt als ik zes maanden € 150 per maand wil sparen. Vergelijk dat met mijn gebruikelijke uitgaven.

Open **AI-chat** om een terugkerende voorkeur te bewaren, bijvoorbeeld *‘Onthoud dat ik eerst de vermogensgrafiek wil zien bij spaarrapporten.’* De chat en je uitgesproken voorkeuren worden lokaal opgeslagen. Onder **Lokaal geheugen** kun je zien wat er is bewaard en een voorkeur vergeten. [Geheugen en paginacontext](docs/paginas/ai-chat.md#paginacontext-en-lokaal-geheugen)
