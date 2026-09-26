/**
 * ============================================================
 *  OPSLAG — eigen wijzigingen bovenop data.js
 *  Objecten, huurcontracten, exploitatiekosten en leningen die
 *  je in het dashboard toevoegt/wijzigt worden in deze browser
 *  bewaard (localStorage). data.js blijft de standaard.
 *  Laden NA data.js en VÓÓR engine.js.
 * ============================================================
 */

window.STORE = (function () {
  const KEY = 'portfolio_dashboard_data_v1';
  const VELDEN = ['objecten', 'huurcontracten', 'exploitatiekosten', 'leningen', 'crediteuren'];
  const D = window.FORTIS_DATA;

  // Tekst ontdoen van HTML-tekens, zodat ingevoerde namen nooit als HTML worden uitgevoerd
  function schoon(v) {
    if (typeof v === 'string') return v.replace(/[<>]/g, '');
    if (Array.isArray(v)) return v.map(schoon);
    if (v && typeof v === 'object') {
      const o = {};
      Object.keys(v).forEach(k => o[k] = schoon(v[k]));
      return o;
    }
    return v;
  }

  function lees() {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  // Opgeslagen wijzigingen toepassen op window.FORTIS_DATA
  const opgeslagen = lees();
  if (opgeslagen) {
    VELDEN.forEach(k => {
      if (Array.isArray(opgeslagen[k])) D[k] = schoon(opgeslagen[k]);
    });
  }

  // ---------- BETAALREGELING: termijnschema ----------
  // termijnen[]: { id, datum: "YYYY-MM-DD", bedrag, voldaan }  (voldaan = al betaald deel)
  // De oude velden termijn_bedrag / volgende_termijn / termijnen_resterend worden hieruit afgeleid,
  // zodat de rest van het dashboard (meldingen, eerst te betalen) er automatisch mee rekent.
  function plusMaand(iso, n) {
    const [j, m, d] = iso.split('-').map(Number);
    const x = new Date(j, m - 1 + n, d || 1);
    return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
  }
  function termijnenUitVastBedrag(c) {
    if (!c.termijn_bedrag || !c.volgende_termijn) return [];
    const uit = [];
    let rest = c.bedrag_open || 0;
    const n = c.termijnen_resterend || Math.ceil(rest / c.termijn_bedrag);
    for (let i = 0; i < n && rest > 0.005; i++) {
      const b = Math.round((i === n - 1 ? rest : Math.min(c.termijn_bedrag, rest)) * 100) / 100;   // laatste termijn: restant
      uit.push({ id: 't' + (i + 1) + '_' + Math.random().toString(36).slice(2, 6), datum: plusMaand(c.volgende_termijn, i), bedrag: b, voldaan: 0 });
      rest -= b;
    }
    return uit;
  }
  function syncRegeling(c) {
    if (c.status !== 'betaalregeling') return c;
    if (!Array.isArray(c.termijnen) || !c.termijnen.length) c.termijnen = termijnenUitVastBedrag(c);
    c.termijnen.sort((a, b) => (a.datum || '').localeCompare(b.datum || ''));
    const open = c.termijnen.filter(t => (t.bedrag || 0) - (t.voldaan || 0) > 0.005);
    const eerst = open[0];
    c.termijn_bedrag = eerst ? Math.round(((eerst.bedrag || 0) - (eerst.voldaan || 0)) * 100) / 100 : 0;
    c.volgende_termijn = eerst ? eerst.datum : null;
    c.termijnen_resterend = open.length;
    return c;
  }
  (D.crediteuren || []).forEach(syncRegeling);

  function bewaar() {
    const uit = {};
    VELDEN.forEach(k => uit[k] = D[k]);
    try {
      localStorage.setItem(KEY, JSON.stringify(uit));
      return true;
    } catch (e) {
      alert('Opslaan in de browser is niet gelukt (privévenster of opslag geblokkeerd). Exporteer je data om wijzigingen te bewaren.');
      return false;
    }
  }

  function heeftWijzigingen() {
    return !!opgeslagen;
  }

  function herstel() {
    try { localStorage.removeItem(KEY); } catch (e) { /* niets */ }
  }

  function importeer(obj) {
    if (!obj || typeof obj !== 'object') throw new Error('Ongeldig bestand');
    const bron = obj.objecten ? obj : obj.FORTIS_DATA || obj;
    if (!Array.isArray(bron.objecten) || !Array.isArray(bron.leningen)) {
      throw new Error('Bestand bevat geen objecten en leningen');
    }
    VELDEN.forEach(k => { if (Array.isArray(bron[k])) D[k] = schoon(bron[k]); });
    (D.crediteuren || []).forEach(syncRegeling);
    return bewaar();
  }

  function nieuwId(prefix) {
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  }

  return { bewaar, herstel, importeer, heeftWijzigingen, nieuwId, schoon, VELDEN, syncRegeling };
})();
