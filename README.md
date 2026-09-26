# Fortis Vastgoed — Portfolio Dashboard
## Gebruikersdocumentatie

---

## BESTANDEN

```
ambacht-dashboard/
├── index.html      ← Open dit in je browser
├── style.css       ← Huisstijl (donker thema, kleuren, fonts)
├── data.js         ← ✏️ Standaarddata (basis voor het dashboard)
├── store.js        ← Bewaart wijzigingen uit het dashboard in je browser
├── engine.js       ← Alle berekeningen (niet aanpassen)
├── dashboard.js    ← Alle views (niet aanpassen)
├── editor.js       ← Formulieren om objecten, leningen en crediteuren te beheren
├── api/lening-uitlezen.js ← Serverfunctie (Vercel): leningovereenkomst uitlezen met AI
├── package.json / vercel.json ← Instellingen voor die serverfunctie
└── README.md       ← Dit bestand
```

### Bovenbalk, accountmenu en zijbalk

- **Zijbalk:** een smalle iconenbalk die bij hover uitklapt met de namen. Via de knop onderaan
  (*Zijbalk*) kies je: *Uitklappen bij hover*, *Altijd uitgeklapt* of *Ingeklapt*.
- **Accountmenu** (rondje rechtsboven) → *Account*: profielfoto, naam, e-mail en functie, plus het
  dashboard zelf: eigen logo, naam en label in de bovenbalk. Verder in het menu: changelog, pagina afdrukken,
  thema (*Systeem*, *Donker*, *Licht*), tijdzone en de gegevensknoppen (exporteren, importeren, herstellen).
- Profiel en voorkeuren worden in je browser bewaard. Er is (nog) geen echte login.

### Navigatie

| Menu | Inhoud |
|---|---|
| Management | KPI's, actieve meldingen, kasverloop 24 maanden, pipeline |
| Liquiditeit | Cashflow forecast (incl. crediteurbetalingen), tabel 12 maanden, cash per entiteit |
| ↳ Crediteuren | Alle partijen die betaald moeten worden: status, deadlines, prio, schuifruimte, betaalregelingen, betaalplanning |
| Portefeuille | Objectoverzicht, NOI/LTV, planning & timeline, scenario's & stress testing |
| ↳ Objecten | Per object: kengetallen, huurcontracten, leningen en documenten met checklist |
| Financiering | Leningen, maturity, bouwtranches, covenant monitoring |
| Waardering | Waardering, value bridge, sensitivity, exit readiness & risico |
| Groepsstructuur | Organogram (klik op een entiteit voor details) |
| Eigenaren | Look-through belang per eigenaar, equity calls |

### Objecten en leningen beheren in het dashboard

- **Portefeuille → + Object toevoegen**, of klik op een rij om een object te wijzigen of te verwijderen.
  Per object vul je in: algemene gegevens, waarde & IRR, exploitatiekosten per jaar en huurcontracten.
