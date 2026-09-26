/**
 * ============================================================
 *  OBJECTEN — overzicht en detailpagina per object met documenten
 *  Laden NA dashboard.js en docs.js, VÓÓR editor.js.
 * ============================================================
 */

const OBJ_SLEUTEL = 'object_open';

// Klik op "Objecten" in het menu terwijl een object open staat → terug naar het overzicht
(function () {
  const vorige = window.nav;
  window.nav = function (id, el) {
    const alGebouwd = el && el.dataset.built;
    vorige(id, el);
    if (id === 'objecten' && alGebouwd) toonObjectenOverzicht();
  };
})();
let objFilter = 'alle';

function buildObjecten() {
  let open = null;
  try { open = sessionStorage.getItem(OBJ_SLEUTEL); } catch (e) { /* niets */ }
  if (open && D.objecten.some(o => o.id === open)) toonObject(open);
  else toonObjectenOverzicht();
}

function objectKengetallen(o) {
  const noi = E.noiPerObject().find(x => x.id === o.id) || {};
  const ltv = E.ltvPerObject().find(x => x.id === o.id) || {};
  const huurMnd = D.huurcontracten.filter(h => h.object_id === o.id).reduce((s, h) => s + (h.huur_per_maand || 0), 0);
  return { noi: noi.noi || 0, schuld: ltv.schuld || 0, ltv: ltv.ltv, huurMnd };
}

function verplichteSoorten(o) {
  return DOCS.SOORTEN.filter(s => s.check(o, D));
}

function toonObjectenOverzicht() {
  try { sessionStorage.removeItem(OBJ_SLEUTEL); } catch (e) { /* niets */ }
  const root = document.getElementById('obj-root');
  const statussen = ['alle', ...new Set(D.objecten.map(o => o.status))];
  root.innerHTML = `
    <div class="page-title">Objecten</div>
    <div class="page-sub">${D.objecten.length} objecten · Kies een object voor details en documenten</div>
    <div class="obj-balk">
      <div class="tabs tabs-small" style="margin:0">${statussen.map(s =>
        `<button type="button" class="tab-btn${s === objFilter ? ' active-filter' : ''}" data-filter="${s}">${s === 'alle' ? 'Alle' : s.charAt(0).toUpperCase() + s.slice(1)}<span class="cnt">${s === 'alle' ? D.objecten.length : D.objecten.filter(o => o.status === s).length}</span></button>`).join('')}</div>
      <button type="button" class="btn btn-primary btn-small" onclick="EDITOR.editObject()">+ Object toevoegen</button>
    </div>
    <div class="obj-grid" id="obj-grid"></div>`;
  root.querySelectorAll('[data-filter]').forEach(b => b.onclick = () => { objFilter = b.dataset.filter; toonObjectenOverzicht(); });

  const lijst = D.objecten.filter(o => objFilter === 'alle' || o.status === objFilter);
  const grid = document.getElementById('obj-grid');
  grid.innerHTML = lijst.map(o => {
    const k = objectKengetallen(o);
    return `<button type="button" class="obj-kaart" data-id="${esc(o.id)}">
      <div class="obj-kop">
        <div><div class="obj-naam">${esc(o.naam)}</div><div class="obj-stad">${esc(o.stad || '')} · ${esc(o.type || '')}</div></div>
        ${statusBadge(o.status)}
      </div>
      <div class="obj-cijfers">
        <div><span>Waarde</span><strong>${E.fmt(o.marktwaarde)}</strong></div>
        <div><span>NOI/jr</span><strong>${k.noi > 0 ? E.fmt(k.noi) : '—'}</strong></div>
        <div><span>LTV</span><strong class="${k.ltv > 70 ? 'kv-red' : k.ltv > 60 ? 'kv-amber' : ''}">${k.ltv ? k.ltv.toFixed(0) + '%' : '—'}</strong></div>
      </div>
      <div class="obj-docs" data-docs="${esc(o.id)}"><span class="obj-docs-balk"><span style="width:0"></span></span><span class="obj-docs-tekst">Documenten laden…</span></div>
    </button>`;
  }).join('') || '<p style="color:var(--text-3)">Geen objecten in deze selectie.</p>';
  grid.querySelectorAll('.obj-kaart').forEach(k => k.onclick = () => toonObject(k.dataset.id));

  // Documentvolledigheid per object
  DOCS.alleMeta().then(alle => {
    lijst.forEach(o => {
      const el = grid.querySelector(`[data-docs="${CSS.escape(o.id)}"]`);
      if (!el) return;
      const docs = alle.filter(d => d.object_id === o.id);
      const nodig = verplichteSoorten(o);
      const aanwezig = nodig.filter(s => docs.some(d => d.soort === s.key)).length;
      const pct = nodig.length ? Math.round(aanwezig / nodig.length * 100) : 100;
      el.querySelector('.obj-docs-balk span').style.width = pct + '%';
      el.querySelector('.obj-docs-balk span').style.background = pct === 100 ? 'var(--green)' : pct >= 50 ? 'var(--amber)' : 'var(--red)';
      el.querySelector('.obj-docs-tekst').textContent = `${aanwezig}/${nodig.length} kerndocumenten · ${docs.length} bestand${docs.length === 1 ? '' : 'en'}`;
    });
  }).catch(() => grid.querySelectorAll('.obj-docs-tekst').forEach(t => t.textContent = 'Documentopslag niet beschikbaar'));
}

