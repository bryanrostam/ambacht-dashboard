/**
 * ============================================================
 *  CREDITEURDOSSIER — alles over één crediteur
 *  Facturen, openstaande bedragen, eerst te betalen, betalen
 *  vanuit welke BV, betalingen, betaalregeling en documenten.
 *  Laden NA dashboard.js, docs.js; VÓÓR editor.js.
 * ============================================================
 */

const DOSSIER_SLEUTEL = 'dossier_open';

// Vanaf elke plek: naar Crediteuren en het dossier openen
function openDossier(id) {
  const item = document.querySelector('.nav-item[data-page="crediteuren"]');
  try { sessionStorage.setItem(DOSSIER_SLEUTEL, id); } catch (e) { /* niets */ }
  if (!document.getElementById('page-crediteuren').classList.contains('active') && item) {
    nav('crediteuren', item);          // bouwt de pagina en opent het dossier
  }
  toonDossier(id);
}

// Klik op "Crediteuren" in het menu terwijl een dossier open staat → terug naar het overzicht
(function () {
  const vorige = window.nav;
  window.nav = function (id, el) {
    const eersteKeer = el && !el.dataset.built;   // eerste opbouw = na laden/opslaan
    vorige(id, el);
    if (id === 'crediteuren') {
      let open = null;
      try { open = sessionStorage.getItem(DOSSIER_SLEUTEL); } catch (e) { /* niets */ }
      if (eersteKeer && open) toonDossier(open);
      else sluitDossier();
    }
  };
})();

function sluitDossier() {
  try { sessionStorage.removeItem(DOSSIER_SLEUTEL); } catch (e) { /* niets */ }
  document.getElementById('cred-dossier').hidden = true;
  document.getElementById('cred-overzicht').hidden = false;
  const tp = document.getElementById('tb-pagina');
  if (tp) tp.textContent = 'Crediteuren';
}

// Vrije kas per entiteit (saldo − restricted)
function vrijeKasBV(bv) {
  const k = D.kasstand.find(x => x.entiteit === bv);
  return k ? k.saldo - (k.restricted || 0) : null;
}

// bedrag_open en status bijwerken vanuit de facturen
function herberekenCrediteur(c) {
  if (c.facturen && c.facturen.length) {
    c.bedrag_open = c.facturen.reduce((s, f) => s + Math.max(0, f.open || 0), 0);
  }
  if ((c.bedrag_open || 0) <= 0 && c.status !== 'betaald') c.status = 'betaald';
}

function bewaarEnHerlaad(id) {
  try { sessionStorage.setItem(DOSSIER_SLEUTEL, id); } catch (e) { /* niets */ }
  STORE.bewaar();
  location.reload();
}

// Exacte bedragen in het dossier (€ 6.705,00)
const euro = v => (v < 0 ? '-€ ' : '€ ') + Math.abs(v || 0).toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const nlDatum = iso => iso ? E.fmtDatum(iso) : '—';
const vandaagIso = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };

