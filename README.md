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
├── editor.js       ← Formulieren om objecten en leningen te beheren
└── README.md       ← Dit bestand
```

### Navigatie

| Menu | Inhoud |
|---|---|
| Management | KPI's, actieve meldingen, kasverloop 24 maanden, pipeline |
| Liquiditeit | Cashflow forecast, tabel 12 maanden, cash per entiteit |
| Portefeuille | Objecten, NOI/LTV, planning & timeline, scenario's & stress testing |
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

Onderaan de zijbalk (onder *Gegevens*):

| Knop | Wat het doet |
|---|---|
| Exporteer data.js | Downloadt alle data, inclusief je wijzigingen, als nieuw `data.js` |
| Importeer bestand | Laadt een eerder geëxporteerd bestand (bijv. op een ander apparaat) |
| Herstel demo-data | Wist je wijzigingen in deze browser en gaat terug naar `data.js` |

**Wijzigingen voor iedereen vastleggen:** exporteer `data.js`, vervang het bestand in de repository en
push naar `main`. Daarna ziet iedereen dezelfde data. Klik zelf daarna op *Herstel demo-data*, zodat je
browser de nieuwe `data.js` gebruikt in plaats van je lokale kopie.

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