function toonObject(id) {
  const o = D.objecten.find(x => x.id === id);
  if (!o) return toonObjectenOverzicht();
  try { sessionStorage.setItem(OBJ_SLEUTEL, id); } catch (e) { /* niets */ }
  window.scrollTo(0, 0);
  const k = objectKengetallen(o);
  const contracten = D.huurcontracten.filter(h => h.object_id === id);
  const leningen = D.leningen.filter(l => l.object_id === id);
  const kosten = E.jaarlijkseKosten(id);
  const tp = document.getElementById('tb-pagina');
  setTimeout(() => { if (tp) tp.textContent = 'Objecten / ' + o.naam; }, 0);

  const root = document.getElementById('obj-root');
  root.innerHTML = `
    <button type="button" class="terug-link" id="obj-terug">← Alle objecten</button>
    <div class="obj-detail-kop">
      <div>
        <div class="page-title">${esc(o.naam)}</div>
        <div class="page-sub">${esc(o.stad || '')} · ${esc(o.type || '')} · ${esc(o.eigenaar_bv || 'Nog geen BV')} ${o.bvo_m2 ? '· ' + o.bvo_m2.toLocaleString('nl-NL') + ' m²' : ''}</div>
      </div>
      <div class="obj-detail-acties">${statusBadge(o.status)}<button type="button" class="btn btn-small" id="obj-wijzig">Object wijzigen</button></div>
    </div>
    <div class="kg g4">
      ${kpi('Marktwaarde', E.fmt(o.marktwaarde), o.aankoopprijs ? 'Aankoop ' + E.fmt(o.aankoopprijs) : (o.verwachte_aankoopprijs ? 'Verwacht ' + E.fmt(o.verwachte_aankoopprijs) : ''), 'kv-blue')}
      ${kpi('NOI (jaar)', k.noi ? E.fmt(k.noi) : '—', 'Huur ' + E.fmt(k.huurMnd) + '/mnd · kosten ' + E.fmt(kosten) + '/jr', k.noi > 0 ? 'kv-green' : '')}
      ${kpi('Schuld', k.schuld ? E.fmt(k.schuld) : '—', k.ltv ? 'LTV ' + k.ltv.toFixed(0) + '%' : 'Geen lening', k.schuld ? 'kv-red' : '')}
      ${kpi('Verwachte IRR', typeof o.irr_pct === 'number' ? String(o.irr_pct).replace('.', ',') + '%' : '—', o.marktwaarde && k.noi ? 'Yield ' + E.pct(k.noi / o.marktwaarde * 100) : '', 'kv-green')}
    </div>

    <div class="card">
      <div class="card-head">
        <div class="card-title">Documenten</div>
        <div class="obj-doc-knoppen">
          <button type="button" class="btn btn-small" id="doc-alles" hidden>Download alles</button>
          <button type="button" class="btn btn-primary btn-small" id="doc-kies">+ Documenten toevoegen</button>
        </div>
      </div>
      <div class="doc-drop" id="doc-drop">
        <input type="file" id="doc-input" multiple hidden>
        <div><strong>Sleep bestanden hierheen</strong> of klik hier om documenten te kiezen.</div>
        <span>Taxatierapport, koop- of leningovereenkomst, huurcontract, kadaster, energielabel… (max. 50 MB per bestand)</span>
      </div>
      <div id="doc-status"></div>
      <div class="doc-layout">
        <div class="doc-lijst-wrap"><div class="tbl-wrap"><table class="tbl" id="doc-tbl"></table></div></div>
        <div class="doc-check"><div class="doc-check-titel">Checklist kerndocumenten</div><div id="doc-checklist"></div></div>
      </div>
      <p class="doc-noot">Documenten worden alleen in deze browser bewaard. Gebruik <em>Download alles</em> als back-up.</p>
    </div>

    <div class="kg g2">
      <div class="card" style="margin-bottom:0">
        <div class="card-title">Huurcontracten</div>
        <div class="tbl-wrap"><table class="tbl">${contracten.length ? `
          <thead><tr><th>Huurder</th><th>Huur/mnd</th><th>Einddatum</th><th>Indexatie</th></tr></thead>
          <tbody>${contracten.map(h => `<tr><td style="font-weight:600">${esc(h.huurder)}</td><td class="num">${E.fmt(h.huur_per_maand)}</td>
            <td>${h.einddatum ? E.fmtDatum(h.einddatum) : 'Onbepaald'}</td><td>${esc(h.indexatie_type || '—')}${h.indexatie_pct ? ' ' + String(h.indexatie_pct).replace('.', ',') + '%' : ''}</td></tr>`).join('')}</tbody>`
          : '<tbody><tr><td style="color:var(--text-3)">Geen huurcontracten.</td></tr></tbody>'}</table></div>
      </div>
      <div class="card" style="margin-bottom:0">
        <div class="card-title">Leningen</div>
        <div class="tbl-wrap"><table class="tbl">${leningen.length ? `
          <thead><tr><th>Lening</th><th>Saldo</th><th>Rente</th><th>Einddatum</th></tr></thead>
          <tbody>${leningen.map(l => `<tr class="klikbaar" onclick="EDITOR.editLening('${esc(l.id)}')"><td style="font-weight:600">${esc(l.naam)}</td><td class="num">${E.fmt(l.huidig_saldo)}</td>
            <td class="num">${l.rente_pct != null ? String(l.rente_pct).replace('.', ',') + '%' : '—'}</td><td>${E.fmtDatum(l.einddatum)}</td></tr>`).join('')}</tbody>`
          : '<tbody><tr><td style="color:var(--text-3)">Geen leningen gekoppeld.</td></tr></tbody>'}</table></div>
      </div>
    </div>`;

  document.getElementById('obj-terug').onclick = () => {
    toonObjectenOverzicht();
    if (tp) tp.textContent = 'Objecten';
  };
  document.getElementById('obj-wijzig').onclick = () => EDITOR.editObject(id);
  koppelDocumenten(o);
}

