/**
 * ============================================================
 *  FORTIS VASTGOED — BEREKENINGSENGINE
 *  Leest data uit window.FORTIS_DATA en berekent alle KPIs.
 *  NIET aanpassen tenzij je de logica wilt wijzigen.
 * ============================================================
 */

window.ENGINE = (function () {

  function data() { return window.FORTIS_DATA; }

  // ---------- HELPERS ----------
  const fmt = (v, dec = 1) => {
    if (v === null || v === undefined) return '—';
    const a = Math.abs(v), s = v < 0 ? '-' : '';
    if (a >= 1e6) return s + '€\u00a0' + (a / 1e6).toFixed(dec) + 'M';
    if (a >= 1e3) return s + '€\u00a0' + Math.round(a / 1e3) + 'k';
    return s + '€\u00a0' + Math.round(a);
  };
  const pct = (v, dec = 1) => v == null ? '—' : v.toFixed(dec) + '%';
  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

  // ---------- KAS ----------
  function totaleKas() {
    return data().kasstand.reduce((s, k) => s + k.saldo, 0);
  }
  function beschikbareKas() {
    return data().kasstand.reduce((s, k) => s + (k.saldo - k.restricted), 0);
  }
  function kasPerEntiteit() {
    return data().kasstand.map(k => ({
      ...k,
      beschikbaar: k.saldo - k.restricted,
    }));
  }

  // ---------- HUURINKOMSTEN ----------
  function jaarlijkseHuur() {
    return data().huurcontracten.reduce((s, h) => s + h.huur_per_maand * 12, 0);
  }
  function maandelijkseHuur() {
    return data().huurcontracten.reduce((s, h) => s + h.huur_per_maand, 0);
  }

  // ---------- EXPLOITATIEKOSTEN ----------
  function jaarlijkseKosten(object_id = null) {
    const kosten = object_id
      ? data().exploitatiekosten.filter(k => k.object_id === object_id)
      : data().exploitatiekosten;
    return kosten.reduce((s, k) =>
      s + k.onderhoud + k.beheer + k.verzekering + k.ozb + k.overig, 0);
  }

  // ---------- NOI ----------
  function noiPerObject() {
    return data().objecten.map(obj => {
      const huur = data().huurcontracten
        .filter(h => h.object_id === obj.id)
        .reduce((s, h) => s + h.huur_per_maand * 12, 0);
      const kosten = jaarlijkseKosten(obj.id);
      return { ...obj, huur_jaar: huur, kosten_jaar: kosten, noi: huur - kosten };
    });
  }
  function totalNOI() {
    return noiPerObject().reduce((s, o) => s + o.noi, 0);
  }

  // ---------- SCHULD ----------
  function totaleSculd() {
    return data().leningen.reduce((s, l) => s + l.huidig_saldo, 0);
  }
  function maandelijkseSchulddienst() {
    return data().leningen.reduce((s, l) => {
      const rente = (l.huidig_saldo * l.rente_pct / 100) / 12;
      let aflossing = 0;
      if (l.aflossing_type === 'lineair') {
        const jarenResterend = 5; // gemiddeld
        aflossing = l.huidig_saldo / (jarenResterend * 12);
      } else if (l.aflossing_type === 'annuiteit') {
        const r = l.rente_pct / 100 / 12;
        const n = 20 * 12;
        aflossing = l.huidig_saldo * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1) - rente;
      }
      return s + rente + aflossing;
    }, 0);
  }
  function gewogenRente() {
    const totaal = totaleSculd();
    if (totaal === 0) return 0;
    const gewogen = data().leningen.reduce((s, l) =>
      s + l.huidig_saldo * l.rente_pct, 0);
    return gewogen / totaal;
  }

  // ---------- LTV ----------
  function ltvPerObject() {
    return data().objecten.map(obj => {
      const schuld = data().leningen
        .filter(l => l.object_id === obj.id)
        .reduce((s, l) => s + l.huidig_saldo, 0);
      const waarde = obj.marktwaarde || 0;
      return {
        ...obj,
        schuld,
        ltv: waarde > 0 ? (schuld / waarde * 100) : null,
      };
    });
  }
  function gewogenLTV() {
    const items = ltvPerObject().filter(o => o.ltv !== null);
    const totalWaarde = items.reduce((s, o) => s + o.marktwaarde, 0);
    if (totalWaarde === 0) return 0;
    return items.reduce((s, o) => s + (o.ltv * o.marktwaarde / totalWaarde), 0);
  }

  // ---------- DSCR / ICR ----------
  function dscr() {
    const noi = totalNOI();
    const schulddienst = maandelijkseSchulddienst() * 12;
    return schulddienst > 0 ? noi / schulddienst : 99;
  }
  function icr() {
    const noi = totalNOI();
    const jaarRente = data().leningen.reduce((s, l) =>
      s + l.huidig_saldo * l.rente_pct / 100, 0);
    return jaarRente > 0 ? noi / jaarRente : 99;
  }

  // ---------- MARKTWAARDE ----------
  function totaleMarktwaarde() {
    return data().objecten.reduce((s, o) => s + (o.marktwaarde || 0), 0);
  }
  function vastgoedwaardeYield(yield_pct = null) {
    const y = yield_pct || data().scenario_params.base.yield_vastgoed_pct;
    return totalNOI() / (y / 100);
  }

  // ---------- NAV / EQUITY ----------
  function nav() {
    return totaleMarktwaarde() - totaleSculd() + totaleKas();
  }
  function equityValue(yield_pct = null) {
    return vastgoedwaardeYield(yield_pct) - totaleSculd() + totaleKas();
  }
  function totaleWaarde(yield_pct = null, ebitda_mult = null, premium_pct = null) {
    const mult = ebitda_mult || data().waardering.ebitda_multiple;
    const prem = (premium_pct || data().waardering.platform_premium_pct) / 100;
    const eq = equityValue(yield_pct);
    return eq * (1 + prem);
  }

  // ---------- EIGENAAR LOOK-THROUGH ----------
  function navPerEigenaar() {
    const totaalNav = nav();
    return data().eigenaren.map(e => ({
      ...e,
      nav_aandeel: totaalNav * e.participatie_pct / 100,
      equity_aandeel: equityValue() * e.participatie_pct / 100,
    }));
  }

  // ---------- PROBABILITY-GEWOGEN CASHFLOWS ----------
  function gewogenTransacties() {
    return data().transacties.map(t => ({
      ...t,
      gewogen_bedrag: t.bedrag * (t.kans_pct / 100),
    }));
  }
  function gewogenEquityCall() {
    return data().transacties
      .filter(t => t.type === 'equity_call')
      .reduce((s, t) => s + Math.abs(t.bedrag) * (t.kans_pct / 100), 0);
  }

  // ---------- ALERTS ----------
  function generateAlerts() {
    const alerts = [];
    const nu = new Date();

    // Leningen die binnen 9 maanden aflopen zonder herfi
    data().leningen.forEach(l => {
      if (!l.einddatum) return;
      const eind = new Date(l.einddatum);
      const maanden = (eind - nu) / (1000 * 60 * 60 * 24 * 30);
      if (maanden < 9 && maanden > 0) {
        alerts.push({
          niveau: maanden < 3 ? 'kritiek' : 'aandacht',
          tekst: `Lening ${l.naam} loopt af ${l.einddatum}. Saldo: ${fmt(l.huidig_saldo)}. Herfi-aanvraag vereist.`,
        });
      }
    });

    // Huurcontracten die binnen 12 maanden verlopen
    data().huurcontracten.forEach(h => {
      if (!h.einddatum) return;
      const eind = new Date(h.einddatum);
      const maanden = (eind - nu) / (1000 * 60 * 60 * 24 * 30);
      if (maanden < 12 && maanden > 0) {
        const obj = data().objecten.find(o => o.id === h.object_id);
        alerts.push({
          niveau: maanden < 6 ? 'kritiek' : 'aandacht',
          tekst: `Huurcontract ${h.huurder} (${obj?.naam || h.object_id}) verloopt ${h.einddatum}. €${Math.round(h.huur_per_maand / 1000)}k/mnd.`,
        });
      }
    });

    // LTV near-breach
    ltvPerObject().forEach(o => {
      const lening = data().leningen.find(l => l.object_id === o.id);
      if (!lening || !o.ltv) return;
      const max = lening.covenant_ltv_max;
      if (max && o.ltv > max * 0.92) {
        alerts.push({
          niveau: o.ltv > max ? 'kritiek' : 'aandacht',
          tekst: `${o.naam}: LTV ${o.ltv.toFixed(0)}% nadert max ${max}%.`,
        });
      }
    });

    // DSCR near-breach
    const d = dscr();
    if (d < 1.30 && d > 0) {
      alerts.push({
        niveau: d < 1.20 ? 'kritiek' : 'aandacht',
        tekst: `Portefeuille DSCR ${d.toFixed(2)} — minimumeis banken 1,20. Buffer smal.`,
      });
    }

    return alerts;
  }

  // ---------- MAANDELIJKSE CASHFLOW FORECAST ----------
  function cashflowForecast(aantalMaanden = 24, scenario = 'base') {
    const sc = data().scenario_params[scenario];
    const huurMnd = maandelijkseHuur();
    const kostenMnd = jaarlijkseKosten() / 12;
    const schulddienstMnd = maandelijkseSchulddienst();

    let kas = totaleKas();
    const resultaten = [];

    for (let i = 0; i < aantalMaanden; i++) {
      // Indexatie: jaarlijks in januari
      const factor = i > 0 && i % 12 === 0
        ? Math.pow(1 + sc.huurgroei_pct / 100, Math.floor(i / 12))
        : Math.pow(1 + sc.huurgroei_pct / 100, Math.floor(i / 12));

      const huur = huurMnd * factor * (1 - sc.leegstand_pct / 100);
      const kosten = kostenMnd * Math.pow(1 + sc.kostenstijging_pct / 100, i / 12);
      const schulddienst = schulddienstMnd;

      // Incidentele events
      const maandStr = offsetMaand(data().meta.peildatum, i);
      const events = data().transacties.filter(t => {
        const tm = t.verwachte_datum.substring(0, 7);
        return tm === maandStr;
      });
      const incidenteel = events.reduce((s, e) => s + e.bedrag, 0);

      const nettoCF = huur - kosten - schulddienst + incidenteel;
      const openingKas = kas;
      kas += nettoCF;

      resultaten.push({
        maand: i,
        maandStr,
        opening_kas: openingKas,
        huur,
        kosten,
        schulddienst,
        incidenteel,
        events,
        netto_cf: nettoCF,
        sluitend_kas: kas,
        alert: kas < data().meta.minimum_kas_drempel,
      });
    }
    return resultaten;
  }

  function offsetMaand(startDatum, maanden) {
    const d = new Date(startDatum + '-01');
    d.setMonth(d.getMonth() + maanden);
    return d.toISOString().substring(0, 7);
  }

  // ---------- SCENARIO SUMMARY ----------
  function scenarioSummary(scenario = 'base') {
    const cf = cashflowForecast(24, scenario);
    const minKas = Math.min(...cf.map(m => m.sluitend_kas));
    const minMaand = cf.find(m => m.sluitend_kas === minKas);
    const sc = data().scenario_params[scenario];
    const rv = totalNOI() * (1 - sc.leegstand_pct / 100) * (1 + sc.huurgroei_pct / 100) / (sc.yield_vastgoed_pct / 100);
    const eq = rv - totaleSculd() + totaleKas();
    return { rv, eq, minKas, minMaand, fundingGap: Math.min(0, minKas - 0) };
  }

  // ---------- MAAND LABELS ----------
  function maandLabels(n = 24) {
    const namen = ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
    const start = new Date(data().meta.peildatum + '-01');
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(start);
      d.setMonth(d.getMonth() + i);
      return namen[d.getMonth()] + ' ' + String(d.getFullYear()).slice(2);
    });
  }

  // ---------- PUBLIEKE API ----------
  return {
    fmt, pct, clamp,
    totaleKas, beschikbareKas, kasPerEntiteit,
    jaarlijkseHuur, maandelijkseHuur,
    jaarlijkseKosten,
    noiPerObject, totalNOI,
    totaleSculd, maandelijkseSchulddienst, gewogenRente,
    ltvPerObject, gewogenLTV,
    dscr, icr,
    totaleMarktwaarde, vastgoedwaardeYield,
    nav, equityValue, totaleWaarde,
    navPerEigenaar,
    gewogenTransacties, gewogenEquityCall,
    generateAlerts,
    cashflowForecast, scenarioSummary,
    maandLabels,
  };
})();
