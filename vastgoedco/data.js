// =====================================================================
// VastgoedCo — dashboarddata
// Dit is het enige bestand dat je aanpast. De structuur volgt de views
// uit vastgoedco_supabase.sql (v_kpi, v_meldingen, v_forecast), zodat de
// data later 1-op-1 uit Supabase kan komen.
// =====================================================================

const DATA = {
  bedrijf: 'VastgoedCo',
  periode: 'April 2026',
  vorigeMaand: 'mrt',
  minKasbuffer: 500000,

  kpi: {
    kasaldo: 2840000,
    kasaldoMutatie: 124000,
    minKasaldo12m: 410000,
    minKasaldoMaand: 'okt 2026',
    nav: 8700000,
    dscr: 1.42,
    dscrMin: 1.20,
    noiJaar: 720000,
    actieveObjecten: 3,
    irrPct: 11.4,
    schuld: 7600000,
    ltvPct: 58,
  },

  meldingen: [
    { niveau: 'kritiek',  tekst: 'Kasaldo daalt onder €500k in okt 2026. Herfinanciering Breda vereist voor 1 sep 2026.' },
    { niveau: 'kritiek',  tekst: 'Lening Utrecht (€2,3M) loopt af 15 aug 2026. Geen herfi-aanvraag ingediend. Doorlooptijd 8–12 weken.' },
    { niveau: 'aandacht', tekst: 'Huurcontract Rotterdam (€8.400/mnd) verloopt 1 jan 2027. Heronderhandeling advies sep 2026.' },
    { niveau: 'info',     tekst: 'Bouwproject Amsterdam op schema. Tranche 3 (€450k) getrokken 3 apr 2026.' },
  ],

  // Kasaldo einde maand per scenario (uit v_forecast), mei 2026 t/m apr 2028
  maanden: ['mei 26','jun 26','jul 26','aug 26','sep 26','okt 26','nov 26','dec 26','jan 27','feb 27','mrt 27','apr 27',
            'mei 27','jun 27','jul 27','aug 27','sep 27','okt 27','nov 27','dec 27','jan 28','feb 28','mrt 28','apr 28'],
  kasverloop: {
    base:     [2716700,2581073,3058495,635989,521607,410000,1306688,1198906,1537098,1425328,1313596,1351903,
               1363298,1254731,1303246,2518550,2549725,2580938,2612190,2643480,2675049,2706655,2738300,2769984],
    upside:   [2716700,2581073,3058610,636219,521952,410460,1437263,1329082,1671329,1563614,1455938,1498300,
               1513750,1409239,1462396,2902342,2939213,2976122,3013070,3050057,3087479,3124940,3162440,3199977],
    downside: [2833100,2813873,2807447,371495,243666,715909,588227,460617,774564,837334,709247,1031199,
               906238,781316,806644,811610,687014,726116,1251756,1273014,1293844,1314711,1335618,1356562],
  },

  objecten: [
    { naam: 'Utrecht',   type: 'Kantoor',        status: 'Eigendom',   huurMaand: 32000, marktwaarde: 5200000, schuld: 2300000, irr: 10.5 },
    { naam: 'Rotterdam', type: 'Gemengd',        status: 'Eigendom',   huurMaand: 23000, marktwaarde: 3400000, schuld: 1900000, irr: 9.8 },
    { naam: 'Breda',     type: 'Bedrijfsruimte', status: 'Eigendom',   huurMaand: 17000, marktwaarde: 4100000, schuld: 2050000, irr: 11.5 },
    { naam: 'Amsterdam', type: 'Appartementen',  status: 'In bouw',    huurMaand: 0,     marktwaarde: 3600000, schuld: 1350000, irr: 13.5 },
    { naam: 'Den Bosch', type: 'Kantoor',        status: 'Acquisitie', huurMaand: 0,     marktwaarde: 0,       schuld: 0,       irr: null },
  ],

  leningen: [
    { naam: 'Lening Utrecht',             geldgever: 'ING',      saldo: 2300000, rente: 4.2, aflossing: 'Bullet',        einde: '15 aug 2026', status: 'Geen herfi' },
    { naam: 'Lening Rotterdam',           geldgever: 'ABN AMRO', saldo: 1900000, rente: 4.6, aflossing: '€10.000/mnd',   einde: '31 dec 2030', status: 'Actief' },
    { naam: 'Lening Breda',               geldgever: 'Rabobank', saldo: 2050000, rente: 5.0, aflossing: '€8.375/mnd',    einde: '31 mrt 2027', status: 'Herfi nov 2026' },
    { naam: 'Bouwfinanciering Amsterdam', geldgever: 'Triodos',  saldo: 1350000, rente: 6.0, aflossing: 'Rente bijgeschr.', einde: '31 dec 2027', status: '3 van 7 tranches' },
  ],

  eigenaren: [
    { naam: 'Eigenaar A', holding: 'A Holding BV', pct: 50 },
    { naam: 'Eigenaar B', holding: 'B Holding BV', pct: 50 },
  ],

  entiteiten: [
    { naam: 'VastgoedCo Holding BV',  type: 'Holding',          objecten: '—' },
    { naam: 'VastgoedCo Vastgoed BV', type: 'Werkmaatschappij', objecten: 'Utrecht, Rotterdam, Breda, Den Bosch' },
    { naam: 'Project Amsterdam BV',   type: 'Project-BV',       objecten: 'Amsterdam' },
  ],
};