function toonDossier(id) {
  const c = (D.crediteuren || []).find(x => x.id === id);
  if (!c) return sluitDossier();
  try { sessionStorage.setItem(DOSSIER_SLEUTEL, id); } catch (e) { /* niets */ }
  document.getElementById('cred-overzicht').hidden = true;
  const root = document.getElementById('cred-dossier');
  root.hidden = false;
  window.scrollTo(0, 0);
  setTimeout(() => { const tp = document.getElementById('tb-pagina'); if (tp) tp.textContent = 'Crediteuren / ' + c.naam; }, 0);

  const u = E.credUrgentie(c);
  const eerst = E.credEersteBetaling(c);
  const deadline = E.credDeadline(c);
  const facturen = (c.facturen || []).slice().sort((a, b) => (a.vervaldatum || '').localeCompare(b.vervaldatum || ''));
  const betalingen = (c.betalingen || []).slice().sort((a, b) => (b.datum || '').localeCompare(a.datum || ''));
  const betaald = betalingen.reduce((s, b) => s + (b.bedrag || 0), 0);
  const prioTxt = { 1: 'Hoog', 2: 'Middel', 3: 'Laag' };
  const schuifTxt = c.schuifruimte === 'ja' ? `Uitstel tot ${c.max_uitstel_dagen || 30} dagen mogelijk`
    : c.schuifruimte === 'beperkt' ? `Beperkt schuifbaar: max ${c.max_uitstel_dagen || 7} dagen` : 'Niet schuifbaar — moet op tijd';

  // Per BV: wat staat er open op facturen van die BV, en is er genoeg vrije kas?
  const perBV = {};
  facturen.filter(f => f.open > 0).forEach(f => {
    const bv = f.bv || c.entiteit || 'Onbekend';
    perBV[bv] = perBV[bv] || { open: 0, eerst: 0 };
    perBV[bv].open += f.open;
  });
  eerst.facturen.forEach(f => { const bv = f.bv || c.entiteit || 'Onbekend'; if (perBV[bv]) perBV[bv].eerst += f.open; });
  if (!facturen.length && c.bedrag_open > 0) perBV[c.entiteit || 'Onbekend'] = { open: c.bedrag_open, eerst: eerst.bedrag };
  if (c.status === 'betaalregeling' && Object.keys(perBV).length === 1) perBV[Object.keys(perBV)[0]].eerst = eerst.bedrag;

  const regelingSchema = c.status === 'betaalregeling' ? (c.termijnen || []).slice().sort((a, b) => (a.datum || '').localeCompare(b.datum || '')) : [];
  const schemaTotaal = regelingSchema.reduce((s, t) => s + (t.bedrag || 0), 0);
  const schemaBetaald = regelingSchema.reduce((s, t) => s + Math.min(t.voldaan || 0, t.bedrag || 0), 0);
  const eersteOpen = regelingSchema.find(t => (t.bedrag || 0) - (t.voldaan || 0) > 0.005);

  root.innerHTML = `
    <button type="button" class="terug-link" id="dos-terug">← Alle crediteuren</button>
    <div class="obj-detail-kop">
      <div>
        <div class="page-title">${esc(c.naam)}</div>
        <div class="page-sub">${esc(c.omschrijving || c.categorie || '')}${c.entiteit ? ' · ' + esc(c.entiteit) : ''}</div>
      </div>
      <div class="obj-detail-acties">
        ${badge(E.CRED_STATUS[c.status]?.label || c.status, CRED_BADGE[c.status] || 'gray')}
        <span class="prio prio-${c.prioriteit || 2}">Prio ${prioTxt[c.prioriteit || 2]}</span>
        <button type="button" class="btn btn-small" id="dos-wijzig">Dossier wijzigen</button>
        ${c.status !== 'betaald' ? '<button type="button" class="btn btn-primary btn-small" id="dos-betaal">Betaling registreren</button>' : ''}
      </div>
    </div>

    ${c.status !== 'betaald' ? `<div class="dos-eerst ${u.niveau}">
      <div class="dos-eerst-links">
        <span class="dos-eerst-label">Eerst te betalen</span>
        <span class="dos-eerst-bedrag">${euro(eerst.bedrag)}</span>
        <span class="dos-eerst-reden">${esc(eerst.reden)}</span>
      </div>
      <div class="dos-eerst-rechts">
        <div><span>Uiterlijk</span><strong>${nlDatum(deadline)}</strong><em>${E.dagenTekst(u.dagen)}</em></div>
        <div><span>Schuifruimte</span><strong>${schuifTxt}</strong></div>
      </div>
    </div>` : alertEl('ok', 'Dit dossier is volledig betaald.')}

    <div class="kg g4">
      ${kpi('Openstaand', euro(c.bedrag_open || 0), facturen.filter(f => f.open > 0).length + ' openstaande factu(u)r(en)', c.bedrag_open ? 'kv-red' : 'kv-green')}
      ${kpi('Eerst te betalen', euro(eerst.bedrag), 'vóór ' + nlDatum(deadline), u.niveau === 'kritiek' ? 'kv-red' : 'kv-amber')}
      ${kpi('Totaal gefactureerd', euro(facturen.reduce((s, f) => s + (f.bedrag || 0), 0) || c.bedrag_open || 0, 2), facturen.length + ' factu(u)r(en)')}
      ${kpi('Al betaald', euro(betaald), betalingen.length + ' betaling(en)', 'kv-green')}
    </div>

    <div class="kg g2">
      <div class="card" style="margin-bottom:0">
        <div class="card-title">Betaalgegevens</div>
        <div class="dos-gegevens">
          ${regel('IBAN', c.iban, true)}
          ${regel('Ten name van', c.tnv || c.naam)}
          ${regel('Betalingskenmerk', c.betaalkenmerk, true)}
        </div>
      </div>
      <div class="card" style="margin-bottom:0">
        <div class="card-title">Betalen vanuit</div>
        ${Object.keys(perBV).length ? Object.entries(perBV).map(([bv, x]) => {
          const vrij = vrijeKasBV(bv);
          const genoeg = vrij !== null && vrij >= x.eerst;
          return `<div class="dos-bv">
            <div><div class="cred-naam">${esc(bv)}</div><small>Op factuur · ${euro(x.open)} open${x.eerst ? ' · eerst ' + euro(x.eerst) : ''}</small></div>
            <div class="dos-bv-kas ${vrij === null ? '' : genoeg ? 'ok' : 'tekort'}">
              <span>Vrije kas</span><strong>${vrij === null ? 'Onbekend' : euro(vrij)}</strong>
              <small>${vrij === null ? 'BV niet in kasstand' : genoeg ? '✓ Voldoende voor eerste betaling' : '✕ Tekort ' + euro(x.eerst - vrij)}</small>
            </div>
          </div>`;
        }).join('') : '<p style="color:var(--text-3)">Geen openstaande facturen.</p>'}
      </div>
    </div>

    <div class="card" style="margin-top:18px">
      <div class="card-head">
        <div class="card-title">Contactpersonen</div>
        <button type="button" class="btn btn-small" id="dos-contact">+ Contactpersoon</button>
      </div>
      ${(c.contacten || []).length ? `<div class="contact-grid">${c.contacten.map(ct => `
        <div class="contact-kaart" data-contact="${esc(ct.id)}">
          <div class="contact-kop">
            <div class="contact-avatar">${esc(initialenVan(ct.naam))}</div>
            <div class="contact-naam-wrap">
              <div class="contact-naam">${esc(ct.naam || 'Naamloos')}</div>
              <div class="contact-functie">${esc(ct.functie || '')}${ct.functie && ct.bedrijf ? '<br>' : ''}${esc(ct.bedrijf || '')}${!ct.functie && !ct.bedrijf ? '—' : ''}</div>
              ${ct.rol ? `<div class="contact-rol">${badge(ROL_LABEL[ct.rol] || ct.rol, ROL_KLEUR[ct.rol] || 'gray')}</div>` : ''}
            </div>
          </div>
          <div class="contact-links">
            ${ct.telefoon ? `<a href="tel:${esc(ct.telefoon.replace(/[^+\d]/g, ''))}">☎ ${esc(ct.telefoon)}</a>` : '<span class="leeg">Geen telefoon</span>'}
            ${ct.email ? `<a href="mailto:${esc(ct.email)}">✉ ${esc(ct.email)}</a>` : '<span class="leeg">Geen e-mail</span>'}
          </div>
          <button type="button" class="icon-btn contact-wijzig" data-contact-wijzig="${esc(ct.id)}" title="Wijzigen" aria-label="Contactpersoon wijzigen">✎</button>
        </div>`).join('')}</div>`
      : `<p style="color:var(--text-3);font-size:14px">${c.contact ? 'Contact: ' + esc(c.contact) + ' — ' : ''}Nog geen contactpersonen. Voeg de crediteur, advocaat of het incassobureau toe met telefoon en e-mail.</p>`}
    </div>

    <div class="card">
      <div class="card-head">
        <div class="card-title">Facturen</div>
        <button type="button" class="btn btn-small" id="dos-factuur">+ Factuur toevoegen</button>
      </div>
      <div class="tbl-wrap"><table class="tbl">${facturen.length ? `
        <thead><tr><th>Factuurnr.</th><th>Omschrijving</th><th>BV op factuur</th><th>Factuurdatum</th><th>Vervaldatum</th><th>Bedrag</th><th>Open</th><th></th></tr></thead>
        <tbody>${facturen.map(f => {
          const dagen = f.open > 0 ? E.dagenTot(f.vervaldatum) : null;
          const eersteF = eerst.facturen.some(x => x.id === f.id);
          return `<tr class="klikbaar" data-factuur="${esc(f.id)}">
            <td style="font-weight:600">${esc(f.nummer || '—')}${eersteF ? ' <span class="badge badge-red">Eerst</span>' : ''}</td>
            <td>${esc(f.omschrijving || '')}</td>
            <td>${esc(f.bv || c.entiteit || '—')}</td>
            <td class="td-nowrap">${nlDatum(f.datum)}</td>
            <td class="td-nowrap ${dagen !== null && dagen < 0 ? 'red' : ''}">${nlDatum(f.vervaldatum)}${dagen !== null ? `<br><span class="cred-dagen">${E.dagenTekst(dagen)}</span>` : ''}</td>
            <td class="num">${euro(f.bedrag)}</td>
            <td class="num ${f.open > 0 ? 'red' : 'green'}">${f.open > 0 ? euro(f.open) : 'Betaald'}</td>
            <td class="row-actions"><span class="rij-pijl">›</span></td>
          </tr>`;
        }).join('')}</tbody>`
        : `<tbody><tr><td style="color:var(--text-3)">Nog geen facturen. Voeg facturen toe om per factuur en per BV te zien wat er openstaat${c.bedrag_open ? ` (nu ${euro(c.bedrag_open)} openstaand zonder factuurdetails)` : ''}.</td></tr></tbody>`}</table></div>
    </div>

    ${regelingSchema.length ? `<div class="card">
      <div class="card-head">
        <div class="card-title">Betaalregeling — termijnschema</div>
        <button type="button" class="btn btn-small" id="dos-schema">Schema wijzigen</button>
      </div>
      <div class="dos-termijnen">${regelingSchema.map((t, i) => {
        const rest = (t.bedrag || 0) - (t.voldaan || 0);
        const vol = rest <= 0.005;
        const dagen = vol ? null : E.dagenTot(t.datum);
        return `<div class="dos-termijn${vol ? ' voldaan' : t === eersteOpen ? ' eerst' : ''}${!vol && dagen !== null && dagen < 0 ? ' te-laat' : ''}">
          <span class="tm-label">Termijn ${i + 1}</span>
          <strong>${euro(t.bedrag)}</strong>
          <span>vóór ${nlDatum(t.datum)}</span>
          <em>${vol ? '✓ Betaald' : (t.voldaan > 0 ? euro(t.voldaan) + ' betaald · ' : '') + E.dagenTekst(dagen)}</em>
        </div>`;
      }).join('')}</div>
      <div class="dos-schema-totaal">
        <div><span>Totaal regeling</span><strong>${euro(schemaTotaal)}</strong></div>
        <div><span>Betaald</span><strong class="kv-green">${euro(schemaBetaald)}</strong></div>
        <div><span>Nog te betalen</span><strong>${euro(schemaTotaal - schemaBetaald)}</strong></div>
        <div class="dos-schema-voortgang"><span style="width:${schemaTotaal ? Math.round(schemaBetaald / schemaTotaal * 100) : 0}%"></span></div>
      </div>
    </div>` : ''}

    <div class="kg g2">
      <div class="card" style="margin-bottom:0">
        <div class="card-title">Betalingen</div>
        <div class="tbl-wrap"><table class="tbl">${betalingen.length ? `
          <thead><tr><th>Datum</th><th>Bedrag</th><th>Vanuit</th><th>Factuur</th><th></th></tr></thead>
          <tbody>${betalingen.map(b => {
            const f = facturen.find(x => x.id === b.factuur_id);
            return `<tr><td class="td-nowrap">${nlDatum(b.datum)}</td><td class="num green">${euro(b.bedrag)}</td><td>${esc(b.bv || '—')}</td>
              <td>${esc(f ? f.nummer : (b.factuur_id ? '—' : 'Verdeeld'))}${b.notitie ? `<div class="cred-oms">${esc(b.notitie)}</div>` : ''}</td>
              <td class="row-actions"><button type="button" class="icon-btn" data-betaling-wis="${esc(b.id)}" title="Betaling verwijderen" aria-label="Betaling verwijderen">✕</button></td></tr>`;
          }).join('')}</tbody>`
          : '<tbody><tr><td style="color:var(--text-3)">Nog geen betalingen geregistreerd.</td></tr></tbody>'}</table></div>
      </div>
      <div class="card" style="margin-bottom:0">
        <div class="card-head">
          <div class="card-title">Documenten</div>
          <button type="button" class="btn btn-small" id="dos-doc-kies">+ Toevoegen</button>
        </div>
        <input type="file" id="dos-doc-input" multiple hidden>
        <div class="doc-drop dos-drop" id="dos-drop"><div><strong>Sleep facturen, aanmaningen of brieven hierheen</strong></div><span>PDF, afbeelding of e-mail · max. 50 MB</span></div>
        <div id="dos-docs"></div>
      </div>
    </div>

    ${c.notitie ? `<div class="card" style="margin-top:18px"><div class="card-title">Afspraken &amp; notities</div><p class="dos-notitie">${esc(c.notitie)}</p></div>` : ''}`;

  function regel(label, waarde, kopieer) {
    return `<div class="dos-regel"><span>${label}</span><strong>${waarde ? esc(waarde) : '<em style="color:var(--text-3);font-weight:400">Niet ingevuld</em>'}</strong>${waarde && kopieer ? `<button type="button" class="icon-btn" data-kopieer="${esc(waarde)}" title="Kopiëren" aria-label="${label} kopiëren">⧉</button>` : ''}</div>`;
  }

  root.querySelector('#dos-terug').onclick = sluitDossier;
  root.querySelector('#dos-wijzig').onclick = () => EDITOR.editCrediteur(c.id);
  const bk = root.querySelector('#dos-betaal');
  if (bk) bk.onclick = () => betalingModal(c, eerst);
  root.querySelector('#dos-factuur').onclick = () => factuurModal(c);
  root.querySelector('#dos-contact').onclick = () => contactModal(c);
  const sk = root.querySelector('#dos-schema');
  if (sk) sk.onclick = () => EDITOR.editCrediteur(c.id);
  root.querySelectorAll('[data-contact-wijzig]').forEach(b => b.onclick = () => contactModal(c, b.dataset.contactWijzig));
  root.querySelectorAll('[data-factuur]').forEach(tr => tr.onclick = () => factuurModal(c, tr.dataset.factuur));
  root.querySelectorAll('[data-kopieer]').forEach(b => b.onclick = () => {
    const t = b.dataset.kopieer;
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => { b.textContent = '✓'; setTimeout(() => b.textContent = '⧉', 1200); }).catch(() => prompt('Kopieer:', t));
  });
  root.querySelectorAll('[data-betaling-wis]').forEach(b => b.onclick = () => verwijderBetaling(c, b.dataset.betalingWis));
  koppelDossierDocs(c);
}

