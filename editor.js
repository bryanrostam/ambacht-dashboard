/**
 * ============================================================
 *  EDITOR — objecten en leningen toevoegen, wijzigen, wissen
 *  Wijzigingen worden via STORE in de browser bewaard.
 *  Laden NA dashboard.js.
 * ============================================================
 */

(function () {
  const esc = v => String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  // ---------- VELDDEFINITIES ----------
  const OBJECT_VELDEN = [
    { groep: 'Algemeen' },
    { key: 'naam', label: 'Naam / adres', type: 'text', required: true, placeholder: 'Herengracht 142' },
    { key: 'stad', label: 'Stad', type: 'text', required: true },
    { key: 'type', label: 'Type', type: 'select', opties: ['kantoor', 'wonen', 'retail', 'gemengd', 'grond'] },
    { key: 'status', label: 'Status', type: 'select', opties: ['eigendom', 'bouw', 'acquisitie', 'herfi', 'verkoop'] },
    { key: 'eigenaar_bv', label: 'Eigenaar-BV', type: 'text', lijst: 'bv-lijst', placeholder: 'Leeg = nog geen BV' },
    { key: 'bvo_m2', label: 'BVO (m²)', type: 'number', step: 1 },
    { groep: 'Waarde & rendement' },
    { key: 'aankoopprijs', label: 'Aankoopprijs (€)', type: 'number', step: 1000 },
    { key: 'marktwaarde', label: 'Marktwaarde (€)', type: 'number', step: 1000 },
    { key: 'verwachte_verkoopprijs', label: 'Verwachte verkoopprijs (€)', type: 'number', step: 1000, hint: 'Alleen bij status verkoop' },
    { key: 'irr_pct', label: 'Verwachte IRR (%)', type: 'number', step: 0.1 },
    { key: 'verwachte_opleveringsdatum', label: 'Verwachte oplevering', type: 'date', hint: 'Alleen bij bouw' },
  ];
  const KOSTEN_VELDEN = [
    { key: 'onderhoud', label: 'Onderhoud' },
    { key: 'beheer', label: 'Beheer' },
    { key: 'verzekering', label: 'Verzekering' },
    { key: 'ozb', label: 'OZB' },
    { key: 'overig', label: 'Overig' },
  ];
  const LENING_VELDEN = [
    { groep: 'Algemeen' },
    { key: 'naam', label: 'Naam', type: 'text', required: true, placeholder: 'ING Amsterdam' },
    { key: 'object_id', label: 'Object', type: 'object' },
    { key: 'type', label: 'Type', type: 'select', opties: ['hypotheek', 'bouwfinanciering', 'asl', 'overbrugging', 'mezzanine'] },
    { key: 'geldgever', label: 'Geldgever', type: 'text' },
    { groep: 'Bedragen & rente' },
    { key: 'hoofdsom', label: 'Hoofdsom (€)', type: 'number', step: 1000 },
    { key: 'huidig_saldo', label: 'Huidig saldo (€)', type: 'number', step: 1000, required: true },
    { key: 'rente_pct', label: 'Rente (%)', type: 'number', step: 0.01, required: true },
    { key: 'rente_type', label: 'Rentetype', type: 'select', opties: ['vast', 'variabel'] },
    { key: 'aflossing_type', label: 'Aflossing', type: 'select', opties: ['annuiteit', 'lineair', 'bullet', 'geen'] },
    { groep: 'Looptijd & covenants' },
    { key: 'ingangsdatum', label: 'Ingangsdatum', type: 'date' },
    { key: 'einddatum', label: 'Einddatum', type: 'date' },
    { key: 'covenant_ltv_max', label: 'Covenant LTV max (%)', type: 'number', step: 1 },
    { key: 'covenant_dscr_min', label: 'Covenant DSCR min', type: 'number', step: 0.01 },
  ];

  const CREDITEUR_VELDEN = [
    { groep: 'Partij' },
    { key: 'naam', label: 'Naam partij', type: 'text', required: true, placeholder: 'Belastingdienst' },
    { key: 'categorie', label: 'Categorie', type: 'select', opties: ['leverancier', 'aannemer', 'belasting', 'nutsvoorziening', 'vve', 'adviseur', 'bank', 'overig'] },
    { key: 'entiteit', label: 'Te betalen door (BV)', type: 'text', lijst: 'bv-lijst' },
    { key: 'omschrijving', label: 'Omschrijving / factuur', type: 'text', breed: true },
    { key: 'contact', label: 'Contactpersoon / dossier', type: 'text', breed: true },
    { groep: 'Bedrag, status & deadline' },
    { key: 'bedrag_open', label: 'Openstaand bedrag (€)', type: 'number', step: 1, required: true },
    { key: 'status', label: 'Status', type: 'select', opties: ['open', 'betaalregeling', 'incasso', 'faillissement', 'betaald'],
      labels: { open: 'Open', betaalregeling: 'Betaalregeling', incasso: 'Incasso', faillissement: 'Faillissementsaanvraag dreigt', betaald: 'Betaald' } },
    { key: 'vervaldatum', label: 'Deadline (uiterste betaaldatum)', type: 'date' },
    { key: 'prioriteit', label: 'Prioriteit', type: 'select', num: true, opties: [1, 2, 3], labels: { 1: 'Hoog', 2: 'Middel', 3: 'Laag' } },
    { key: 'schuifruimte', label: 'Schuifruimte', type: 'select', opties: ['nee', 'beperkt', 'ja'], labels: { nee: 'Nee — moet op tijd', beperkt: 'Beperkt', ja: 'Ja' } },
    { key: 'max_uitstel_dagen', label: 'Max. uitstel (dagen)', type: 'number', step: 1 },
    { groep: 'Betaalregeling', id: 'groep-regeling' },
    { key: 'termijn_bedrag', label: 'Termijnbedrag per maand (€)', type: 'number', step: 1, regeling: true },
    { key: 'volgende_termijn', label: 'Volgende termijn', type: 'date', regeling: true },
    { key: 'termijnen_resterend', label: 'Resterende termijnen', type: 'number', step: 1, regeling: true },
    { groep: 'Notities' },
    { key: 'notitie', label: 'Afspraken / notities', type: 'textarea', breed: true },
  ];

  // ---------- MODAL ----------
  const modal = document.createElement('dialog');
  modal.className = 'modal';
  document.body.appendChild(modal);
  modal.addEventListener('click', e => { if (e.target === modal) modal.close(); });

  function veldHtml(f, waarde) {
    if (f.groep) return `<div class="f-groep"${f.id ? ` id="${f.id}"` : ''}>${f.groep}</div>`;
    const id = 'f-' + f.key;
    const req = f.required ? ' required' : '';
    let input;
    if (f.type === 'select') {
      input = `<select id="${id}" name="${f.key}">${f.opties.map(o => `<option value="${o}"${String(o) === String(waarde) ? ' selected' : ''}>${f.labels ? f.labels[o] : o}</option>`).join('')}</select>`;
    } else if (f.type === 'textarea') {
      input = `<textarea id="${id}" name="${f.key}">${esc(waarde)}</textarea>`;
    } else if (f.type === 'object') {
      input = `<select id="${id}" name="${f.key}"><option value="">Groepsniveau (geen object)</option>${D.objecten.map(o =>
        `<option value="${esc(o.id)}"${o.id === waarde ? ' selected' : ''}>${esc(o.naam)} — ${esc(o.stad)}</option>`).join('')}</select>`;
    } else {
      input = `<input id="${id}" name="${f.key}" type="${f.type}"${f.step ? ` step="${f.step}"` : ''}${f.lijst ? ` list="${f.lijst}"` : ''} value="${esc(waarde)}"${f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : ''}${req}>`;
    }
    return `<label class="f-veld${f.breed ? ' f-breed' : ''}${f.regeling ? ' f-regeling' : ''}" for="${id}"><span>${f.label}${f.required ? ' *' : ''}</span>${input}${f.hint ? `<small>${f.hint}</small>` : ''}</label>`;
  }

  function leesVelden(form, velden, doel) {
    velden.filter(f => f.key).forEach(f => {
      const el = form.elements[f.key];
      const v = el.value.trim();
      if (f.type === 'number' || f.num) {
        doel[f.key] = v === '' ? null : parseFloat(v);
      } else if (f.type === 'object' || f.key === 'eigenaar_bv') {
        doel[f.key] = v === '' ? null : v;
      } else if (f.type === 'date') {
        doel[f.key] = v === '' ? null : v;
      } else {
        doel[f.key] = v;
      }
    });
    return doel;
  }

  function openModal(titel, bodyHtml, onSave, onDelete) {
    modal.innerHTML = `
      <form method="dialog" class="modal-form" novalidate>
        <div class="modal-head">
          <h2>${titel}</h2>
          <button type="button" class="icon-btn" data-sluit aria-label="Sluiten">✕</button>
        </div>
        <div class="modal-body">${bodyHtml}</div>
        <div class="modal-foot">
          ${onDelete ? '<button type="button" class="btn btn-danger" data-wis>Verwijderen</button>' : ''}
          <span class="spacer"></span>
          <button type="button" class="btn" data-sluit>Annuleren</button>
          <button type="submit" class="btn btn-primary">Opslaan</button>
        </div>
      </form>`;
    const form = modal.querySelector('form');
    modal.querySelectorAll('[data-sluit]').forEach(b => b.onclick = () => modal.close());
    if (onDelete) modal.querySelector('[data-wis]').onclick = () => { if (onDelete()) modal.close(); };
    form.onsubmit = e => {
      e.preventDefault();
      if (!form.checkValidity()) { form.reportValidity(); return; }
      onSave(form);
    };
    modal.showModal();
    const eerste = form.querySelector('input, select');
    if (eerste) eerste.focus();
    return form;
  }

  function opslaanEnHerladen() {
    STORE.bewaar();
    location.reload();
  }

  // ---------- OBJECTEN ----------
  function huurRij(h = {}) {
    return `<div class="hc-rij">
      <input name="hc_huurder" placeholder="Huurder" value="${esc(h.huurder)}">
      <input name="hc_huur" type="number" step="100" placeholder="Huur/mnd €" value="${esc(h.huur_per_maand)}">
      <input name="hc_service" type="number" step="50" placeholder="Servicek./mnd €" value="${esc(h.servicekosten_per_maand)}">
      <input name="hc_eind" type="date" title="Einddatum (leeg = onbepaald)" value="${esc(h.einddatum)}">
      <select name="hc_index">${['CPI', 'vast', 'geen'].map(o => `<option${o === (h.indexatie_type || 'CPI') ? ' selected' : ''}>${o}</option>`).join('')}</select>
      <input name="hc_index_pct" type="number" step="0.1" placeholder="Index %" value="${esc(h.indexatie_pct)}">
      <input type="hidden" name="hc_id" value="${esc(h.id)}">
      <button type="button" class="icon-btn" data-hc-wis aria-label="Contract verwijderen">✕</button>
    </div>`;
  }

  function editObject(id) {
    const obj = id ? D.objecten.find(o => o.id === id) : { type: 'kantoor', status: 'eigendom' };
    if (!obj) return;
    const kosten = (id && D.exploitatiekosten.find(k => k.object_id === id)) || {};
    const contracten = id ? D.huurcontracten.filter(h => h.object_id === id) : [];
    const bvs = [...new Set(D.objecten.map(o => o.eigenaar_bv).concat(D.kasstand.map(k => k.entiteit)).filter(Boolean))];

    const body = `
      <datalist id="bv-lijst">${bvs.map(b => `<option value="${esc(b)}">`).join('')}</datalist>
      <div class="f-grid">${OBJECT_VELDEN.map(f => veldHtml(f, obj[f.key])).join('')}</div>
      <div class="f-groep">Exploitatiekosten (€ per jaar)</div>
      <div class="f-grid f-grid-5">${KOSTEN_VELDEN.map(f =>
        `<label class="f-veld"><span>${f.label}</span><input name="k_${f.key}" type="number" step="500" value="${esc(kosten[f.key])}"></label>`).join('')}</div>
      <div class="f-groep">Huurcontracten</div>
      <div class="hc-kop"><span>Huurder</span><span>Huur/mnd</span><span>Servicek./mnd</span><span>Einddatum</span><span>Indexatie</span><span>Index %</span><span></span></div>
      <div id="hc-lijst">${contracten.map(huurRij).join('')}</div>
      <button type="button" class="btn btn-small" id="hc-toevoegen">+ Huurcontract</button>`;

    const form = openModal(id ? 'Object wijzigen' : 'Object toevoegen', body, f => {
      const nieuw = leesVelden(f, OBJECT_VELDEN, id ? obj : {});
      if (!id) { nieuw.id = STORE.nieuwId('obj'); D.objecten.push(nieuw); }
      const oid = nieuw.id;

      // Exploitatiekosten
      const k = { object_id: oid };
      KOSTEN_VELDEN.forEach(kf => { const v = f.elements['k_' + kf.key].value; k[kf.key] = v === '' ? 0 : parseFloat(v); });
      D.exploitatiekosten = D.exploitatiekosten.filter(x => x.object_id !== oid).concat([k]);

      // Huurcontracten
      const oud = D.huurcontracten.filter(h => h.object_id === oid);
      const nieuweHc = [...f.querySelectorAll('.hc-rij')].map(r => {
        const q = n => r.querySelector(`[name=${n}]`).value.trim();
        if (!q('hc_huurder') && !q('hc_huur')) return null;
        const bestaand = oud.find(h => h.id === q('hc_id')) || {};
        return {
          ...bestaand,
          id: bestaand.id || STORE.nieuwId('hc'),
          object_id: oid,
          huurder: q('hc_huurder') || 'Onbekend',
          huur_per_maand: parseFloat(q('hc_huur')) || 0,
          servicekosten_per_maand: parseFloat(q('hc_service')) || 0,
          ingangsdatum: bestaand.ingangsdatum || D.meta.peildatum,
          einddatum: q('hc_eind') || null,
          indexatie_type: q('hc_index'),
          indexatie_pct: q('hc_index_pct') === '' ? null : parseFloat(q('hc_index_pct')),
          indexatie_maand: bestaand.indexatie_maand || 1,
        };
      }).filter(Boolean);
      D.huurcontracten = D.huurcontracten.filter(h => h.object_id !== oid).concat(nieuweHc);

      opslaanEnHerladen();
    }, id ? () => deleteObject(id) : null);

    const lijst = form.querySelector('#hc-lijst');
    form.querySelector('#hc-toevoegen').onclick = () => lijst.insertAdjacentHTML('beforeend', huurRij());
    lijst.addEventListener('click', e => { if (e.target.closest('[data-hc-wis]')) e.target.closest('.hc-rij').remove(); });
  }

  function deleteObject(id) {
    const obj = D.objecten.find(o => o.id === id);
    if (!obj) return false;
    if (!confirm(`Object "${obj.naam}" verwijderen?\nHuurcontracten en exploitatiekosten van dit object worden ook verwijderd.`)) return false;
    const leningen = D.leningen.filter(l => l.object_id === id);
    if (leningen.length) {
      const ookLeningen = confirm(`Er ${leningen.length === 1 ? 'is 1 lening' : 'zijn ' + leningen.length + ' leningen'} gekoppeld aan dit object (${leningen.map(l => l.naam).join(', ')}).\n\nOK = leningen ook verwijderen\nAnnuleren = leningen behouden op groepsniveau`);
      if (ookLeningen) D.leningen = D.leningen.filter(l => l.object_id !== id);
      else leningen.forEach(l => l.object_id = null);
    }
    D.objecten = D.objecten.filter(o => o.id !== id);
    D.huurcontracten = D.huurcontracten.filter(h => h.object_id !== id);
    D.exploitatiekosten = D.exploitatiekosten.filter(k => k.object_id !== id);
    opslaanEnHerladen();
    return true;
  }

  // ---------- LENINGEN ----------
  function editLening(id) {
    const l = id ? D.leningen.find(x => x.id === id) : { type: 'hypotheek', rente_type: 'vast', aflossing_type: 'annuiteit', ingangsdatum: D.meta.peildatum };
    if (!l) return;
    const body = `
      <div class="ai-upload" id="ai-upload">
        <input type="file" id="ai-bestand" accept="application/pdf,image/jpeg,image/png,image/webp" hidden>
        <div class="ai-upload-tekst">
          <strong>Leningovereenkomst uploaden</strong>
          <span>PDF, JPG of PNG (max. 3 MB). AI vult de velden in; jij controleert en slaat op.</span>
        </div>
        <button type="button" class="btn btn-small" id="ai-kies">Document kiezen</button>
      </div>
      <div id="ai-status"></div>
      <div class="f-grid">${LENING_VELDEN.map(f => veldHtml(f, l[f.key])).join('')}</div>
      <div id="ai-opmerkingen"></div>`;
    const form = openModal(id ? 'Lening wijzigen' : 'Lening toevoegen', body, f => {
      const nieuw = leesVelden(f, LENING_VELDEN, id ? l : {});
      if (nieuw.hoofdsom == null) nieuw.hoofdsom = nieuw.huidig_saldo;
      if (!id) { nieuw.id = STORE.nieuwId('ln'); D.leningen.push(nieuw); }
      opslaanEnHerladen();
    }, id ? () => deleteLening(id) : null);
    koppelAiUpload(form);
  }

  // ---------- AI: LENINGOVEREENKOMST UITLEZEN ----------
  const MAX_BESTAND = 3 * 1024 * 1024;
  const ZEKERHEID_TXT = { hoog: 'AI · zeker', middel: 'AI · controleren', laag: 'AI · onzeker' };

  function leesAlsBase64(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).split(',')[1]);
      r.onerror = () => reject(new Error('Bestand kon niet worden gelezen.'));
      r.readAsDataURL(file);
    });
  }

  // Onderpand-tekst koppelen aan een bestaand object (op naam of stad)
  function zoekObject(onderpand) {
    if (!onderpand) return null;
    const t = onderpand.toLowerCase();
    return D.objecten.find(o => o.naam && t.includes(o.naam.toLowerCase()))
      || D.objecten.find(o => o.stad && t.includes(o.stad.toLowerCase()))
      || null;
  }

  function markeer(form, key, info, weergave) {
    const el = form.elements[key];
    if (!el) return;
    const label = el.closest('.f-veld');
    label.classList.remove('ai-hoog', 'ai-middel', 'ai-laag');
    label.classList.add('ai-' + info.zekerheid);
    let tag = label.querySelector('.ai-tag');
    if (!tag) {
      tag = document.createElement('small');
      tag.className = 'ai-tag';
      label.appendChild(tag);
    }
    tag.textContent = ZEKERHEID_TXT[info.zekerheid] + (info.bron ? ' — "' + info.bron.slice(0, 140) + (info.bron.length > 140 ? '…"' : '"') : '') + (weergave || '');
    const wis = () => { label.classList.remove('ai-hoog', 'ai-middel', 'ai-laag'); tag.remove(); el.removeEventListener('input', wis); };
    el.addEventListener('input', wis);
  }

  function vulFormulier(form, resultaat) {
    const v = resultaat.velden || {};
    let gevuld = 0, onzeker = 0;
    LENING_VELDEN.filter(f => f.key && f.key !== 'object_id').forEach(f => {
      const info = v[f.key];
      if (!info || info.waarde === null || info.waarde === undefined || info.waarde === '') return;
      const el = form.elements[f.key];
      if (f.type === 'select' && !f.opties.includes(info.waarde)) return;
      el.value = info.waarde;
      markeer(form, f.key, info);
      gevuld++;
      if (info.zekerheid !== 'hoog') onzeker++;
    });
    // Object koppelen via het onderpand
    const onderpand = v.onderpand && v.onderpand.waarde;
    if (onderpand) {
      const obj = zoekObject(onderpand);
      if (obj) {
        form.elements.object_id.value = obj.id;
        markeer(form, 'object_id', { zekerheid: 'middel', bron: onderpand });
      } else {
        markeer(form, 'object_id', { zekerheid: 'laag', bron: onderpand }, ' · geen passend object gevonden, kies zelf');
      }
      gevuld++;
    }
    const opm = (resultaat.opmerkingen || []).filter(Boolean);
    form.querySelector('#ai-opmerkingen').innerHTML = opm.length
      ? `<div class="f-groep">Overige bepalingen uit het document</div><ul class="ai-opm">${opm.map(o => `<li>${esc(o)}</li>`).join('')}</ul>`
      : '';
    return { gevuld, onzeker };
  }

  function koppelAiUpload(form) {
    const input = form.querySelector('#ai-bestand');
    const zone = form.querySelector('#ai-upload');
    const status = form.querySelector('#ai-status');
    const zet = (niveau, html) => status.innerHTML = html ? `<div class="alert alert-${niveau} ai-melding"><div>${html}</div></div>` : "";
    const opslaanKnop = form.querySelector('button[type=submit]');

    async function verwerk(file) {
      if (!file) return;
      const type = file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : '');
      if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(type)) {
        zet('red', 'Kies een PDF, JPG, PNG of WEBP-bestand.'); return;
      }
      if (file.size > MAX_BESTAND) {
        zet('red', `Het bestand is ${(file.size / 1048576).toFixed(1).replace('.', ',')} MB; de limiet is 3 MB. Comprimeer de PDF of upload alleen de relevante pagina's.`); return;
      }
      zone.classList.add('bezig');
      opslaanKnop.disabled = true;
      zet('blue', `<span class="spinner"></span> <strong>${esc(file.name)}</strong> wordt gelezen… dit duurt meestal 20–60 seconden.`);
      try {
        const bestand = await leesAlsBase64(file);
        const resp = await fetch('api/lening-uitlezen', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bestand, mediaType: type }),
        });
        let data = null;
        try { data = await resp.json(); } catch (e) { /* geen JSON */ }
        if (!resp.ok) throw new Error((data && data.fout) || (resp.status === 404
          ? 'De AI-functie is niet bereikbaar. Die werkt alleen op de online (Vercel) versie van het dashboard.'
          : 'Uitlezen mislukt (' + resp.status + ').'));
        const { gevuld, onzeker } = vulFormulier(form, data);
        if (!gevuld) zet('amber', 'Er zijn geen leninggegevens in het document gevonden. Vul de velden handmatig in.');
        else zet('green', `<strong>${gevuld} velden ingevuld.</strong> Controleer alle gemarkeerde velden${onzeker ? ` — vooral de ${onzeker} gele/rode` : ''} — en klik daarna op Opslaan. Er wordt niets opgeslagen zonder jouw bevestiging.`);
      } catch (err) {
        zet('red', esc(err.message || 'Uitlezen mislukt.') + ' Je kunt de velden ook handmatig invullen.');
      } finally {
        zone.classList.remove('bezig');
        opslaanKnop.disabled = false;
        input.value = '';
      }
    }

    form.querySelector('#ai-kies').onclick = () => input.click();
    input.onchange = () => verwerk(input.files[0]);
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('sleep'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('sleep'));
    zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('sleep'); verwerk(e.dataTransfer.files[0]); });
  }

  function deleteLening(id) {
    const l = D.leningen.find(x => x.id === id);
    if (!l) return false;
    const tranches = D.bouw_tranches.filter(t => t.lening_id === id);
    if (!confirm(`Lening "${l.naam}" verwijderen?${tranches.length ? `\n${tranches.length} bouwtranche(s) van deze lening blijven in data.js staan.` : ''}`)) return false;
    D.leningen = D.leningen.filter(x => x.id !== id);
    opslaanEnHerladen();
    return true;
  }

  // ---------- CREDITEUREN ----------
  function editCrediteur(id) {
    if (!D.crediteuren) D.crediteuren = [];
    const c = id ? D.crediteuren.find(x => x.id === id) : { status: 'open', prioriteit: 2, schuifruimte: 'nee', categorie: 'leverancier' };
    if (!c) return;
    const bvs = [...new Set(D.kasstand.map(k => k.entiteit).concat(D.objecten.map(o => o.eigenaar_bv)).filter(Boolean))];
    const body = `<datalist id="bv-lijst">${bvs.map(b => `<option value="${esc(b)}">`).join('')}</datalist>
      <div class="f-grid">${CREDITEUR_VELDEN.map(f => veldHtml(f, c[f.key])).join('')}</div>`;
    const form = openModal(id ? 'Crediteur wijzigen' : 'Crediteur toevoegen', body, f => {
      const nieuw = leesVelden(f, CREDITEUR_VELDEN, id ? c : {});
      if (nieuw.status === 'betaald') nieuw.bedrag_open = 0;
      if (!id) { nieuw.id = STORE.nieuwId('cr'); D.crediteuren.push(nieuw); }
      opslaanEnHerladen();
    }, id ? () => deleteCrediteur(id) : null);
    // Betaalregeling-velden alleen tonen bij die status
    const status = form.elements.status;
    const toggle = () => {
      const aan = status.value === 'betaalregeling';
      form.querySelectorAll('.f-regeling').forEach(el => el.style.display = aan ? '' : 'none');
      form.querySelector('#groep-regeling').style.display = aan ? '' : 'none';
    };
    status.addEventListener('change', toggle);
    toggle();
  }

  function deleteCrediteur(id) {
    const c = (D.crediteuren || []).find(x => x.id === id);
    if (!c || !confirm(`Crediteur "${c.naam}" verwijderen?\nTip: zet de status op "Betaald" als je de historie wilt bewaren.`)) return false;
    D.crediteuren = D.crediteuren.filter(x => x.id !== id);
    opslaanEnHerladen();
    return true;
  }

  // ---------- EXPORT / IMPORT / HERSTEL ----------
  function download(naam, tekst, type) {
    const url = URL.createObjectURL(new Blob([tekst], { type }));
    const a = Object.assign(document.createElement('a'), { href: url, download: naam });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function exportDataJs() {
    const kop = `/**\n * Portfolio dashboard — data\n * Geëxporteerd uit het dashboard op ${new Date().toLocaleString('nl-NL')}.\n * Vervang data.js door dit bestand om de wijzigingen voor iedereen vast te leggen.\n */\n\n`;
    download('data.js', kop + 'window.FORTIS_DATA = ' + JSON.stringify(D, null, 2) + ';\n', 'application/javascript');
  }
  function importeer() {
    const inp = Object.assign(document.createElement('input'), { type: 'file', accept: '.json,.js,application/json,text/javascript' });
    inp.onchange = () => {
      const file = inp.files[0];
      if (!file) return;
      file.text().then(txt => {
        const start = txt.indexOf('{'), eind = txt.lastIndexOf('}');
        const obj = JSON.parse(txt.slice(start, eind + 1));
        if (STORE.importeer(obj)) location.reload();
      }).catch(err => alert('Importeren mislukt: ' + err.message + '\nGebruik een bestand dat met "Exporteer data.js" is gemaakt.'));
    };
    inp.click();
  }
  function herstel() {
    if (!confirm('Alle eigen wijzigingen in deze browser wissen en terug naar de gegevens uit data.js?')) return;
    STORE.herstel();
    location.reload();
  }

  // ---------- KNOPPEN IN DE PAGINA ----------
  function knoppenInTabel(tabelId, onEdit) {
    const tbl = document.getElementById(tabelId);
    if (!tbl) return;
    const th = tbl.querySelector('thead tr');
    if (th && !th.querySelector('.th-acties')) th.insertAdjacentHTML('beforeend', '<th class="th-acties"></th>');
    tbl.querySelectorAll('tbody tr[data-id]').forEach(tr => {
      if (tr.querySelector('.row-actions')) return;
      tr.insertAdjacentHTML('beforeend', `<td class="row-actions"><button type="button" class="icon-btn" data-edit title="Wijzigen" aria-label="Wijzigen">✎</button></td>`);
      tr.classList.add('klikbaar');
      tr.onclick = () => onEdit(tr.dataset.id);
    });
  }

  // Na het (lazy) opbouwen van een pagina de bewerk-knoppen toevoegen
  const origNav = window.nav;
  window.nav = function (id, el) {
    origNav(id, el);
    if (id === 'portfolio') knoppenInTabel('port-tbl', editObject);
    if (id === 'financiering') knoppenInTabel('fin-tbl', editLening);
    try { history.replaceState(null, '', '#' + id); } catch (e) { /* file:// */ }
  };

  window.EDITOR = { editObject, editLening, editCrediteur, exportDataJs, importeer, herstel };

  // Status in de zijbalk
  if (STORE.heeftWijzigingen()) {
    const s = document.getElementById('data-status');
    if (s) s.textContent = 'Eigen wijzigingen actief (deze browser)';
  }

  // Terug naar de pagina uit de URL (bijv. na opslaan)
  const start = location.hash.replace('#', '');
  const item = start && document.querySelector(`.nav-item[data-page="${start}"]`);
  if (item) window.nav(start, item);
})();
