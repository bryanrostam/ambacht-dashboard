/**
 * ============================================================
 *  FORTIS VASTGOED — CENTRALE DATA
 *  Dit is het ENIGE bestand dat je aanpast met jouw echte data.
 *  Alle andere bestanden lezen hier automatisch uit.
 * ============================================================
 *
 *  HOE AANPASSEN:
 *  1. Open dit bestand in een teksteditor (Notepad++, VS Code)
 *  2. Vervang de voorbeeldwaarden door jouw eigen cijfers
 *  3. Sla op en herlaad het dashboard in je browser
 *  4. Niets kapot: als je een veld vergeet blijft de demo-waarde staan
 *
 *  DATUMFORMAAT: "YYYY-MM-DD" of "YYYY-MM" voor maand
 *  BEDRAGEN: altijd in EURO, zonder punt als duizendtalscheider
 *            Goed: 2300000   Fout: 2.300.000 of "2,3M"
 *  PERCENTAGES: als getal zonder %
 *            Goed: 3.4    Fout: "3,4%" of 0.034
 * ============================================================
 */

window.FORTIS_DATA = {

  // ----------------------------------------------------------
  //  BEDRIJFSNAAM & META
  // ----------------------------------------------------------
  meta: {
    bedrijfsnaam: "Fortis Vastgoed BV",
    subtitel: "Portfolio Dashboard",
    versie: "v1.0",
    peildatum: "2024-04-01",   // datum waarop kasstand is gemeten
    minimum_kas_drempel: 500000, // alert als kasaldo hieronder komt
  },

  // ----------------------------------------------------------
  //  KASSTAND VANDAAG — per entiteit
  //  restricted = geld dat je NIET vrij kunt gebruiken
  //  (escrow, covenant-reserve, bouwreserve etc.)
  // ----------------------------------------------------------
  kasstand: [
    { entiteit: "Fortis Vastgoed BV",  saldo: 2500000, restricted: 500000,  toelichting: "Minimumreserve covenant" },
    { entiteit: "AMS Vastgoed BV",     saldo: 280000,  restricted: 280000,  toelichting: "Escrow geldgever" },
    { entiteit: "RTT Vastgoed BV",     saldo: 420000,  restricted: 100000,  toelichting: "Onderhoudsreserve" },
    { entiteit: "EHV Dev BV",          saldo: 300000,  restricted: 300000,  toelichting: "Bouwreserve" },
    { entiteit: "LB Holding BV",       saldo: 980000,  restricted: 0,       toelichting: "" },
    { entiteit: "MVD Holding BV",      saldo: 640000,  restricted: 0,       toelichting: "" },
  ],

  // ----------------------------------------------------------
  //  EIGENAREN (UBO's)
  // ----------------------------------------------------------
  eigenaren: [
    {
      id: "lars",
      naam: "Lars Bergman",
      holding: "LB Holding BV",
      participatie_pct: 60,        // % in Fortis Vastgoed BV
      kapitaal_ingebracht: 3200000,
      asl_gegeven: 900000,         // aandeelhouderslening aan de groep
      asl_rente_pct: 5.0,
    },
    {
      id: "mieke",
      naam: "Mieke van Dam",
      holding: "MVD Holding BV",
      participatie_pct: 40,
      kapitaal_ingebracht: 2100000,
      asl_gegeven: 0,
      asl_rente_pct: 0,
    },
  ],

  // ----------------------------------------------------------
  //  OBJECTEN
  //  status: "eigendom" | "bouw" | "acquisitie" | "herfi" | "verkoop"
  //  type:   "kantoor" | "wonen" | "retail" | "gemengd" | "grond"
  // ----------------------------------------------------------
  objecten: [
    {
      id: "ams01",
      naam: "Herengracht 142",
      stad: "Amsterdam",
      type: "kantoor",
      status: "eigendom",
      eigenaar_bv: "AMS Vastgoed BV",
      aankoopprijs: 4200000,
      marktwaarde: 5400000,
      bvo_m2: 620,
      // Huurcontracten voor dit object: zie huurcontracten[] hieronder
    },
    {
      id: "rtt01",
      naam: "Coolsingel 88",
      stad: "Rotterdam",
      type: "kantoor",
      status: "herfi",
      eigenaar_bv: "RTT Vastgoed BV",
      aankoopprijs: 4800000,
      marktwaarde: 6100000,
      bvo_m2: 740,
    },
    {
      id: "lei01",
      naam: "Rapenburg 34",
      stad: "Leiden",
      type: "wonen",
      status: "herfi",
      eigenaar_bv: "Fortis Vastgoed BV",
      aankoopprijs: 2100000,
      marktwaarde: 2800000,
      bvo_m2: 280,
    },
    {
      id: "gro01",
      naam: "Markt 15",
      stad: "Groningen",
      type: "retail",
      status: "verkoop",
      eigenaar_bv: "Fortis Vastgoed BV",
      aankoopprijs: 2400000,
      marktwaarde: 3200000,
      verwachte_verkoopprijs: 3350000,
      bvo_m2: 310,
    },
    {
      id: "ehv01",
      naam: "Stationsplein 7",
      stad: "Eindhoven",
      type: "gemengd",
      status: "bouw",
      eigenaar_bv: "EHV Dev BV",
      aankoopprijs: 3500000,
      marktwaarde: 9800000,     // GDV (Gross Development Value)
      bvo_m2: 1840,
      verwachte_opleveringsdatum: "2027-09-01",
    },
    {
      id: "dh01",
      naam: "Lange Poten 22",
      stad: "Den Haag",
      type: "kantoor",
      status: "acquisitie",
      eigenaar_bv: null,        // nog geen BV, in onderhandeling
      aankoopprijs: null,
      marktwaarde: 4800000,
      verwachte_aankoopprijs: 4650000,
      bvo_m2: 550,
    },
    {
      id: "mst01",
      naam: "Vrijthof 8",
      stad: "Maastricht",
      type: "wonen",
      status: "eigendom",
      eigenaar_bv: "Fortis Vastgoed BV",
      aankoopprijs: 1400000,
      marktwaarde: 1800000,
      bvo_m2: 165,
    },
  ],

  // ----------------------------------------------------------
  //  HUURCONTRACTEN
  //  indexatie_type: "CPI" | "vast" | "geen"
  //  Koppeling via object_id
  // ----------------------------------------------------------
  huurcontracten: [
    {
      id: "hc01",
      object_id: "ams01",
      huurder: "Accenture NL BV",
      huur_per_maand: 28500,
      servicekosten_per_maand: 2200,
      ingangsdatum: "2021-03-01",
      einddatum: "2027-02-28",      // LET OP: verloopt feb 2027
      indexatie_type: "CPI",
      indexatie_pct: null,           // null = gebruik CPI
      indexatie_maand: 1,            // januari
    },
    {
      id: "hc02",
      object_id: "rtt01",
      huurder: "Deloitte Rotterdam BV",
      huur_per_maand: 31200,
      servicekosten_per_maand: 2800,
      ingangsdatum: "2020-07-01",
      einddatum: "2026-06-30",
      indexatie_type: "CPI",
      indexatie_maand: 7,
    },
    {
      id: "hc03",
      object_id: "lei01",
      huurder: "Universiteit Leiden",
      huur_per_maand: 12400,
      servicekosten_per_maand: 800,
      ingangsdatum: "2022-01-01",
      einddatum: null,               // onbepaalde tijd
      indexatie_type: "vast",
      indexatie_pct: 3.0,
      indexatie_maand: 1,
    },
    {
      id: "hc04",
      object_id: "gro01",
      huurder: "HEMA Groningen BV",
      huur_per_maand: 16800,
      servicekosten_per_maand: 1200,
      ingangsdatum: "2019-10-01",
      einddatum: "2027-09-30",
      indexatie_type: "CPI",
      indexatie_maand: 10,
    },
    {
      id: "hc05",
      object_id: "mst01",
      huurder: "Particulier (3 units)",
      huur_per_maand: 9200,
      servicekosten_per_maand: 400,
      ingangsdatum: "2020-06-01",
      einddatum: null,
      indexatie_type: "vast",
      indexatie_pct: 3.5,
      indexatie_maand: 7,
    },
  ],

  // ----------------------------------------------------------
  //  LENINGEN
  //  type: "hypotheek" | "bouwfinanciering" | "asl" | "overbrugging" | "mezzanine"
  //  aflossing_type: "annuiteit" | "lineair" | "bullet" | "geen"
  //  rente_type: "vast" | "variabel"
  // ----------------------------------------------------------
  leningen: [
    {
      id: "ln01",
      naam: "ING Amsterdam",
      object_id: "ams01",
      type: "hypotheek",
      geldgever: "ING Bank",
      hoofdsom: 3500000,
      huidig_saldo: 3200000,
      rente_pct: 3.2,
      rente_type: "vast",
      aflossing_type: "annuiteit",
      ingangsdatum: "2021-03-01",
      einddatum: "2029-03-01",
      covenant_ltv_max: 70,
      covenant_dscr_min: 1.20,
    },
    {
      id: "ln02",
      naam: "ABN Rotterdam",
      object_id: "rtt01",
      type: "hypotheek",
      geldgever: "ABN AMRO",
      hoofdsom: 4000000,
      huidig_saldo: 3800000,
      rente_pct: 3.6,
      rente_type: "vast",
      aflossing_type: "bullet",
      ingangsdatum: "2020-11-01",
      einddatum: "2026-11-15",      // KRITIEK: loopt af
      covenant_ltv_max: 65,
      covenant_dscr_min: 1.20,
    },
    {
      id: "ln03",
      naam: "Rabo Leiden",
      object_id: "lei01",
      type: "hypotheek",
      geldgever: "Rabobank",
      hoofdsom: 1900000,
      huidig_saldo: 1700000,
      rente_pct: 3.0,
      rente_type: "vast",
      aflossing_type: "lineair",
      ingangsdatum: "2022-01-01",
      einddatum: "2028-09-01",
      covenant_ltv_max: 70,
      covenant_dscr_min: 1.20,
    },
    {
      id: "ln04",
      naam: "Volksbank Groningen",
      object_id: "gro01",
      type: "hypotheek",
      geldgever: "de Volksbank",
      hoofdsom: 2100000,
      huidig_saldo: 1900000,
      rente_pct: 3.4,
      rente_type: "vast",
      aflossing_type: "annuiteit",
      ingangsdatum: "2019-10-01",
      einddatum: "2028-06-01",
      covenant_ltv_max: 70,
      covenant_dscr_min: 1.20,
    },
    {
      id: "ln05",
      naam: "BNG Eindhoven bouwfinanciering",
      object_id: "ehv01",
      type: "bouwfinanciering",
      geldgever: "BNG Bank",
      hoofdsom: 8500000,
      huidig_saldo: 7100000,       // reeds getrokken
      rente_pct: 4.4,
      rente_type: "variabel",
      euribor_spread_pct: 1.8,
      aflossing_type: "bullet",
      ingangsdatum: "2024-01-01",
      einddatum: "2028-03-01",
      covenant_ltv_max: 75,
      covenant_dscr_min: null,     // niet van toepassing tijdens bouw
    },
    {
      id: "ln06",
      naam: "ASL L. Bergman → Fortis",
      object_id: null,             // groepsniveau
      type: "asl",
      geldgever: "Lars Bergman privé",
      hoofdsom: 900000,
      huidig_saldo: 900000,
      rente_pct: 5.0,
      rente_type: "vast",
      aflossing_type: "bullet",
      ingangsdatum: "2023-04-01",
      einddatum: "2027-04-01",     // LET OP: herfinanciering nodig
      covenant_ltv_max: null,
      covenant_dscr_min: null,
    },
  ],

  // ----------------------------------------------------------
  //  BOUWFINANCIERING TRANCHES
  //  status: "getrokken" | "goedgekeurd" | "gepland" | "toekomstig"
  // ----------------------------------------------------------
  bouw_tranches: [
    { id: "tr01", lening_id: "ln05", nr: 1, bedrag: 1800000, datum: "2024-01-15", voorwaarde: "Grondoverdracht",   status: "getrokken" },
    { id: "tr02", lening_id: "ln05", nr: 2, bedrag: 1900000, datum: "2024-03-01", voorwaarde: "Fundering gereed", status: "getrokken" },
    { id: "tr03", lening_id: "ln05", nr: 3, bedrag: 1400000, datum: "2024-04-15", voorwaarde: "Ruwbouw 30%",      status: "getrokken" },
    { id: "tr04", lening_id: "ln05", nr: 4, bedrag: 1600000, datum: "2024-08-01", voorwaarde: "Ruwbouw 70%",      status: "gepland" },   // LET OP
    { id: "tr05", lening_id: "ln05", nr: 5, bedrag: 950000,  datum: "2024-11-01", voorwaarde: "Afbouw gereed",    status: "toekomstig" },
    { id: "tr06", lening_id: "ln05", nr: 6, bedrag: 850000,  datum: "2025-03-01", voorwaarde: "Oplevering",       status: "toekomstig" },
  ],

  // ----------------------------------------------------------
  //  GEPLANDE TRANSACTIES (alle grote cash events)
  //  type: "herfinanciering" | "aankoop" | "verkoop" | "equity_call" | "bouwtranche"
  //  zekerheid: "committed" | "expected" | "oriëntatie"
  // ----------------------------------------------------------
  transacties: [
    {
      id: "tx01",
      type: "herfinanciering",
      naam: "Herfi Leiden — netto opbrengst",
      object_id: "lei01",
      verwachte_datum: "2024-06-01",
      bedrag: 920000,              // positief = inkomst voor de groep
      zekerheid: "expected",
      kans_pct: 90,
      afhankelijk_van: null,
      toelichting: "Nieuwe lening €2,4M, aflossing bestaand €1,7M, kosten €80k → netto +€620k. Eerder getaxeerde waardestijging meegenomen.",
    },
    {
      id: "tx02",
      type: "bouwtranche",
      naam: "EHV Tranche 4 — opname",
      object_id: "ehv01",
      verwachte_datum: "2024-08-01",
      bedrag: 1600000,             // inkomst (opname financiering)
      zekerheid: "expected",
      kans_pct: 75,
      afhankelijk_van: null,
      toelichting: "Afhankelijk van bereiken bouwmijlpaal ruwbouw 70%. Aannemer schat aug 2026.",
    },
    {
      id: "tx03",
      type: "equity_call",
      naam: "Equity call — aankoop Den Haag",
      object_id: "dh01",
      verwachte_datum: "2024-09-01",
      bedrag: -1200000,            // negatief = uitgave
      zekerheid: "expected",
      kans_pct: 80,
      afhankelijk_van: "tx01",    // afhankelijk van herfi Leiden
      toelichting: "25% eigen inbreng van €4,65M + €37.5k notariskosten + €75k overdrachtsbelasting.",
    },
    {
      id: "tx04",
      type: "herfinanciering",
      naam: "Herfi Rotterdam — netto opbrengst",
      object_id: "rtt01",
      verwachte_datum: "2024-11-01",
      bedrag: 400000,
      zekerheid: "expected",
      kans_pct: 85,
      afhankelijk_van: null,
      toelichting: "Nieuwe lening €4,2M, aflossing €3,8M, kosten €80k → netto +€320k. Aanvraag uiterlijk aug 2026 indienen.",
    },
    {
      id: "tx05",
      type: "verkoop",
      naam: "Verkoop Groningen",
      object_id: "gro01",
      verwachte_datum: "2025-02-01",
      bedrag: 1850000,             // netto na aflossing hypotheek en kosten
      zekerheid: "oriëntatie",
      kans_pct: 45,
      afhankelijk_van: null,
      toelichting: "Verkoopprijs €3,35M − hypotheek €1,9M − transactiekosten €50k = netto €1,3M. Makelaar ingeschakeld.",
    },
    {
      id: "tx06",
      type: "equity_call",
      naam: "Herfi kosten Rotterdam",
      object_id: "rtt01",
      verwachte_datum: "2024-11-01",
      bedrag: -180000,
      zekerheid: "expected",
      kans_pct: 90,
      afhankelijk_van: null,
      toelichting: "Notariskosten, boeterente, advies.",
    },
  ],

  // ----------------------------------------------------------
  //  EXPLOITATIEKOSTEN per object (jaarlijks)
  // ----------------------------------------------------------
  exploitatiekosten: [
    { object_id: "ams01", onderhoud: 42000,  beheer: 28000,  verzekering: 8500,  ozb: 18000, overig: 6000  },
    { object_id: "rtt01", onderhoud: 48000,  beheer: 32000,  verzekering: 9500,  ozb: 22000, overig: 7000  },
    { object_id: "lei01", onderhoud: 18000,  beheer: 12000,  verzekering: 4200,  ozb: 8500,  overig: 2800  },
    { object_id: "gro01", onderhoud: 22000,  beheer: 14000,  verzekering: 5000,  ozb: 10000, overig: 3200  },
    { object_id: "ehv01", onderhoud: 0,      beheer: 18000,  verzekering: 12000, ozb: 0,     overig: 5000  },
    { object_id: "mst01", onderhoud: 12000,  beheer: 8000,   verzekering: 3000,  ozb: 5500,  overig: 1800  },
  ],

  // ----------------------------------------------------------
  //  SCENARIO PARAMETERS
  //  base = jouw verwachting
  //  upside / downside = afwijkingen hiervan
  // ----------------------------------------------------------
  scenario_params: {
    base: {
      huurgroei_pct:        3.0,
      leegstand_pct:        6.0,
      yield_vastgoed_pct:   5.4,
      kostenstijging_pct:   3.5,
      rente_variabel_pct:   3.8,   // huidige marktrente variabel
      bouwkosten_stijging:  4.0,
      cpi_pct:              3.2,
    },
    upside: {
      huurgroei_pct:        5.0,
      leegstand_pct:        2.0,
      yield_vastgoed_pct:   4.8,
      kostenstijging_pct:   2.5,
      rente_variabel_pct:   3.3,
      bouwkosten_stijging:  2.0,
      cpi_pct:              2.8,
    },
    downside: {
      huurgroei_pct:        0.5,
      leegstand_pct:       14.0,
      yield_vastgoed_pct:   6.8,
      kostenstijging_pct:   5.5,
      rente_variabel_pct:   5.2,
      bouwkosten_stijging:  8.0,
      cpi_pct:              4.0,
    },
  },

  // ----------------------------------------------------------
  //  WAARDERINGSPARAMETERS (voor waardering & exit module)
  // ----------------------------------------------------------
  waardering: {
    ebitda_multiple:      9.0,    // instelbaar in dashboard
    platform_premium_pct: 10.0,   // % opslag op equity voor platform
    transactiekosten_pct: 1.5,    // % verkoopkosten bij exit
  },

};