// ---------- BETALING REGISTREREN ----------
function betalingModal(c, eerst) {
  const open = (c.facturen || []).filter(f => f.open > 0).sort((a, b) => (a.vervaldatum || '').localeCompare(b.vervaldatum || ''));
  const bvs = [...new Set([...(c.facturen || []).map(f => f.bv), c.entiteit, ...D.kasstand.map(k => k.entiteit)].filter(Boolean))];
  const standaardBV = (eerst.facturen[0] && eerst.facturen[0].bv) || c.entiteit || bvs[0] || '';
  const body = `<div class="f-grid f-grid-2" style="margin-top:14px">
    <label class="f-veld"><span>Bedrag (€) *</span><input name="bedrag" type="number" step="0.01" min="0.01" required value="${eerst.bedrag || ''}"></label>
    <label class="f-veld"><span>Betaaldatum *</span><input name="datum" type="date" required value="${vandaagIso()}"></label>
    <label class="f-veld"><span>Betaald vanuit</span><select name="bv">${bvs.map(b => `<option${b === standaardBV ? ' selected' : ''}>${esc(b)}</option>`).join('')}</select><small id="bet-kas"></small></label>
    <label class="f-veld"><span>Toewijzen aan</span><select name="factuur"><option value="">Automatisch — oudste factuur eerst</option>${open.map(f => `<option value="${esc(f.id)}">${esc(f.nummer || f.omschrijving || f.id)} · ${euro(f.open)} open</option>`).join('')}</select></label>
    <label class="f-veld f-breed"><span>Notitie</span><input name="notitie" placeholder="Bijv. termijn 2, betaald via ING zakelijk"></label>
  </div>
  <p class="modal-uitleg">De betaling wordt afgeboekt van de openstaande facturen${c.status === 'betaalregeling' ? ' en van de termijnen van de betaalregeling (oudste eerst)' : ''}. Staat alles op nul, dan krijgt het dossier de status <em>Betaald</em>.</p>`;
  const form = EDITOR.openModal('Betaling registreren — ' + esc(c.naam), body, f => {
    const bedrag = parseFloat(f.elements.bedrag.value);
    if (!(bedrag > 0)) return;
    const factuurId = f.elements.factuur.value;
    let rest = bedrag;
    c.facturen = c.facturen || [];
    const volgorde = factuurId ? [c.facturen.find(x => x.id === factuurId), ...open.filter(x => x.id !== factuurId)] : open;
    volgorde.filter(Boolean).forEach(fa => {
      if (rest <= 0) return;
      const af = Math.min(fa.open, rest);
      fa.open = Math.round((fa.open - af) * 100) / 100;
      rest = Math.round((rest - af) * 100) / 100;
    });
    if (!c.facturen.length) c.bedrag_open = Math.max(0, (c.bedrag_open || 0) - bedrag);
    // Betaalregeling: afboeken op de termijnen, oudste eerst
    const toewijzing = [];
    if (c.status === 'betaalregeling' && Array.isArray(c.termijnen)) {
      let r = bedrag;
      c.termijnen.slice().sort((a, b) => (a.datum || '').localeCompare(b.datum || '')).forEach(t => {
        const ruimte = Math.round(((t.bedrag || 0) - (t.voldaan || 0)) * 100) / 100;
        if (r <= 0 || ruimte <= 0) return;
        const af = Math.min(ruimte, r);
        t.voldaan = Math.round(((t.voldaan || 0) + af) * 100) / 100;
        toewijzing.push({ id: t.id, bedrag: af });
        r = Math.round((r - af) * 100) / 100;
      });
    }
    c.betalingen = c.betalingen || [];
    c.betalingen.push({ id: STORE.nieuwId('bet'), datum: f.elements.datum.value, bedrag, bv: f.elements.bv.value, factuur_id: factuurId || (volgorde.length === 1 ? volgorde[0].id : null), termijnen: toewijzing, notitie: f.elements.notitie.value.trim() });
    herberekenCrediteur(c);
    STORE.syncRegeling(c);
    bewaarEnHerlaad(c.id);
  });
  const toonKas = () => {
    const vrij = vrijeKasBV(form.elements.bv.value);
    const bedrag = parseFloat(form.elements.bedrag.value) || 0;
    const el = form.querySelector('#bet-kas');
    el.textContent = vrij === null ? 'Kasstand van deze BV onbekend' : `Vrije kas ${euro(vrij)}${bedrag > vrij ? ' — onvoldoende!' : ''}`;
    el.style.color = vrij !== null && bedrag > vrij ? 'var(--red)' : '';
  };
  form.elements.bv.onchange = toonKas;
  form.elements.bedrag.oninput = toonKas;
  toonKas();
}