function koppelDocumenten(o) {
  const input = document.getElementById('doc-input');
  const drop = document.getElementById('doc-drop');
  const status = document.getElementById('doc-status');
  const zet = (niveau, html) => status.innerHTML = html ? `<div class="alert alert-${niveau}" style="margin-top:12px"><div>${html}</div></div>` : '';

  async function voegToe(files) {
    files = [...files];
    if (!files.length) return;
    zet('blue', `<span class="spinner"></span> ${files.length} bestand${files.length > 1 ? 'en' : ''} opslaan…`);
    const fouten = [];
    for (const f of files) {
      try { await DOCS.voegToe(o.id, f); } catch (e) { fouten.push(e.message || f.name); }
    }
    const ok = files.length - fouten.length;
    zet(fouten.length ? 'amber' : 'green',
      (ok ? `${ok} document${ok > 1 ? 'en' : ''} toegevoegd. Controleer de soort in de lijst.` : '') +
      (fouten.length ? `<br>Niet gelukt: ${fouten.map(esc).join(', ')}` : ''));
    renderDocs(o);
  }

  document.getElementById('doc-kies').onclick = () => input.click();
  drop.onclick = () => input.click();
  input.onchange = () => { voegToe(input.files); input.value = ''; };
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('sleep'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('sleep'));
  drop.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('sleep'); voegToe(e.dataTransfer.files); });
  document.getElementById('doc-alles').onclick = async () => {
    const docs = await DOCS.lijst(o.id);
    for (const d of docs) { await DOCS.downloaden(d.id, d.naam); await new Promise(r => setTimeout(r, 350)); }
  };
  renderDocs(o);
}

function soortLabel(key) {
  return (DOCS.SOORTEN.find(s => s.key === key) || { label: key }).label;
}

