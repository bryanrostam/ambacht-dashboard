/**
 * ============================================================
 *  DOCUMENTEN — opslag van bestanden per object (IndexedDB)
 *  Bestanden staan alleen in DEZE browser. Maak een back-up
 *  via "Download alles" op de objectpagina.
 * ============================================================
 */

window.DOCS = (function () {
  const DB_NAAM = 'dashboard_documenten';
  const MAX_BESTAND = 50 * 1024 * 1024;

  const SOORTEN = [
    { key: 'taxatierapport', label: 'Taxatierapport', check: () => true },
    { key: 'koopovereenkomst', label: 'Koopovereenkomst', check: o => o.status !== 'acquisitie' },
    { key: 'leveringsakte', label: 'Leveringsakte / eigendomsbewijs', check: o => o.status !== 'acquisitie' },
    { key: 'kadaster', label: 'Kadastraal uittreksel', check: () => true },
    { key: 'leningovereenkomst', label: 'Leningovereenkomst', check: (o, D) => D.leningen.some(l => l.object_id === o.id) },
    { key: 'huurovereenkomst', label: 'Huurovereenkomst', check: (o, D) => D.huurcontracten.some(h => h.object_id === o.id) },
    { key: 'energielabel', label: 'Energielabel', check: o => o.status !== 'bouw' },
    { key: 'verzekering', label: 'Verzekeringspolis', check: o => o.status !== 'acquisitie' },
    { key: 'vergunning', label: 'Bouwtekening / vergunning', check: o => o.status === 'bouw' },
    { key: 'onderhoud', label: 'Onderhoudsrapport (MJOP)', check: () => false },
    { key: 'overig', label: 'Overig', check: () => false },
    // Crediteurdossiers
    { key: 'factuur', label: 'Factuur', groep: 'crediteur', check: () => false },
    { key: 'aanmaning', label: 'Aanmaning / herinnering', groep: 'crediteur', check: () => false },
    { key: 'sommatie', label: 'Sommatie / incasso', groep: 'crediteur', check: () => false },
    { key: 'faillissement_brief', label: 'Faillissementsdreiging', groep: 'crediteur', check: () => false },
    { key: 'regeling', label: 'Betaalregeling', groep: 'crediteur', check: () => false },
    { key: 'betaalbewijs', label: 'Betaalbewijs', groep: 'crediteur', check: () => false },
    { key: 'correspondentie', label: 'Correspondentie', groep: 'crediteur', check: () => false },
  ];

  function raadCrediteurSoort(naam) {
    const n = naam.toLowerCase();
    const regels = [
      [/faillis/, 'faillissement_brief'],
      [/sommatie|incasso|deurwaarder|dagvaard/, 'sommatie'],
      [/aanmaning|herinnering|reminder/, 'aanmaning'],
      [/regeling|termijn/, 'regeling'],
      [/betaalbewijs|bevestiging|afschrift|receipt/, 'betaalbewijs'],
      [/factuur|invoice|nota|aanslag|fact/, 'factuur'],
      [/mail|brief|correspond/, 'correspondentie'],
    ];
    const r = regels.find(([re]) => re.test(n));
    return r ? r[1] : 'factuur';
  }

  // Soort raden aan de bestandsnaam
  function raadSoort(naam) {
    const n = naam.toLowerCase();
    const regels = [
      [/taxat|waardering|valuation/, 'taxatierapport'],
      [/lening|financier|krediet|hypothe|loan|facility/, 'leningovereenkomst'],
      [/koop|purchase|spa\b/, 'koopovereenkomst'],
      [/levering|akte|transport|eigendom/, 'leveringsakte'],
      [/huur|lease|rent/, 'huurovereenkomst'],
      [/kadast/, 'kadaster'],
      [/energie|label|epa/, 'energielabel'],
      [/verzeker|polis|insur/, 'verzekering'],
      [/vergunning|tekening|bouw|omgev/, 'vergunning'],
      [/mjop|onderhoud|inspectie/, 'onderhoud'],
    ];
    const r = regels.find(([re]) => re.test(n));
    return r ? r[1] : 'overig';
  }

  let dbBelofte = null;
  function db() {
    if (dbBelofte) return dbBelofte;
    dbBelofte = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) return reject(new Error('Deze browser ondersteunt geen documentopslag.'));
      const req = indexedDB.open(DB_NAAM, 1);
      req.onupgradeneeded = () => {
        const d = req.result;
        const meta = d.createObjectStore('meta', { keyPath: 'id' });
        meta.createIndex('object_id', 'object_id');
        d.createObjectStore('bestanden');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('Documentopslag niet beschikbaar (privévenster?).'));
    });
    // Vraag de browser de opslag niet automatisch op te ruimen
    try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { /* niets */ }
    return dbBelofte;
  }
  function tx(stores, modus, werk) {
    return db().then(d => new Promise((resolve, reject) => {
      const t = d.transaction(stores, modus);
      let resultaat;
      Promise.resolve(werk(t)).then(r => { resultaat = r; });
      t.oncomplete = () => resolve(resultaat);
      t.onerror = () => reject(t.error);
      t.onabort = () => reject(t.error || new Error('Opslaan afgebroken (opslag vol?).'));
    }));
  }
  const req2p = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });

  function alleMeta() {
    return tx(['meta'], 'readonly', t => req2p(t.objectStore('meta').getAll()));
  }
  function lijst(objectId) {
    return tx(['meta'], 'readonly', t => req2p(t.objectStore('meta').index('object_id').getAll(objectId)))
      .then(r => r.sort((a, b) => (b.toegevoegd || '').localeCompare(a.toegevoegd || '')));
  }
  function bestand(id) {
    return tx(['bestanden'], 'readonly', t => req2p(t.objectStore('bestanden').get(id)));
  }
  function voegToe(objectId, file, soort) {
    if (file.size > MAX_BESTAND) return Promise.reject(new Error(`${file.name} is groter dan 50 MB.`));
    const meta = {
      id: 'doc_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      object_id: objectId,
      soort: soort || raadSoort(file.name),
      naam: file.name,
      type: file.type || 'application/octet-stream',
      grootte: file.size,
      toegevoegd: new Date().toISOString(),
      documentdatum: null,
      notitie: '',
    };
    return tx(['meta', 'bestanden'], 'readwrite', t => {
      t.objectStore('meta').put(meta);
      t.objectStore('bestanden').put(file, meta.id);
      return meta;
    });
  }
  function wijzig(meta) {
    return tx(['meta'], 'readwrite', t => { t.objectStore('meta').put(meta); });
  }
  function verwijder(id) {
    return tx(['meta', 'bestanden'], 'readwrite', t => {
      t.objectStore('meta').delete(id);
      t.objectStore('bestanden').delete(id);
    });
  }
  function verwijderVoorObject(objectId) {
    return lijst(objectId).then(docs => Promise.all(docs.map(d => verwijder(d.id))));
  }

  function openen(id, naam) {
    return bestand(id).then(blob => {
      if (!blob) throw new Error('Bestand niet gevonden.');
      const url = URL.createObjectURL(blob);
      const w = window.open(url, '_blank');
      if (!w) downloaden(id, naam);
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    });
  }
  function downloaden(id, naam) {
    return bestand(id).then(blob => {
      if (!blob) throw new Error('Bestand niet gevonden.');
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: naam });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    });
  }

  function fmtGrootte(b) {
    if (b >= 1048576) return (b / 1048576).toFixed(1).replace('.', ',') + ' MB';
    if (b >= 1024) return Math.round(b / 1024) + ' kB';
    return b + ' B';
  }

  return { SOORTEN, raadSoort, raadCrediteurSoort, alleMeta, lijst, voegToe, wijzig, verwijder, verwijderVoorObject, openen, downloaden, fmtGrootte, MAX_BESTAND };
})();