function verwijderBetaling(c, betId) {
  const b = (c.betalingen || []).find(x => x.id === betId);
  if (!b || !confirm(`Betaling van ${euro(b.bedrag)} op ${nlDatum(b.datum)} verwijderen? Het bedrag wordt weer als openstaand geboekt.`)) return;
  // Terugboeken: op de gekoppelde factuur, anders op de laatst betaalde facturen
  let rest = b.bedrag;
  const facturen = c.facturen || [];
  const doelen = b.factuur_id ? facturen.filter(f => f.id === b.factuur_id).concat(facturen.filter(f => f.id !== b.factuur_id)) : facturen.slice().reverse();
  doelen.forEach(f => {
    if (rest <= 0) return;
    const ruimte = (f.bedrag || 0) - (f.open || 0);
    const terug = Math.min(ruimte, rest);
    f.open = Math.round(((f.open || 0) + terug) * 100) / 100;
    rest -= terug;
  });
  if (!facturen.length) c.bedrag_open = (c.bedrag_open || 0) + b.bedrag;
  // Termijnen terugdraaien
  (b.termijnen || []).forEach(tw => {
    const t = (c.termijnen || []).find(x => x.id === tw.id);
    if (t) t.voldaan = Math.max(0, Math.round(((t.voldaan || 0) - tw.bedrag) * 100) / 100);
  });
  c.betalingen = c.betalingen.filter(x => x.id !== betId);
  if (c.status === 'betaald') c.status = (c.termijnen && c.termijnen.length) || c.termijn_bedrag ? 'betaalregeling' : 'open';
  herberekenCrediteur(c);
  STORE.syncRegeling(c);
  bewaarEnHerlaad(c.id);
}

