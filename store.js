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
  const VELDEN = ['objecten', 'huurcontracten', 'exploitatiekosten', 'leningen'];
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
    return bewaar();
  }

  function nieuwId(prefix) {
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  }

  return { bewaar, herstel, importeer, heeftWijzigingen, nieuwId, schoon, VELDEN };
})();