- **Financiering → + Lening toevoegen**, of klik op een rij om een lening te wijzigen of te verwijderen.
- Wijzigingen worden direct doorgerekend in alle schermen (KPI's, meldingen, forecast, covenants).

**Waar worden wijzigingen bewaard?** In je browser (localStorage). Ze zijn dus alleen zichtbaar
op dit apparaat en in deze browser, en verdwijnen als je browsergegevens wist of een privévenster gebruikt.

In het accountmenu rechtsboven (onder *Gegevens*):

| Knop | Wat het doet |
|---|---|
| Exporteer data.js | Downloadt alle data, inclusief je wijzigingen, als nieuw `data.js` |
| Importeer bestand | Laadt een eerder geëxporteerd bestand (bijv. op een ander apparaat) |
| Herstel demo-data | Wist je wijzigingen in deze browser en gaat terug naar `data.js` |

**Wijzigingen voor iedereen vastleggen:** exporteer `data.js`, vervang het bestand in de repository en
push naar `main`. Daarna ziet iedereen dezelfde data. Klik daarna in het accountmenu op *Herstel demo-data*, zodat je
browser de nieuwe `data.js` gebruikt in plaats van je lokale kopie.

### Leningovereenkomst uploaden (AI)

In het formulier **Lening toevoegen / wijzigen** staat bovenaan *Leningovereenkomst uploaden*
(PDF, JPG of PNG, max. 3 MB; slepen kan ook). De AI (Claude) leest het document en vult de velden in:

- **Groen** = letterlijk gevonden · **Geel** = controleren · **Rood** = onzeker of afgeleid
- Onder elk veld staat de passage uit het document waar de waarde vandaan komt
- Het object wordt gekoppeld via het adres van het onderpand; overige bepalingen (ICR, boeterente,
  rentevastperiode, zekerheden) verschijnen onderaan het formulier
- Er wordt **niets opgeslagen** tot je zelf op *Opslaan* klikt. Het document zelf wordt nergens bewaard.

**Eenmalig instellen (verplicht):**
1. Maak een API-sleutel aan op https://console.anthropic.com (Settings → API keys) en zet er tegoed op.
2. Vercel → je project → *Settings → Environment Variables* → voeg `ANTHROPIC_API_KEY` toe met die sleutel
   (Production én Preview).
3. Deploy opnieuw (Deployments → ⋯ → *Redeploy*), anders is de sleutel nog niet actief.

Kosten: ongeveer € 0,05–0,30 per document, afhankelijk van het aantal pagina's.
De functie werkt alleen op de online Vercel-versie, niet als je `index.html` lokaal opent.

### Objecten en documenten

Onder **Portefeuille → Objecten** staat per object een kaart met waarde, NOI, LTV en hoeveel
kerndocumenten er zijn. Klik op een object voor de detailpagina:

- Kengetallen, huurcontracten en gekoppelde leningen
- **Documenten**: sleep bestanden in het vak of klik *Documenten toevoegen* (meerdere tegelijk, max. 50 MB
  per bestand). De soort (taxatierapport, koopovereenkomst, leningovereenkomst, huurovereenkomst, kadaster,
  energielabel, verzekering, …) wordt geraden uit de bestandsnaam en is aan te passen via ✎, net als de
  documentdatum en een notitie. Klik op de naam om het document te openen.
- **Checklist kerndocumenten** laat zien wat er nog ontbreekt (afhankelijk van de status van het object,
  of er een lening of huurcontract is, enz.)

**Let op:** documenten worden in de browser opgeslagen (IndexedDB), dus alleen op dit apparaat en in deze
browser. Ze gaan niet mee in *Exporteer data.js*. Gebruik *Download alles* op de objectpagina als back-up.

### Crediteuren

Onder **Liquiditeit → Crediteuren** staan alle partijen die betaald moeten worden. Toevoegen via
**+ Crediteur toevoegen**, wijzigen door op een rij te klikken.

| Veld | Betekenis |
|---|---|
| Status | Open · Betaalregeling · Incasso · Faillissementsaanvraag dreigt · Betaald |
| Deadline | Uiterste betaaldatum. Bij een betaalregeling telt de *volgende termijn* |
| Prioriteit | Hoog / Middel / Laag |
| Schuifruimte + max. uitstel | Of (en hoeveel dagen) de betaling kan schuiven |
| Betaalregeling | Termijnbedrag per maand, volgende termijn, resterende termijnen |

**Dossier per crediteur.** Klik op **Betalen** naast een melding (ook op het Management-scherm) of op een
rij in de tabel. Het dossier toont:

- **Eerst te betalen**: bedrag, uiterste datum en waarom (termijn van de regeling, volledig bedrag bij
  incasso/faillissement, of de facturen die vóór de deadline vervallen)
- **Betaalgegevens**: IBAN, ten name van, betalingskenmerk (met kopieerknop)
- **Betalen vanuit**: per BV die op de facturen staat het openstaande bedrag en of de vrije kas van die BV
  voldoende is
- **Facturen** (nummer, BV op factuur, factuur-/vervaldatum, bedrag, open) — toevoegen/wijzigen/verwijderen
- **Betaalregeling**: resterende termijnen · **Betalingen**: historie · **Documenten**: facturen, aanmaningen,
  sommaties, brieven (opgeslagen in de browser)
- **Betaling registreren**: boekt af op de oudste (of gekozen) factuur, schuift de betaalregeling een termijn
  op en zet het dossier op *Betaald* als alles voldaan is

**Wanneer krijg je een melding?** Deadlines worden vergeleken met de datum van *vandaag*.

- **Kritiek (nu betalen):** faillissementsaanvraag dreigt · incasso met deadline ≤ 7 dagen ·
  niet-schuifbaar en deadline ≤ 7 dagen · deadline ≤ 3 dagen · ook na maximaal uitstel te laat
- **Aandacht:** deadline ≤ 14 dagen · incasso · over de deadline maar nog binnen de uitstelruimte

Kritieke en aandacht-posten verschijnen ook bij *Actieve meldingen* op het Management-scherm, en het
aantal kritieke posten staat als rood getal naast *Crediteuren* in het menu. Met **Browsermeldingen
aanzetten** krijg je maximaal één keer per dag een melding van je browser wanneer je het dashboard opent.
Een melding terwijl het dashboard dicht is (e-mail/push) vraagt om een server en zit er nog niet in.

Crediteurbetalingen (termijnen van regelingen en openstaande bedragen op de deadline) worden
meegenomen in de liquiditeitsforecast (kolom *Crediteuren*).

### Velden voor het Management-scherm

| Veld | Waar in data.js | Effect |
|---|---|---|
| `meta.bedrijfsnaam` / `meta.subtitel` | `meta` | Naam en ondertitel linksboven |
| `meta.peildatum` | `meta` | Maand in de subtitel en startpunt van de forecast |
| `meta.kasaldo_vorige_maand` | `meta` | "▲ +€124k vs mrt" onder Kasaldo vandaag (optioneel) |
| `objecten[].irr_pct` | `objecten` | Portefeuille IRR (gewogen op marktwaarde) |

---

## HOE HET DASHBOARD GEBRUIKEN

1. **Open `index.html`** in Chrome, Firefox of Edge
2. Geen server nodig — werkt direct als lokaal bestand
3. Navigeer via de linkerzijbalk

---

## HANDMATIGE AANPASSINGEN — WAT WANNEER?

### Maandelijks (15 minuten werk)

| Wat aanpassen | Waar in data.js | Hoe |
|---|---|---|
| Kasstand bijwerken | `kasstand[]` | Verander `saldo` per entiteit |
| Huidig saldo leningen | `leningen[].huidig_saldo` | Verminder met maandelijkse aflossing |
| Status bouwtranche | `bouw_tranches[].status` | Verander "gepland" naar "getrokken" |
| Peildatum | `meta.peildatum` | Huidige datum invullen |

### Per kwartaal (30 minuten werk)

| Wat aanpassen | Waar in data.js | Hoe |
|---|---|---|
| Marktwaarde objecten | `objecten[].marktwaarde` | Update na taxatie of eigen inschatting |
| Exploitatiekosten | `exploitatiekosten[]` | Werkelijke vs. begroot |
| Scenario parameters | `scenario_params` | Pas base/upside/downside aan op markt |
| Huurprijzen | `huurcontracten[].huur_per_maand` | Na indexatie of nieuwe contracten |

### Ad hoc (bij elke wijziging in structuur of planning)

| Wat aanpassen | Waar in data.js | Hoe |
|---|---|---|
| Nieuwe lening afsluiten | Voeg record toe aan `leningen[]` | Kopieer een bestaand record |
| Nieuwe acquisitie | Voeg toe aan `objecten[]` + `transacties[]` | Status = "acquisitie" |
| Herfinanciering afgerond | Verander `leningen[].huidig_saldo`, `einddatum` | Update old + add new record |
| Huurder vertrekt | Verwijder record uit `huurcontracten[]` | Of zet `einddatum` op vandaag |
| Eigendom gewijzigd | Pas `eigenaren[].participatie_pct` aan | Moet optellen tot 100% |
| Nieuwe eigenaar | Voeg toe aan `eigenaren[]` | Verlaag % van bestaande eigenaren |

---

## VEELGESTELDE VRAGEN

**Q: Hoe voeg ik een nieuw object toe?**
A: Kopieer een bestaand record in `objecten[]`, pas alle velden aan, voeg eventuele huurcontracten toe in `huurcontracten[]` en leningen in `leningen[]`.

**Q: Hoe werkt de cashflow forecast?**
A: De engine pakt `kasstand`, telt maandelijkse huurinkomsten op, trekt kosten en schulddienst af, en verwerkt `transacties[]` op hun verwachte datum. Alles berekend vanuit `peildatum`.

**Q: Wat als ik een getal mis voor een object?**
A: Gebruik `null`. De engine slaat `null`-waarden over. Het dashboard toont dan "—".

**Q: Hoe pas ik de minimumkasdrempel aan?**
A: In `meta.minimum_kas_drempel`. Standaard €500.000. Pas aan naar wat jullie als minimum buffer hanteren.

**Q: Kan ik meer dan 2 eigenaren toevoegen?**
A: Ja, voeg extra records toe aan `eigenaren[]`. Zorg dat de `participatie_pct` samen optelt tot 100%.

**Q: Hoe exporteer ik het dashboard?**
A: In Chrome: Bestand → Afdrukken → Opslaan als PDF. Of gebruik Ctrl+P.

---

## BEDRAGEN — REKENREGELS

De engine berekent automatisch:

| KPI | Formule |
|---|---|
| Totale kas | Som van alle `kasstand[].saldo` |
| NOI per object | Jaarlijkse huur − exploitatiekosten |
| DSCR | NOI / (rente + aflossing per jaar) |
| LTV | Huidig saldo lening / marktwaarde object |
| NAV | Totale marktwaarde − totale schuld + kas |
| Equity value | NOI / yield − schuld + kas |
| Totale waarde | Equity value × (1 + platform premium) |
| Probability-gewogen CF | Bedrag × (kans_pct / 100) |

---

## KLEURCODERING IN HET DASHBOARD

| Kleur | Betekenis |
|---|---|
| Groen | Gezond, boven target, geen actie nodig |
| Blauw | Informatief, huidig, neutraal |
| Oranje/amber | Aandacht vereist, nadert limiet |
| Rood | Kritiek, actie vereist, breekpunt |

---

## VOLGENDE STAPPEN NA IMPLEMENTATIE

1. **Week 1:** Vul `data.js` met echte cijfers (blokken 1–5)
2. **Week 2:** Voeg groepsstructuur toe (blok 6)
3. **Week 3:** Test alle scenario's en calibreer parameters
4. **Maand 2:** Zet maandelijkse update-routine op (15 min/mnd)
5. **Kwartaal 2:** Evalueer KPIs en pas exitdoelen aan

---

## TECHNISCHE EISEN

- Moderne browser: Chrome 90+, Firefox 88+, Edge 90+, Safari 15+
- Geen internetverbinding vereist na downloaden (fonts worden gecached)
- Geen server, geen installatie, geen database
- Schermresolutie: minimaal 1280×720 aanbevolen

---

## ROADMAP — VOLGENDE VERSIES

**V1 (dit dashboard):** Lokale HTML — volledig offline, handmatig bijwerken

**V2:** Koppeling met Google Sheets als databron — real-time updates via Sheets API

**V3:** Webapplicatie met database — multi-user, automatische alerts per e-mail, bankrekening-koppeling

---

*Vragen of aanpassingen? Deel de bijgewerkte `data.js` en vraag een update.*