// ---------- CONTACTPERSONEN ----------
const ROL_LABEL = { crediteur: 'Crediteur', advocaat: 'Advocaat', incassobureau: 'Incassobureau', deurwaarder: 'Deurwaarder', curator: 'Curator', boekhouding: 'Administratie', overig: 'Overig' };
const ROL_KLEUR = { crediteur: 'blue', advocaat: 'red', incassobureau: 'amber', deurwaarder: 'red', curator: 'red', boekhouding: 'gray', overig: 'gray' };
function initialenVan(naam) {
  const delen = String(naam || '').replace(/^(mr|dhr|mevr|ir|drs|dr)\.?\s+/i, '').split(/[\s.]+/).filter(w => w && /[a-zA-Z]/.test(w[0]));
  if (!delen.length) return '?';
  return (delen[0][0] + (delen.length > 1 ? delen[delen.length - 1][0] : '')).toUpperCase();
}

function contactModal(c, contactId) {
  c.contacten = c.contacten || [];
  const ct = contactId ? c.contacten.find(x => x.id === contactId) : { rol: c.contacten.length ? 'advocaat' : 'crediteur', bedrijf: c.contacten.length ? '' : c.naam };
  if (!ct) return;
  const body = `<div class="f-grid f-grid-2" style="margin-top:14px">
    <label class="f-veld"><span>Naam *</span><input name="naam" required value="${esc(ct.naam || '')}" placeholder="Bijv. mr. J. de Groot"></label>
    <label class="f-veld"><span>Rol</span><select name="rol">${Object.entries(ROL_LABEL).map(([k, v]) => `<option value="${k}"${k === ct.rol ? ' selected' : ''}>${v}</option>`).join('')}</select></label>
    <label class="f-veld"><span>Functie</span><input name="functie" value="${esc(ct.functie || '')}" placeholder="Bijv. advocaat, financieel manager"></label>
    <label class="f-veld"><span>Bedrijf / kantoor</span><input name="bedrijf" value="${esc(ct.bedrijf || '')}" placeholder="Bijv. De Groot &amp; Partners Advocaten"></label>
    <label class="f-veld"><span>Telefoon</span><input name="telefoon" type="tel" value="${esc(ct.telefoon || '')}" placeholder="06 12 34 56 78"></label>
    <label class="f-veld"><span>E-mailadres</span><input name="email" type="email" value="${esc(ct.email || '')}" placeholder="naam@kantoor.nl"></label>
  </div>`;
  EDITOR.openModal(contactId ? 'Contactpersoon wijzigen' : 'Contactpersoon toevoegen', body, f => {
    const e = f.elements;
    Object.assign(ct, { naam: e.naam.value.trim(), rol: e.rol.value, functie: e.functie.value.trim(), bedrijf: e.bedrijf.value.trim(), telefoon: e.telefoon.value.trim(), email: e.email.value.trim() });
    if (!contactId) { ct.id = STORE.nieuwId('ct'); c.contacten.push(ct); }
    bewaarEnHerlaad(c.id);
  }, contactId ? () => {
    if (!confirm(`Contactpersoon ${ct.naam} verwijderen?`)) return false;
    c.contacten = c.contacten.filter(x => x.id !== contactId);
    bewaarEnHerlaad(c.id);
    return true;
  } : null);
}