function renderDocs(o) {
  const tbl = document.getElementById('doc-tbl');
  const check = document.getElementById('doc-checklist');
  if (!tbl) return;
  DOCS.lijst(o.id).then(docs => {
    document.getElementById('doc-alles').hidden = !docs.length;
    tbl.innerHTML = docs.length ? `
      <thead><tr><th>Soort</th><th>Bestand</th><th>Documentdatum</th><th>Toegevoegd</th><th></th></tr></thead>
      <tbody>${docs.map(d => `<tr data-doc="${esc(d.id)}">
        <td>${badge(soortLabel(d.soort), d.soort === 'overig' ? 'gray' : 'blue')}</td>
        <td><a href="#" class="doc-naam" data-open>${esc(d.naam)}</a><div class="cred-oms">${DOCS.fmtGrootte(d.grootte)}${d.notitie ? ' · ' + esc(d.notitie) : ''}</div></td>
        <td class="td-nowrap">${d.documentdatum ? E.fmtDatum(d.documentdatum) : '<span style="color:var(--text-3)">—</span>'}</td>
        <td class="td-nowrap cred-oms">${new Date(d.toegevoegd).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
        <td class="doc-acties td-nowrap">
          <button type="button" class="icon-btn" data-download title="Downloaden" aria-label="Downloaden">⤓</button>
          <button type="button" class="icon-btn" data-wijzig title="Wijzigen" aria-label="Wijzigen">✎</button>
          <button type="button" class="icon-btn" data-wis title="Verwijderen" aria-label="Verwijderen">✕</button>
        </td>
      </tr>`).join('')}</tbody>`
      : '<tbody><tr><td style="color:var(--text-3)">Nog geen documenten bij dit object.</td></tr></tbody>';

    tbl.querySelectorAll('tr[data-doc]').forEach(tr => {
      const d = docs.find(x => x.id === tr.dataset.doc);
      tr.querySelector('[data-open]').onclick = e => { e.preventDefault(); DOCS.openen(d.id, d.naam).catch(err => alert(err.message)); };
      tr.querySelector('[data-download]').onclick = () => DOCS.downloaden(d.id, d.naam).catch(err => alert(err.message));
      tr.querySelector('[data-wijzig]').onclick = () => wijzigDocument(d, o);
      tr.querySelector('[data-wis]').onclick = () => {
        if (!confirm(`"${d.naam}" verwijderen? Dit kan niet ongedaan worden gemaakt.`)) return;
        DOCS.verwijder(d.id).then(() => renderDocs(o));
      };
    });

    const nodig = verplichteSoorten(o);
    check.innerHTML = nodig.map(s => {
      const aanwezig = docs.some(d => d.soort === s.key);
      return `<div class="doc-check-rij ${aanwezig ? 'ok' : 'mist'}"><span class="doc-check-ico">${aanwezig ? '✓' : '○'}</span>${s.label}</div>`;
    }).join('') + `<div class="doc-check-tot">${nodig.filter(s => docs.some(d => d.soort === s.key)).length} van ${nodig.length} aanwezig</div>`;
  }).catch(err => {
    tbl.innerHTML = `<tbody><tr><td style="color:var(--red)">${esc(err.message || 'Documentopslag niet beschikbaar.')}</td></tr></tbody>`;
  });
}

function wijzigDocument(d, o) {
  const body = `<div class="f-grid f-grid-2" style="margin-top:14px">
    <label class="f-veld"><span>Soort document</span><select name="soort">${DOCS.SOORTEN.filter(s => (s.groep || 'object') === (o.groep || 'object') || s.key === 'overig').map(s => `<option value="${s.key}"${s.key === d.soort ? ' selected' : ''}>${s.label}</option>`).join('')}</select></label>
    <label class="f-veld"><span>Documentdatum</span><input type="date" name="documentdatum" value="${esc(d.documentdatum || '')}"></label>
    <label class="f-veld f-breed"><span>Bestandsnaam</span><input name="naam" value="${esc(d.naam)}" required></label>
    <label class="f-veld f-breed"><span>Notitie</span><input name="notitie" value="${esc(d.notitie || '')}" placeholder="Bijv. taxateur, waarde, bijzonderheden"></label>
  </div>`;
  EDITOR.openModal('Document wijzigen', body, f => {
    const nieuw = { ...d, soort: f.elements.soort.value, documentdatum: f.elements.documentdatum.value || null, naam: f.elements.naam.value.trim() || d.naam, notitie: f.elements.notitie.value.trim() };
    DOCS.wijzig(nieuw).then(() => { document.querySelector('.modal').close(); renderDocs(o); });
  });
}
