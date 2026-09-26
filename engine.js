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
    if (a >= 1e6) return s + '€\u00a0' + (a / 1e6).toFixed(dec).replace('.', ',') + 'M';
    if (a >= 1e3) return s + '€\u00a0' + Math.round(a / 1e3) + 'k';
    return s + '€\u00a0' + Math.round(a);
  };
  const pct = (v, dec = 1) => v == null ? '—' : v.toFixed(dec).replace('.', ',') + '%';
  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

  // ---------- DATUMS ----------
  const MAANDEN_KORT = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
  const MAANDEN_LANG = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
  // Accepteert "YYYY-MM" en "YYYY-MM-DD"; geeft [jaar, maandIndex 0-11, dag]
  function parseDatum(str) {
    const [j, m, d] = String(str).split('-').map(Number);
    return [j, (m || 1) - 1, d || 1];
  }
  function peildatum() {
    const [j, m, d] = parseDatum(data().meta.peildatum);
    return new Date(j, m, d);
  }
  // "2026-08-15" → "15 aug 2026", "2026-08" → "aug 2026"
  function fmtDatum(str) {
    if (!str) return '—';
    const parts = String(str).split('-');
    const [j, m, d] = parseDatum(str);
    return (parts.length > 2 ? d + ' ' : '') + MAANDEN_KORT[m] + ' ' + j;
  }
  function maandJaarLang(str) {
    const [j, m] = parseDatum(str);
    const naam = MAANDEN_LANG[m];
    return naam.charAt(0).toUpperCase() + naam.slice(1) + ' ' + j;
  }
  function maandenTot(str) {
    const [j, m, d] = parseDatum(str);
    return (new Date(j, m, d) - peildatum()) / (1000 * 60 * 60 * 24 * 30.44);
  }

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
  // ---------- IRR ----------
  // Gewogen gemiddelde (op marktwaarde) van de irr_pct per object in data.js
  function portefeuilleIRR() {
    const items = data().objecten.filter(o => typeof o.irr_pct === 'number' && o.marktwaarde);
    const totaal = items.reduce((s, o) => s + o.marktwaarde, 0);
    if (!totaal) return null;
    return items.reduce((s, o) => s + o.irr_pct * o.marktwaarde, 0) / totaal;
  }

  function gewogenEquityCall() {
    return data().transacties
      .filter(t => t.type === 'equity_call')
      .reduce((s, t) => s + Math.abs(t.bedrag) * (t.kans_pct / 100), 0);
  }

  // ---------- CREDITEUREN ----------
  // Deadlines van crediteuren zijn echte betaaldata: urgentie wordt bepaald t.o.v. VANDAAG.
  const CRED_STATUS = {
    open:           { label: 'Open',                     ernst: 1 },
    betaalregeling: { label: 'Betaalregeling',           ernst: 1 },
    incasso:        { label: 'Incasso',                  ernst: 2 },
    faillissement:  { label: 'Faillissementsaanvraag',   ernst: 3 },
    betaald:        { label: 'Betaald',                  ernst: 0 },
  };
  function vandaag() {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }
  function dagenTot(str) {
    if (!str) return null;
    const [j, m, d] = parseDatum(str);
    return Math.round((new Date(j, m, d) - vandaag()) / 86400000);
  }
  function crediteuren() {
    return data().crediteuren || [];
  }
  // Eerstvolgende betaalmoment: bij een betaalregeling de volgende termijn, anders de vervaldatum
  function credDeadline(c) {
    return c.status === 'betaalregeling' && c.volgende_termijn ? c.volgende_termijn : c.vervaldatum;
  }
  // Het bedrag dat als eerste betaald moet worden
  function credTeBetalen(c) {
    return credEersteBetaling(c).bedrag;
  }
  function credEersteBetaling(c) {
    const open = c.bedrag_open || 0;
    const facturen = (c.facturen || []).filter(f => (f.open || 0) > 0);
    if (c.status === 'betaald' || open <= 0) return { bedrag: 0, reden: 'Niets openstaand', facturen: [] };
    if (c.status === 'betaalregeling' && c.termijn_bedrag) {
      return { bedrag: Math.min(c.termijn_bedrag, open), reden: 'Volgende termijn van de betaalregeling', facturen };
    }
    if (c.status === 'faillissement') return { bedrag: open, reden: 'Volledig bedrag om de faillissementsaanvraag te voorkomen', facturen };
    if (c.status === 'incasso') return { bedrag: open, reden: 'Volledig bedrag inclusief incassokosten om het incassotraject te stoppen', facturen };
    if (facturen.length) {
      // Alle facturen die op of vóór de deadline vervallen (minstens de oudste)
      const deadline = c.vervaldatum || '9999-12-31';
      const gesorteerd = facturen.slice().sort((a, b) => (a.vervaldatum || '').localeCompare(b.vervaldatum || ''));
      let teBetalen = gesorteerd.filter(f => !f.vervaldatum || f.vervaldatum <= deadline);
      if (!teBetalen.length) teBetalen = [gesorteerd[0]];
      return {
        bedrag: teBetalen.reduce((s, f) => s + f.open, 0),
        reden: teBetalen.length === facturen.length ? 'Alle openstaande facturen' : `${teBetalen.length} van ${facturen.length} facturen vervallen vóór de deadline`,
        facturen: teBetalen,
      };
    }
    return { bedrag: open, reden: 'Openstaand bedrag', facturen: [] };
  }
  // niveau: 'kritiek' (nu betalen) | 'aandacht' | 'ok' | 'betaald'
  function credUrgentie(c) {
    if (c.status === 'betaald') return { niveau: 'betaald', dagen: null, score: 9999 };
    const dagen = dagenTot(credDeadline(c));
    const d = dagen === null ? 999 : dagen;
    const schuif = c.schuifruimte || 'nee';
    const ruimte = schuif === 'ja' ? (c.max_uitstel_dagen || 30) : schuif === 'beperkt' ? (c.max_uitstel_dagen || 7) : 0;
    let niveau = 'ok';
    if (c.status === 'faillissement') niveau = 'kritiek';
    else if (c.status === 'incasso' && d <= 7) niveau = 'kritiek';
    else if (d + ruimte < 0) niveau = 'kritiek';          // ook na uitstel te laat
    else if (d <= 7 && schuif === 'nee') niveau = 'kritiek';
    else if (d <= 3) niveau = 'kritiek';
    else if (c.status === 'incasso' || d <= 14 || d < 0) niveau = 'aandacht';
    // Sorteerscore: lager = urgenter
    const score = (3 - (CRED_STATUS[c.status]?.ernst || 0)) * 1000 + Math.max(-500, Math.min(d, 900)) + (c.prioriteit || 2) * 3;
    return { niveau, dagen, score };
  }
  function crediteurenGesorteerd() {
    const volgorde = { kritiek: 0, aandacht: 1, ok: 2, betaald: 3 };
    return crediteuren()
      .map(c => ({ ...c, urgentie: credUrgentie(c), deadline: credDeadline(c), te_betalen: credTeBetalen(c) }))
      .sort((a, b) => volgorde[a.urgentie.niveau] - volgorde[b.urgentie.niveau] || a.urgentie.score - b.urgentie.score);
  }
  function dagenTekst(dagen) {
    if (dagen === null) return 'geen deadline';
    if (dagen < 0) return (-dagen) + (dagen === -1 ? ' dag' : ' dagen') + ' te laat';
    if (dagen === 0) return 'vandaag';
    if (dagen === 1) return 'morgen';
    return 'over ' + dagen + ' dagen';
  }
  // Uitgaande betalingen aan crediteuren per maand (YYYY-MM) voor de liquiditeitsforecast
  function crediteurenPerMaand() {
    const start = offsetMaand(data().meta.peildatum, 0);
    const uit = {};
    const plus = (maand, bedrag) => {
      const m = maand < start ? start : maand;
      uit[m] = (uit[m] || 0) + bedrag;
    };
    crediteuren().forEach(c => {
      if (c.status === 'betaald' || !c.bedrag_open) return;
      if (c.status === 'betaalregeling' && Array.isArray(c.termijnen) && c.termijnen.length) {
        c.termijnen.forEach(t => {
          const rest = (t.bedrag || 0) - (t.voldaan || 0);
          if (rest > 0 && t.datum) plus(t.datum.substring(0, 7), rest);
        });
      } else if (c.status === 'betaalregeling' && c.termijn_bedrag && c.volgende_termijn) {
        let rest = c.bedrag_open;
        const n = c.termijnen_resterend || Math.ceil(rest / c.termijn_bedrag);
        for (let i = 0; i < n && rest > 0; i++) {
          const b = Math.min(c.termijn_bedrag, rest);
          plus(offsetMaand(c.volgende_termijn, i), b);
          rest -= b;
        }
      } else if (c.vervaldatum) {
        plus(c.vervaldatum.substring(0, 7), c.bedrag_open);
      } else {
        plus(start, c.bedrag_open);
      }
    });
    return uit;
  }

  // ---------- ALERTS ----------
  // niveau: 'kritiek' | 'aandacht' | 'info'
  function generateAlerts() {
    const alerts = [];
    const drempel = data().meta.minimum_kas_drempel;

    // Kasaldo zakt onder de minimumdrempel (base scenario, 12 maanden)
    const cf = cashflowForecast(12, 'base');
    const eersteTekort = cf.find(m => m.sluitend_kas < drempel);
    if (eersteTekort) {
      alerts.push({
        niveau: 'kritiek',
        tekst: `Kasaldo daalt onder ${fmt(drempel)} in ${fmtDatum(eersteTekort.maandStr)} (verwacht ${fmt(eersteTekort.sluitend_kas)}).`,
      });
    }

    // Leningen die binnen 9 maanden aflopen
    data().leningen.forEach(l => {
      if (!l.einddatum) return;
      const maanden = maandenTot(l.einddatum);
      if (maanden < 9 && maanden > 0) {
        alerts.push({
          niveau: maanden < 6 ? 'kritiek' : 'aandacht',
          tekst: `Lening ${l.naam} (${fmt(l.huidig_saldo)}) loopt af ${fmtDatum(l.einddatum)}. Herfi-aanvraag vereist, doorlooptijd 8–12 weken.`,
        });
      }
    });

    // Huurcontracten die binnen 12 maanden verlopen
    data().huurcontracten.forEach(h => {
      if (!h.einddatum) return;
      const maanden = maandenTot(h.einddatum);
      if (maanden < 12 && maanden > 0) {
        const obj = data().objecten.find(o => o.id === h.object_id);
        alerts.push({
          niveau: maanden < 3 ? 'kritiek' : 'aandacht',
          tekst: `Huurcontract ${h.huurder} — ${obj ? obj.stad : h.object_id} (${fmt(h.huur_per_maand)}/mnd) verloopt ${fmtDatum(h.einddatum)}. Heronderhandeling starten.`,
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
          tekst: `${o.naam} (${o.stad}): LTV ${o.ltv.toFixed(0)}% nadert covenant-max ${max}%.`,
        });
      }
    });

    // DSCR near-breach
    const d = dscr();
    if (d < 1.30 && d > 0) {
      alerts.push({
        niveau: d < 1.20 ? 'kritiek' : 'aandacht',
        tekst: `Portefeuille DSCR ${d.toFixed(2).replace('.', ',')} — minimumeis banken 1,20. Buffer smal.`,
      });
    }

    // Crediteuren die (bijna) betaald moeten worden
    crediteurenGesorteerd().filter(c => c.urgentie.niveau === 'kritiek' || c.urgentie.niveau === 'aandacht').forEach(c => {
      const st = c.status === 'faillissement' ? ' Faillissementsaanvraag dreigt.' : c.status === 'incasso' ? ' In incasso.' : c.status === 'betaalregeling' ? ' Termijn betaalregeling.' : '';
      alerts.push({
        niveau: c.urgentie.niveau,
        tekst: `Crediteur ${c.naam}: ${fmt(c.te_betalen)} betalen vóór ${fmtDatum(c.deadline)} (${dagenTekst(c.urgentie.dagen)}).${st}`,
        bron: 'crediteur',
        id: c.id,
      });
    });

    // Info: voortgang bouwprojecten (laatst getrokken tranche)
    data().objecten.filter(o => o.status === 'bouw').forEach(o => {
      const lening = data().leningen.find(l => l.object_id === o.id && l.type === 'bouwfinanciering');
      if (!lening) return;
      const tranches = data().bouw_tranches.filter(t => t.lening_id === lening.id);
      const getrokken = tranches.filter(t => t.status === 'getrokken').sort((a, b) => a.nr - b.nr).pop();
      if (!getrokken) return;
      const volgende = tranches.filter(t => t.nr > getrokken.nr).sort((a, b) => a.nr - b.nr)[0];
      alerts.push({
        niveau: 'info',
        tekst: `Bouwproject ${o.stad}: tranche ${getrokken.nr} (${fmt(getrokken.bedrag)}) getrokken ${fmtDatum(getrokken.datum)}.` +
          (volgende ? ` Volgende: tranche ${volgende.nr} (${fmt(volgende.bedrag)}) ${fmtDatum(volgende.datum.substring(0, 7))}.` : ''),
      });
    });

    const volgorde = { kritiek: 0, aandacht: 1, info: 2 };
    return alerts.sort((a, b) => volgorde[a.niveau] - volgorde[b.niveau]);
  }

  // ---------- MAANDELIJKSE CASHFLOW FORECAST ----------
  function cashflowForecast(aantalMaanden = 24, scenario = 'base') {
    const sc = data().scenario_params[scenario];
    const huurMnd = maandelijkseHuur();
    const kostenMnd = jaarlijkseKosten() / 12;
    const schulddienstMnd = maandelijkseSchulddienst();

    let kas = totaleKas();
    const resultaten = [];
    const credPerMaand = crediteurenPerMaand();

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
      const crediteuren = credPerMaand[maandStr] || 0;

      const nettoCF = huur - kosten - schulddienst + incidenteel - crediteuren;
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
        crediteuren,
        netto_cf: nettoCF,
        sluitend_kas: kas,
        alert: kas < data().meta.minimum_kas_drempel,
      });
    }
    return resultaten;
  }

  function offsetMaand(startDatum, maanden) {
    const [j, m] = parseDatum(startDatum);
    const d = new Date(j, m + maanden, 1);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
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
    const [j, m] = parseDatum(data().meta.peildatum);
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(j, m + i, 1);
      return namen[d.getMonth()] + ' ' + String(d.getFullYear()).slice(2);
    });
  }

  // ---------- PUBLIEKE API ----------
  return {
    fmt, pct, clamp,
    parseDatum, peildatum, fmtDatum, maandJaarLang, maandenTot, offsetMaand,
    portefeuilleIRR,
    CRED_STATUS, crediteuren, crediteurenGesorteerd, credUrgentie, credDeadline, credTeBetalen, credEersteBetaling,
    crediteurenPerMaand, dagenTot, dagenTekst, vandaag,
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