// ---------- FACTUREN ----------
function factuurModal(c, factuurId) {
  c.facturen = c.facturen || [];
  const f = factuurId ? c.facturen.find(x => x.id === factuurId) : { bv: c.entiteit, datum: vandaagIso() };
  if (!f) return;
  const bvs = [...new Set([...D.kasstand.map(k => k.entiteit), ...D.objecten.map(o => o.eigenaar_bv)].filter(Boolean))];
  const body = `<datalist id="bv-lijst-f">${bvs.map(b => `<option value="${esc(b)}">`).join('')}</datalist>
    <div class="f-grid f-grid-2" style="margin-top:14px">
      <label class="f-veld"><span>Factuurnummer *</span><input name="nummer" required value="${esc(f.nummer || '')}"></label>
      <label class="f-veld"><span>BV op de factuur *</span><input name="bv" list="bv-lijst-f" required value="${esc(f.bv || '')}" placeholder="Aan welke BV is gefactureerd"></label>
      <label class="f-veld"><span>Factuurdatum</span><input name="datum" type="date" value="${esc(f.datum || '')}"></label>
      <label class="f-veld"><span>Vervaldatum</span><input name="vervaldatum" type="date" value="${esc(f.vervaldatum || '')}"></label>
      <label class="f-veld"><span>Factuurbedrag (€) *</span><input name="bedrag" type="number" step="0.01" required value="${f.bedrag ?? ''}"></label>
      <label class="f-veld"><span>Nog open (€)</span><input name="open" type="number" step="0.01" value="${f.open ?? ''}" placeholder="Leeg = volledig bedrag"></label>
      <label class="f-veld f-breed"><span>Omschrijving</span><input name="omschrijving" value="${esc(f.omschrijving || '')}"></label>
    </div>
    ${!factuurId && !(c.facturen || []).length && c.bedrag_open ? `<p class="modal-uitleg">Let op: zodra er facturen zijn, wordt het openstaande bedrag van dit dossier (${euro(c.bedrag_open)}) berekend uit de facturen.</p>` : ''}`;
  EDITOR.openModal(factuurId ? 'Factuur wijzigen' : 'Factuur toevoegen', body, form => {
    const e = form.elements;
    const bedrag = parseFloat(e.bedrag.value) || 0;
    Object.assign(f, {
      nummer: e.nummer.value.trim(), bv: e.bv.value.trim(), datum: e.datum.value || null, vervaldatum: e.vervaldatum.value || null,
      bedrag, open: e.open.value === '' ? bedrag : Math.min(bedrag, parseFloat(e.open.value) || 0), omschrijving: e.omschrijving.value.trim(),
    });
    if (!factuurId) { f.id = STORE.nieuwId('f'); c.facturen.push(f); }
    if (c.status === 'betaald' && f.open > 0) c.status = 'open';
    herberekenCrediteur(c);
    bewaarEnHerlaad(c.id);
  }, factuurId ? () => {
    if (!confirm(`Factuur ${f.nummer || ''} verwijderen?`)) return false;
    c.facturen = c.facturen.filter(x => x.id !== factuurId);
    herberekenCrediteur(c);
    bewaarEnHerlaad(c.id);
    return true;
  } : null);
}

// ---------- DOCUMENTEN IN HET DOSSIER ----------
function koppelDossierDocs(c) {
  const sleutel = 'cred:' + c.id;
  const input = document.getElementById('dos-doc-input');
  const drop = document.getElementById('dos-drop');
  const lijstEl = document.getElementById('dos-docs');
  const label = key => (DOCS.SOORTEN.find(s => s.key === key) || { label: key }).label;

  function render() {
    DOCS.lijst(sleutel).then(docs => {
      lijstEl.innerHTML = docs.length ? `<div class="dos-doclijst">${docs.map(d => `
        <div class="dos-doc" data-doc="${esc(d.id)}">
          <div class="dos-doc-info">${badge(label(d.soort), d.soort === 'faillissement_brief' || d.soort === 'sommatie' ? 'red' : d.soort === 'aanmaning' ? 'amber' : 'blue')}
            <a href="#" class="doc-naam" data-open>${esc(d.naam)}</a><small>${DOCS.fmtGrootte(d.grootte)} · ${new Date(d.toegevoegd).toLocaleDateString('nl-NL')}</small></div>
          <div class="td-nowrap">
            <select class="dos-doc-soort" aria-label="Soort">${DOCS.SOORTEN.filter(s => s.groep === 'crediteur' || s.key === 'overig').map(s => `<option value="${s.key}"${s.key === d.soort ? ' selected' : ''}>${s.label}</option>`).join('')}</select>
            <button type="button" class="icon-btn" data-download title="Downloaden" aria-label="Downloaden">⤓</button>
            <button type="button" class="icon-btn" data-wis title="Verwijderen" aria-label="Verwijderen">✕</button>
          </div>
        </div>`).join('')}</div>` : '<p class="doc-noot" style="margin-top:10px">Nog geen documenten in dit dossier.</p>';
      lijstEl.querySelectorAll('[data-doc]').forEach(el => {
        const d = docs.find(x => x.id === el.dataset.doc);
        el.querySelector('[data-open]').onclick = e => { e.preventDefault(); DOCS.openen(d.id, d.naam).catch(err => alert(err.message)); };
        el.querySelector('[data-download]').onclick = () => DOCS.downloaden(d.id, d.naam);
        el.querySelector('[data-wis]').onclick = () => { if (confirm(`"${d.naam}" verwijderen?`)) DOCS.verwijder(d.id).then(render); };
        el.querySelector('.dos-doc-soort').onchange = e => DOCS.wijzig({ ...d, soort: e.target.value }).then(render);
      });
    }).catch(err => { lijstEl.innerHTML = `<p style="color:var(--red)">${esc(err.message || 'Documentopslag niet beschikbaar.')}</p>`; });
  }
  async function voegToe(files) {
    for (const f of [...files]) {
      try { await DOCS.voegToe(sleutel, f, DOCS.raadCrediteurSoort(f.name)); } catch (e) { alert(e.message); }
    }
    render();
  }
  document.getElementById('dos-doc-kies').onclick = () => input.click();
  drop.onclick = () => input.click();
  input.onchange = () => { voegToe(input.files); input.value = ''; };
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('sleep'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('sleep'));
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('sleep'); voegToe(e.dataTransfer.files); });
  render();
}
