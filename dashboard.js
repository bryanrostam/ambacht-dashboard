/**
 * ============================================================
 *  FORTIS VASTGOED — DASHBOARD RENDERER
 *  Leest uit ENGINE, rendert alle views.
 *  Je hoeft dit NIET aan te passen.
 * ============================================================
 */

const E = window.ENGINE;
const D = window.FORTIS_DATA;
const MND = E.maandLabels(24);

// ---- CHART.JS — THEMA ----
const LICHT = document.documentElement.dataset.theme === 'light';
const GRID = LICHT ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.06)';
Chart.defaults.color = LICHT ? '#6b6b65' : '#9b9b9b';
Chart.defaults.borderColor = GRID;
Chart.defaults.font.family = "'DM Sans', system-ui, sans-serif";
Chart.defaults.plugins.tooltip.backgroundColor = '#111';
Chart.defaults.plugins.tooltip.borderColor = 'rgba(255,255,255,0.12)';
Chart.defaults.plugins.tooltip.borderWidth = 1;
const SCEN_KLEUR = {
  base: { c: '#6fa8ee', f: 'rgba(111,168,238,0.12)' },
  up:   { c: '#86c96b', f: 'rgba(134,201,107,0.12)' },
  dn:   { c: '#f0857a', f: 'rgba(240,133,122,0.12)' },
};

// ---- NAVIGATIE ----
function nav(id, el) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + id).classList.add('active');
  el.classList.add('active');
  // Lazy-build charts when page is first visited
  const builders = {
    liq: [buildLiq],
    crediteuren: [buildCrediteuren],
    objecten: [buildObjecten],
    portfolio: [buildPortfolio, buildTimeline, buildScenario],
    financiering: [buildFinanciering, buildCovenant],
    valuation: [buildValuation, buildExit],
    ownership: [buildOwnership],
    equity: [buildLookThrough, buildEquity],
  };
  if (builders[id] && !el.dataset.built) {
    builders[id].forEach(fn => fn());
    el.dataset.built = '1';
  }
  window.scrollTo(0, 0);
}

// ---- HELPERS ----
const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const badge = (txt, cls) => `<span class="badge badge-${cls}">${txt}</span>`;
const kpi = (label, val, sub, colorCls = '') =>
  `<div class="kpi"><div class="kpi-label">${label}</div><div class="kpi-value ${colorCls}">${val}</div>${sub ? `<div class="kpi-sub">${sub}</div>` : ''}</div>`;
const betaalKnop = id => `<button type="button" class="btn btn-small alert-knop" onclick="event.stopPropagation(); openDossier('${esc(id)}')">Betalen</button>`;
const alertEl = (level, txt, actie = '') => {
  const map = {
    kritiek:  ['alert-red', 'dot-red', 'Kritiek'],
    aandacht: ['alert-amber', 'dot-amber', 'Aandacht'],
    info:     ['alert-green', 'dot-green', 'Info'],
    ok:       ['alert-green', 'dot-green', 'OK'],
  };
  const [ac, dc, label] = map[level] || map.info;
  return `<div class="alert ${ac}${actie ? ' alert-met-knop' : ''}"><div class="alert-dot ${dc}"></div><div class="alert-tekst"><strong>${label}</strong> — ${txt}</div>${actie}</div>`;
};
const statusBadge = s => {
  const m = { eigendom: 'green', herfi: 'blue', bouw: 'amber', acquisitie: 'purple', verkoop: 'red', lopend: 'blue' };
  return badge(s, m[s] || 'gray');
};
const certBadge = c => c === 'committed'
  ? badge('Committed', 'green')
  : c === 'expected' ? badge('Expected', 'amber') : badge('Oriëntatie', 'gray');

// ---- CHART-INSTANTIES ----
let exC = null;

// ---- INIT: META & MANAGEMENT ----
(function initExec() {
  document.getElementById('sb-naam').textContent = D.meta.bedrijfsnaam;
  document.getElementById('sb-sub').textContent = D.meta.subtitel || 'Portfolio dashboard';
  document.title = D.meta.bedrijfsnaam + ' — ' + (D.meta.subtitel || 'Portfolio dashboard');
  document.getElementById('exec-sub').textContent =
    `Portefeuille · ${E.maandJaarLang(D.meta.peildatum)} · Alle bedragen in euro`;

  const totKas = E.totaleKas();
  const cf12 = E.cashflowForecast(12, 'base');
  const minKas = Math.min(...cf12.map(m => m.sluitend_kas));
  const minMaand = cf12.find(m => m.sluitend_kas === minKas);
  const totSch = E.totaleSculd();
  const navVal = E.nav();
  const dscr = E.dscr();
  const irr = E.portefeuilleIRR();
  const alerts = E.generateAlerts();
  const nKritiek = alerts.filter(a => a.niveau === 'kritiek').length;
  const nAandacht = alerts.filter(a => a.niveau === 'aandacht').length;
  const actieveObjecten = E.noiPerObject().filter(o => o.huur_jaar > 0).length;
  const drempel = D.meta.minimum_kas_drempel;

  // Kasaldo t.o.v. vorige maand (optioneel veld in data.js)
  let kasSub = 'Over ' + D.kasstand.length + ' entiteiten';
  if (typeof D.meta.kasaldo_vorige_maand === 'number') {
    const delta = totKas - D.meta.kasaldo_vorige_maand;
    const [j, m] = E.parseDatum(D.meta.peildatum);
    const vorige = E.fmtDatum(E.offsetMaand(`${j}-${m + 1}`, -1)).split(' ')[0];
    kasSub = `${delta >= 0 ? '▲ +' : '▼ '}${E.fmt(delta)} vs ${vorige}`;
  }

  document.getElementById('exec-kpis').innerHTML = [
    kpi('Kasaldo vandaag', E.fmt(totKas, 2), kasSub, 'kv-blue'),
    kpi('Min. kasaldo 12m', E.fmt(minKas), 'Verwacht ' + E.fmtDatum(minMaand.maandStr),
      minKas < drempel ? 'kv-red' : 'kv-amber'),
    kpi('NAV portefeuille', E.fmt(navVal), 'Marktwaarde − schuld', 'kv-green'),
    kpi('DSCR portefeuille', dscr.toFixed(2).replace('.', ','), 'Min. eis: 1,20',
      dscr >= 1.3 ? 'kv-green' : dscr >= 1.2 ? 'kv-amber' : 'kv-red'),
    kpi('Totale NOI (jaar)', E.fmt(E.totalNOI()), actieveObjecten + ' actieve objecten'),
    kpi('Portefeuille IRR', irr === null ? '—' : irr.toFixed(1).replace('.', ',') + '%',
      irr === null ? 'Vul irr_pct in data.js' : 'Gewogen gemiddeld', 'kv-green'),
    kpi('Totale schuld', E.fmt(totSch), 'LTV ' + E.gewogenLTV().toFixed(0) + '%', 'kv-red'),
    kpi('Actieve alerts', String(nKritiek + nAandacht), `${nKritiek} kritiek · ${nAandacht} aandacht`,
      nKritiek ? 'kv-red' : nAandacht ? 'kv-amber' : 'kv-green'),
  ].join('');

  // Alerts
  document.getElementById('exec-alerts').innerHTML = (alerts.length
    ? alerts.map(a => alertEl(a.niveau, a.tekst, a.bron === 'crediteur' ? betaalKnop(a.id) : ''))
    : [alertEl('ok', 'Geen kritieke meldingen op dit moment.')]
  ).join('');

  // Pipeline table
  const tx = E.gewogenTransacties();
  document.getElementById('exec-pipeline').innerHTML = `
    <thead><tr><th>Event</th><th>Project</th><th>Datum</th><th>Bedrag</th><th>Prob.</th><th>Gewogen</th><th>Status</th></tr></thead>
    <tbody>${tx.map(t => {
    const obj = D.objecten.find(o => o.id === t.object_id);
    const pos = t.bedrag >= 0;
    return `<tr>
      <td>${t.naam}</td>
      <td>${obj ? obj.naam : '—'}</td>
      <td>${t.verwachte_datum.substring(0, 7)}</td>
      <td class="num ${pos ? 'green' : 'red'}">${E.fmt(t.bedrag)}</td>
      <td class="num">${t.kans_pct}%</td>
      <td class="num ${pos ? 'green' : 'red'}">${E.fmt(t.gewogen_bedrag)}</td>
      <td>${certBadge(t.zekerheid)}</td>
    </tr>`;
  }).join('')}</tbody>`;

  buildExChart('base');
})();

// ---- EXECUTIVE CHART ----
function buildExChart(scen) {
  const naam = { base: 'base', up: 'upside', dn: 'downside' }[scen];
  const d = E.cashflowForecast(24, naam).map(m => m.sluitend_kas);
  const k = SCEN_KLEUR[scen];
  if (exC) exC.destroy();
  exC = new Chart(document.getElementById('exChart'), {
    type: 'line',
    data: { labels: MND, datasets: [
      { label: 'Kasaldo', data: d, borderColor: k.c, backgroundColor: k.f, borderWidth: 2, fill: true, tension: 0.35, pointRadius: 0, pointHoverRadius: 4 },
      { label: 'Min. drempel', data: new Array(24).fill(D.meta.minimum_kas_drempel), borderColor: '#f0857a', borderWidth: 1, borderDash: [4, 3], fill: false, pointRadius: 0 },
    ]},
    options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ctx.dataset.label + ': ' + E.fmt(ctx.parsed.y) } } }, scales: { x: { ticks: { font: { size: 11 }, maxTicksLimit: 12 }, grid: { display: false } }, y: { ticks: { font: { size: 11 }, callback: v => E.fmt(v) } } } },
  });
}
function setExScen(s, btn) {
  document.querySelectorAll('#page-exec .tab-btn').forEach(b => b.className = 'tab-btn');
  btn.className = 'tab-btn active-' + (s === 'base' ? 'base' : s === 'up' ? 'up' : 'down');
  buildExChart(s);
}

// ---- LIQUIDITEIT ----
let liqC = null;
function buildLiq() {
  const base = E.cashflowForecast(24, 'base');
  const minKas = Math.min(...base.map(m => m.sluitend_kas));
  const schulddienst = E.maandelijkseSchulddienst();
  const cfDn = E.cashflowForecast(24, 'downside');
  const gapDn = Math.min(...cfDn.map(m => m.sluitend_kas));

  document.getElementById('liq-kpis').innerHTML = [
    kpi('Opening cash', E.fmt(E.totaleKas()), D.meta.peildatum, 'kv-blue'),
    kpi('Min. kasaldo (24m)', E.fmt(minKas), 'Base scenario', minKas < D.meta.minimum_kas_drempel ? 'kv-red' : 'kv-amber'),
    kpi('Funding gap (downside)', E.fmt(Math.min(0, gapDn)), gapDn < 0 ? 'Downside scenario' : 'Geen gap', gapDn < 0 ? 'kv-red' : 'kv-green'),
    kpi('Maandlast schulddienst', E.fmt(schulddienst), 'Rente + aflossing', 'kv-red'),
  ].join('');

  buildLiqChart('base');

  // Cashflow table
  const thead = `<thead><tr><th>Maand</th><th>Huur</th><th>Fin./herfi</th><th>Aankoop/EC</th><th>R+A</th><th>OpEx</th><th>Crediteuren</th><th>Netto CF</th><th>Kasaldo</th><th></th></tr></thead>`;
  const rows = base.slice(0, 12).map(m => {
    const inc_in = m.incidenteel > 0 ? E.fmt(m.incidenteel) : '—';
    const inc_out = m.incidenteel < 0 ? E.fmt(m.incidenteel) : '—';
    return `<tr>
      <td>${MND[m.maand]}</td>
      <td class="num green">${E.fmt(m.huur)}</td>
      <td class="num green">${inc_in}</td>
      <td class="num red">${inc_out}</td>
      <td class="num red">${E.fmt(-m.schulddienst)}</td>
      <td class="num red">${E.fmt(-m.kosten)}</td>
      <td class="num red">${m.crediteuren ? E.fmt(-m.crediteuren) : '—'}</td>
      <td class="num ${m.netto_cf < 0 ? 'red' : 'green'}">${E.fmt(m.netto_cf)}</td>
      <td class="num ${m.sluitend_kas < D.meta.minimum_kas_drempel ? 'red' : m.sluitend_kas < D.meta.minimum_kas_drempel * 2 ? 'amber' : ''}">${E.fmt(m.sluitend_kas)}</td>
      <td>${m.alert ? badge('Alert', 'red') : ''}</td>
    </tr>`;
  }).join('');
  document.getElementById('liq-tbl').innerHTML = thead + `<tbody>${rows}</tbody>`;

  // Cash per entiteit
  const kas = E.kasPerEntiteit();
  document.getElementById('liq-entiteiten').innerHTML = `
    <thead><tr><th>Entiteit</th><th>Totale kas</th><th>Restricted</th><th>Beschikbaar</th><th>Reden</th><th>Dividend mogelijk</th></tr></thead>
    <tbody>${kas.map(k => `<tr>
      <td style="font-weight:600">${k.entiteit}</td>
      <td class="num">${E.fmt(k.saldo)}</td>
      <td class="num red">${k.restricted > 0 ? E.fmt(k.restricted) : '—'}</td>
      <td class="num ${k.beschikbaar > 0 ? 'green' : 'red'}">${E.fmt(k.beschikbaar)}</td>
      <td style="color:var(--text-2)">${k.toelichting || '—'}</td>
      <td>${k.beschikbaar > 0 ? badge('Ja', 'green') : badge('Nee', 'red')}</td>
    </tr>`).join('')}</tbody>`;
}

function buildLiqChart(scen) {
  const base = E.cashflowForecast(24, 'base').map(m => m.sluitend_kas);
  const dn = E.cashflowForecast(24, 'downside').map(m => m.sluitend_kas);
  const up = E.cashflowForecast(24, 'upside').map(m => m.sluitend_kas);
  const thresh = new Array(24).fill(D.meta.minimum_kas_drempel);
  const selected = scen === 'up' ? up : scen === 'dn' ? dn : base;
  const col = (SCEN_KLEUR[scen] || SCEN_KLEUR.base).c;
  if (liqC) liqC.destroy();
  liqC = new Chart(document.getElementById('liqChart'), {
    type: 'line',
    data: { labels: MND, datasets: [
      { label: 'Kasverloop', data: selected, borderColor: col, backgroundColor: col + '1f', borderWidth: 2, fill: true, tension: 0.35, pointRadius: 2 },
      { label: 'Min. drempel', data: thresh, borderColor: '#f0857a', borderWidth: 1, borderDash: [4, 3], fill: false, pointRadius: 0 },
    ]},
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false, callbacks: { label: ctx => ctx.dataset.label + ': ' + E.fmt(ctx.parsed.y) } } }, scales: { x: { ticks: { font: { size: 10 }, maxTicksLimit: 10 }, grid: { display: false } }, y: { ticks: { font: { size: 10 }, callback: v => E.fmt(v) }, grid: { color: GRID } } } },
  });
}
function setLiqScen(s, btn) {
  document.querySelectorAll('#page-liq .tab-btn').forEach(b => b.className = 'tab-btn');
  btn.className = 'tab-btn active-' + (s === 'base' ? 'base' : s === 'up' ? 'up' : 'down');
  buildLiqChart(s);
}

// ---- PORTFOLIO ----
function buildPortfolio() {
  const nois = E.noiPerObject();
  const ltvs = E.ltvPerObject();
  const totMW = E.totaleMarktwaarde();

  document.getElementById('port-sub').textContent = `${D.objecten.length} objecten · ${D.huurcontracten.length} huurcontracten · Peildatum ${D.meta.peildatum}`;
  document.getElementById('port-kpis').innerHTML = [
    kpi('Totale marktwaarde', E.fmt(totMW), D.objecten.length + ' objecten', 'kv-blue'),
    kpi('Totale huur/jaar', E.fmt(E.jaarlijkseHuur()), D.huurcontracten.length + ' contracten', 'kv-green'),
    kpi('Totale NOI/jaar', E.fmt(E.totalNOI()), 'Na exploitatiekosten', 'kv-green'),
    kpi('Gem. yield', E.pct(E.totalNOI() / totMW * 100), 'Op marktwaarde'),
  ].join('');

  const rows = nois.map(obj => {
    const ltv = ltvs.find(l => l.id === obj.id);
    const huur_mnd = D.huurcontracten.filter(h => h.object_id === obj.id).reduce((s, h) => s + h.huur_per_maand, 0);
    const schuld = ltv?.schuld || 0;
    const ltvPct = ltv?.ltv;
    const ltvCls = ltvPct ? (ltvPct > 70 ? 'red' : ltvPct > 60 ? 'amber' : '') : '';
    return `<tr data-id="${esc(obj.id)}">
      <td style="font-weight:600">${esc(obj.naam)}</td>
      <td>${esc(obj.stad)}</td>
      <td>${obj.type}</td>
      <td>${statusBadge(obj.status)}</td>
      <td class="num">${E.fmt(obj.marktwaarde)}</td>
      <td class="num">${huur_mnd > 0 ? E.fmt(huur_mnd) : '—'}</td>
      <td class="num green">${obj.noi > 0 ? E.fmt(obj.noi) : '—'}</td>
      <td class="num red">${schuld > 0 ? E.fmt(schuld) : '—'}</td>
      <td class="num ${ltvCls}">${ltvPct ? ltvPct.toFixed(0) + '%' : '—'}</td>
    </tr>`;
  }).join('');
  document.getElementById('port-tbl').innerHTML = `
    <thead><tr><th>Object</th><th>Stad</th><th>Type</th><th>Status</th><th>Waarde</th><th>Huur/mnd</th><th>NOI/jr</th><th>Schuld</th><th>LTV</th></tr></thead>
    <tbody>${rows}</tbody>`;

  // Charts
  const verhuurde = nois.filter(o => o.noi > 0);
  new Chart(document.getElementById('noiChart'), {
    type: 'bar',
    data: { labels: verhuurde.map(o => o.naam.split(' ')[0]), datasets: [{ data: verhuurde.map(o => Math.round(o.noi / 1000)), backgroundColor: '#6fa8ee', borderRadius: 4 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { font: { size: 10 }, }, grid: { display: false } }, y: { ticks: { font: { size: 10 }, callback: v => v + 'k' }, grid: { color: GRID } } } },
  });

  const metLTV = ltvs.filter(o => o.ltv !== null);
  new Chart(document.getElementById('ltvChart'), {
    type: 'bar',
    data: { labels: metLTV.map(o => o.naam.split(' ')[0]), datasets: [{ data: metLTV.map(o => Math.round(o.ltv)), backgroundColor: metLTV.map(o => o.ltv > 70 ? '#F09595' : o.ltv > 60 ? '#FAC775' : '#97C459'), borderRadius: 4 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { ticks: { font: { size: 10 }, }, grid: { display: false } }, y: { min: 0, max: 90, ticks: { font: { size: 10 }, callback: v => v + '%' }, grid: { color: GRID } } } },
  });
}

// ---- TIMELINE ----
function buildTimeline() {
  const MONTHS = 24;
  const CW = 30, LW = 140;
  const types = [
    { key: 'financiering', label: 'Financiering', color: '#B5D4F4', tc: '#0C447C' },
    { key: 'herfinanciering', label: 'Herfinanciering', color: '#5DCAA5', tc: '#085041' },
    { key: 'huur', label: 'Huur/exploitatie', color: '#97C459', tc: '#27500A' },
    { key: 'bouw', label: 'Bouw', color: '#e8b64a', tc: '#412402' },
    { key: 'equity_call', label: 'Equity call', color: '#f0857a', tc: '#501313' },
    { key: 'acquisitie', label: 'Acquisitie', color: '#AFA9EC', tc: '#26215C' },
  ];

  document.getElementById('gantt-legend').innerHTML = types.map(t =>
    `<span style="display:flex;align-items:center;gap:3px"><span style="width:9px;height:9px;border-radius:2px;background:${t.color};display:inline-block"></span>${t.label}</span>`
  ).join('');

  const [sj, sm] = E.parseDatum(D.meta.peildatum);
  function maandIndex(dateStr) {
    const [j, m] = E.parseDatum(dateStr);
    return (j - sj) * 12 + (m - sm);
  }

  const ganttRows = [
    { label: 'Alle huurinkomsten', bars: [{ m: 0, d: 24, ...types[2] }] },
    ...D.objecten.filter(o => o.status === 'herfi').map(o => ({
      label: o.naam,
      bars: [{ m: 0, d: 3, ...types[0] }, { m: 3, d: 21, ...types[1] }],
    })),
    ...D.objecten.filter(o => o.status === 'bouw').map(o => {
      const eind = o.verwachte_opleveringsdatum ? maandIndex(o.verwachte_opleveringsdatum) : 18;
      return { label: o.naam, bars: [{ m: 0, d: eind, ...types[3] }, { m: eind, d: 24 - eind, ...types[2] }] };
    }),
    ...D.transacties.filter(t => t.type === 'equity_call').map(t => {
      const obj = D.objecten.find(o => o.id === t.object_id);
      const m = maandIndex(t.verwachte_datum);
      return { label: (obj?.naam || 'Equity call'), bars: [{ m: Math.max(0, m), d: 1, ...types[4] }] };
    }),
    ...D.objecten.filter(o => o.status === 'acquisitie').map(o => {
      const tx = D.transacties.find(t => t.object_id === o.id && t.type === 'equity_call');
      const m = tx ? maandIndex(tx.verwachte_datum) : 4;
      return { label: o.naam, bars: [{ m: Math.max(0, m - 2), d: 2, ...types[5] }, { m: Math.max(0, m), d: 24 - m, ...types[2] }] };
    }),
  ];

  let html = `<div style="min-width:${LW + MONTHS * CW}px">`;
  html += `<div style="display:flex;margin-left:${LW}px;margin-bottom:4px">`;
  MND.forEach((m, i) => html += `<div style="width:${CW}px;flex-shrink:0;text-align:center;font-size:9px;color:var(--text-3);border-left:1px solid var(--border);padding:1px 0${i % 3 === 0 ? ';font-weight:600;color:var(--text-2)' : ''}">${m}</div>`);
  html += '</div>';

  ganttRows.forEach(row => {
    html += `<div style="display:flex;align-items:center;margin-bottom:3px;min-height:26px">`;
    html += `<div style="width:${LW}px;flex-shrink:0;font-size:10.5px;font-weight:600;color:var(--text-2);padding-right:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${row.label}</div>`;
    html += `<div style="flex:1;position:relative;height:26px;border-left:1px solid var(--border)">`;
    row.bars.forEach(b => {
      const left = Math.max(0, b.m) * CW;
      const w = Math.max(b.d * CW - 1, 4);
      if (b.m < MONTHS) html += `<div class="g-bar" style="left:${left}px;width:${Math.min(w, (MONTHS - b.m) * CW)}px;background:${b.color};color:${b.tc}">${b.d > 2 ? b.label : ''}</div>`;
    });
    html += `<div style="position:absolute;left:0;top:0;bottom:0;width:2px;background:var(--red);z-index:5;pointer-events:none"></div>`;
    html += `</div></div>`;
  });
  html += '</div>';
  document.getElementById('gantt-container').innerHTML = html;

  // Cash overlay chart
  const cf = E.cashflowForecast(24, 'base');
  const inflows = cf.map(m => Math.max(0, m.huur + Math.max(0, m.incidenteel)));
  const outflows = cf.map(m => -(m.kosten + m.schulddienst + Math.abs(Math.min(0, m.incidenteel))));
  const kas = cf.map(m => m.sluitend_kas);
  new Chart(document.getElementById('cashOverlayChart'), {
    type: 'bar',
    data: { labels: MND, datasets: [
      { label: 'Inflows', data: inflows, backgroundColor: 'rgba(134,201,107,0.6)', borderRadius: 2 },
      { label: 'Outflows', data: outflows, backgroundColor: 'rgba(240,133,122,0.6)', borderRadius: 2 },
      { type: 'line', label: 'Kasverloop', data: kas, borderColor: '#6fa8ee', borderWidth: 2.5, fill: false, tension: 0.3, pointRadius: 0, yAxisID: 'y' },
      { type: 'line', label: 'Min. drempel', data: new Array(24).fill(D.meta.minimum_kas_drempel), borderColor: '#f0857a', borderWidth: 1, borderDash: [3, 3], fill: false, pointRadius: 0, yAxisID: 'y' },
    ]},
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false, callbacks: { label: ctx => ctx.dataset.label + ': ' + E.fmt(ctx.parsed.y) } } }, scales: { x: { ticks: { font: { size: 9 }, maxTicksLimit: 12 }, grid: { display: false } }, y: { ticks: { font: { size: 9 }, callback: v => E.fmt(v) }, grid: { color: GRID } } } },
  });

  document.getElementById('tl-kpis').innerHTML = [
    kpi('Events komende 12m', D.transacties.length.toString(), 'Over alle projecten', 'kv-blue'),
    kpi('Kritieke events', D.transacties.filter(t => t.kans_pct < 80 || t.bedrag < -500000).length.toString(), 'Vereisen actie', 'kv-red'),
    kpi('Grootste outflow', E.fmt(Math.min(...D.transacties.map(t => t.bedrag))), 'Geplande transactie', 'kv-red'),
    kpi('Beste inflow', E.fmt(Math.max(...D.transacties.map(t => t.bedrag))), 'Geplande transactie', 'kv-green'),
  ].join('');

  document.getElementById('dep-blocks').innerHTML = D.transacties
    .filter(t => t.afhankelijk_van)
    .map(t => {
      const dep = D.transacties.find(d => d.id === t.afhankelijk_van);
      return `<div class="dep-block dep-amber"><strong>${t.naam}</strong> is afhankelijk van <strong>${dep?.naam || t.afhankelijk_van}</strong>.<br><span style="color:var(--text-2)">${t.toelichting}</span></div>`;
    }).join('') || '<div class="dep-block dep-green">Geen kritieke afhankelijkheden gedetecteerd.</div>';
}

// ---- SCENARIO ----
const scenParams = { ...D.scenario_params.base };
function buildScenario() {
  const sliders = [
    { id: 'p-huur', label: 'Huurgroei % p.j.', min: -5, max: 8, step: 0.5, key: 'huurgroei_pct', fmt: v => v.toFixed(1) + '%' },
    { id: 'p-leeg', label: 'Leegstand %', min: 0, max: 25, step: 1, key: 'leegstand_pct', fmt: v => v.toFixed(0) + '%' },
    { id: 'p-yield', label: 'Yield vastgoed %', min: 4, max: 9, step: 0.25, key: 'yield_vastgoed_pct', fmt: v => v.toFixed(2) + '%' },
    { id: 'p-kosten', label: 'Kostenstijging %', min: 0, max: 12, step: 0.5, key: 'kostenstijging_pct', fmt: v => v.toFixed(1) + '%' },
    { id: 'p-rente', label: 'Marktrente %', min: 1, max: 8, step: 0.25, key: 'rente_variabel_pct', fmt: v => v.toFixed(2) + '%' },
    { id: 'p-bouw', label: 'Bouwkosten stijging %', min: 0, max: 15, step: 0.5, key: 'bouwkosten_stijging', fmt: v => v.toFixed(1) + '%' },
  ];

  const half = Math.ceil(sliders.length / 2);
  const left = sliders.slice(0, half);
  const right = sliders.slice(half);
  const renderSliders = arr => arr.map(s => `
    <div class="slider-row">
      <span class="slider-label">${s.label}</span>
      <input type="range" min="${s.min}" max="${s.max}" step="${s.step}" value="${scenParams[s.key]}" id="${s.id}" oninput="updateScen('${s.key}','${s.id}',this.value,'${s.id}-o',x=>${s.fmt.toString().replace(/v=>/,'')})">
      <span class="slider-val" id="${s.id}-o">${s.fmt(scenParams[s.key])}</span>
    </div>`).join('');
  document.getElementById('scen-sliders').innerHTML = `<div>${renderSliders(left)}</div><div>${renderSliders(right)}</div>`;
  updateScenKpis();
  buildSensTable();
}

function updateScen(key, id, val, outId) {
  scenParams[key] = parseFloat(val);
  const el = document.getElementById(outId);
  if (el) {
    const fmt = { huurgroei_pct: v => v.toFixed(1) + '%', leegstand_pct: v => v.toFixed(0) + '%', yield_vastgoed_pct: v => v.toFixed(2) + '%', kostenstijging_pct: v => v.toFixed(1) + '%', rente_variabel_pct: v => v.toFixed(2) + '%', bouwkosten_stijging: v => v.toFixed(1) + '%' };
    el.textContent = (fmt[key] || (v => v))(parseFloat(val));
  }
  updateScenKpis();
}

function updateScenKpis() {
  const noi = E.totalNOI() * (1 - scenParams.leegstand_pct / 100) * (1 + scenParams.huurgroei_pct / 100);
  const rv = noi / (scenParams.yield_vastgoed_pct / 100);
  const eq = rv - E.totaleSculd() + E.totaleKas();
  const extraRente = E.totaleSculd() * ((scenParams.rente_variabel_pct - D.scenario_params.base.rente_variabel_pct) / 100);
  const cf = E.cashflowForecast(24, 'base');
  const minKas = Math.min(...cf.map(m => m.sluitend_kas)) - extraRente;

  document.getElementById('scen-kpis').innerHTML = [
    kpi('Vastgoedwaarde', E.fmt(rv), E.fmt(noi, 0) + ' ÷ ' + scenParams.yield_vastgoed_pct.toFixed(2) + '%', 'kv-blue'),
    kpi('Equity value', E.fmt(eq), 'Vastgoed − schuld + cash', eq > E.equityValue() * 0.9 ? 'kv-green' : eq > 0 ? 'kv-amber' : 'kv-red'),
    kpi('Min. kasaldo', E.fmt(minKas), 'Aangepast voor rente', minKas > D.meta.minimum_kas_drempel ? 'kv-green' : minKas > 0 ? 'kv-amber' : 'kv-red'),
    kpi('Extra rentekost/jr', E.fmt(Math.max(0, extraRente)), 'Door rentestijging', extraRente > 0 ? 'kv-red' : 'kv-green'),
  ].join('');

  const scenarios = [
    { naam: 'Base', rv: E.vastgoedwaardeYield(), eq: E.equityValue(), kas: Math.min(...E.cashflowForecast(24, 'base').map(m => m.sluitend_kas)), badge: 'green' },
    { naam: 'Upside', rv: E.vastgoedwaardeYield(D.scenario_params.upside.yield_vastgoed_pct), eq: E.equityValue(D.scenario_params.upside.yield_vastgoed_pct), kas: Math.min(...E.cashflowForecast(24, 'upside').map(m => m.sluitend_kas)), badge: 'green' },
    { naam: 'Downside', rv: E.vastgoedwaardeYield(D.scenario_params.downside.yield_vastgoed_pct), eq: E.equityValue(D.scenario_params.downside.yield_vastgoed_pct), kas: Math.min(...E.cashflowForecast(24, 'downside').map(m => m.sluitend_kas)), badge: 'red' },
    { naam: 'Aangepast', rv, eq, kas: minKas, badge: eq > 0 ? 'blue' : 'red' },
    { naam: 'Worst case', rv: E.totalNOI() * 0.75 / 0.08, eq: E.totalNOI() * 0.75 / 0.08 - E.totaleSculd() * 1.05 + E.totaleKas() * 0.8, kas: -800000, badge: 'red' },
  ];

  document.getElementById('scen-tbl').innerHTML = `
    <thead><tr><th>Scenario</th><th>Vastgoedwaarde</th><th>Equity value</th><th>Min. kasaldo</th><th>Funding gap</th><th>Uitkomst</th></tr></thead>
    <tbody>${scenarios.map(s => `<tr>
      <td style="font-weight:600">${s.naam}</td>
      <td class="num">${E.fmt(s.rv)}</td>
      <td class="num">${E.fmt(s.eq)}</td>
      <td class="num ${s.kas < 0 ? 'red' : s.kas < D.meta.minimum_kas_drempel ? 'amber' : 'green'}">${E.fmt(s.kas)}</td>
      <td class="num red">${s.kas < 0 ? E.fmt(s.kas) : '—'}</td>
      <td>${badge(s.eq > 0 ? (s.kas >= D.meta.minimum_kas_drempel ? 'Gezond' : 'Aandacht') : 'Kritiek', s.badge)}</td>
    </tr>`).join('')}</tbody>`;
}

function buildSensTable() {
  const yields = [4, 4.5, 5, 5.4, 6, 6.5, 7, 7.5, 8];
  const nois = [0.7, 0.85, 1.0, 1.24, 1.5, 1.8].map(v => v * 1e6);
  let h = '<thead><tr><th>NOI \\ Yield</th>';
  yields.forEach(y => h += `<th>${y}%</th>`);
  h += '</tr></thead><tbody>';
  nois.forEach(n => {
    h += `<tr><td style="font-weight:600">${E.fmt(n, 1)}</td>`;
    yields.forEach(y => {
      const eq = (n / (y / 100)) - E.totaleSculd() + E.totaleKas();
      const isBase = Math.abs(y - D.scenario_params.base.yield_vastgoed_pct) < 0.01 && Math.abs(n - E.totalNOI()) < 10000;
      const cls = isBase ? 'cell-base' : eq > E.equityValue() * 1.1 ? 'cell-high' : eq > E.equityValue() * 0.8 ? 'cell-mid' : 'cell-low';
      h += `<td class="${cls}">${(eq / 1e6).toFixed(1)}</td>`;
    });
    h += '</tr>';
  });
  document.getElementById('sens-tbl').innerHTML = h + '</tbody>';
}

// ---- FINANCIERING ----
function buildFinanciering() {
  const leningen = D.leningen;
  const totSch = E.totaleSculd();
  const gew = E.gewogenRente();
  const nu = E.peildatum();
  const eerstvolgend = leningen.filter(l => l.einddatum).sort((a, b) => new Date(a.einddatum) - new Date(b.einddatum))[0];

  document.getElementById('fin-sub').textContent = `${leningen.length} faciliteiten · ${E.fmt(totSch)} totaal · Gew. rente ${gew.toFixed(1)}%`;
  document.getElementById('fin-kpis').innerHTML = [
    kpi('Totale schuld', E.fmt(totSch), leningen.length + ' leningen', 'kv-red'),
    kpi('Gew. gem. rente', gew.toFixed(2) + '%', 'Gewogen op saldo'),
    kpi('Eerstvolgende afloop', E.fmtDatum(eerstvolgend?.einddatum), eerstvolgend?.naam, 'kv-amber'),
    kpi('LTV portefeuille', E.gewogenLTV().toFixed(0) + '%', 'Gewogen gem.'),
  ].join('');

  const rows = leningen.map(l => {
    const obj = D.objecten.find(o => o.id === l.object_id);
    const maanden = l.einddatum ? E.maandenTot(l.einddatum) : 999;
    const statusCls = maanden < 6 ? 'red' : maanden < 9 ? 'amber' : 'green';
    const statusTxt = maanden < 6 ? 'Kritiek' : maanden < 9 ? 'Actie vereist' : 'Actief';
    const ltv = l.object_id ? E.ltvPerObject().find(o => o.id === l.object_id)?.ltv : null;
    const dscr = l.covenant_dscr_min ? (E.totalNOI() / (E.maandelijkseSchulddienst() * 12)).toFixed(2) : '—';
    return `<tr data-id="${esc(l.id)}">
      <td style="font-weight:600">${esc(l.naam)}</td>
      <td>${obj ? esc(obj.naam) : 'Groepsniveau'}</td>
      <td>${l.type}</td>
      <td class="num">${E.fmt(l.huidig_saldo)}</td>
      <td class="num">${l.rente_pct == null ? '—' : String(l.rente_pct).replace('.', ',') + '%'}</td>
      <td>${l.aflossing_type}</td>
      <td class="${maanden < 9 ? (maanden < 6 ? 'red' : 'amber') : ''}" style="font-weight:${maanden < 9 ? 600 : 400}">${E.fmtDatum(l.einddatum)}</td>
      <td class="num ${ltv && ltv > (l.covenant_ltv_max || 100) * 0.9 ? 'amber' : ''}">${ltv ? ltv.toFixed(0) + '%' : '—'}</td>
      <td class="num">${dscr}</td>
      <td>${badge(statusTxt, statusCls)}</td>
    </tr>`;
  }).join('');
  document.getElementById('fin-tbl').innerHTML = `
    <thead><tr><th>Lening</th><th>Object</th><th>Type</th><th>Saldo</th><th>Rente</th><th>Aflossing</th><th>Einddatum</th><th>LTV</th><th>DSCR</th><th>Status</th></tr></thead>
    <tbody>${rows}</tbody>`;

  // Maturity
  const jaren = {};
  leningen.forEach(l => {
    if (l.einddatum) {
      const jr = l.einddatum.substring(0, 4);
      jaren[jr] = (jaren[jr] || 0) + l.huidig_saldo;
    }
  });
  const jaarLabels = Object.keys(jaren).sort();
  new Chart(document.getElementById('matChart'), {
    type: 'bar',
    data: { labels: jaarLabels, datasets: [{ data: jaarLabels.map(j => Math.round(jaren[j] / 1e6 * 10) / 10), backgroundColor: jaarLabels.map(j => parseInt(j) <= nu.getFullYear() + 1 ? '#f0857a' : parseInt(j) <= nu.getFullYear() + 2 ? '#e8b64a' : '#6fa8ee'), borderRadius: 4 }] },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => '€' + ctx.parsed.y + 'M' } } }, scales: { x: { ticks: { font: { size: 11 }, }, grid: { display: false } }, y: { ticks: { font: { size: 11 }, callback: v => '€' + v + 'M' }, grid: { color: GRID } } } },
  });

  // Tranches
  document.getElementById('tranche-tbl').innerHTML = `
    <thead><tr><th>Nr</th><th>Lening</th><th>Bedrag</th><th>Datum</th><th>Voorwaarde</th><th>Status</th></tr></thead>
    <tbody>${D.bouw_tranches.map(t => {
    const ln = D.leningen.find(l => l.id === t.lening_id);
    const sc = { getrokken: 'green', goedgekeurd: 'blue', gepland: 'amber', toekomstig: 'gray' };
    return `<tr><td>${t.nr}</td><td>${ln?.naam}</td><td class="num">${E.fmt(t.bedrag)}</td><td>${t.datum}</td><td>${t.voorwaarde}</td><td>${badge(t.status, sc[t.status] || 'gray')}</td></tr>`;
  }).join('')}</tbody>`;
}

// ---- COVENANT ----
function buildCovenant() {
  const ltvObjs = E.ltvPerObject();
  const dscr = E.dscr();
  const icr = E.icr();
  const breaches = ltvObjs.filter(o => {
    const ln = D.leningen.find(l => l.object_id === o.id);
    return ln?.covenant_ltv_max && o.ltv > ln.covenant_ltv_max;
  }).length;
  const nearBreach = ltvObjs.filter(o => {
    const ln = D.leningen.find(l => l.object_id === o.id);
    return ln?.covenant_ltv_max && o.ltv > ln.covenant_ltv_max * 0.92 && o.ltv <= ln.covenant_ltv_max;
  }).length;

  document.getElementById('cov-kpis').innerHTML = [
    kpi('Covenants actief', D.leningen.filter(l => l.covenant_ltv_max || l.covenant_dscr_min).length.toString()),
    kpi('Breaches huidig', breaches.toString(), 'Over alle leningen', breaches > 0 ? 'kv-red' : 'kv-green'),
    kpi('Near-breach (<10%)', nearBreach.toString(), 'Marge smal', nearBreach > 0 ? 'kv-amber' : 'kv-green'),
    kpi('DSCR huidig', dscr.toFixed(2), 'Min. 1,20 vereist', dscr >= 1.4 ? 'kv-green' : dscr >= 1.2 ? 'kv-amber' : 'kv-red'),
  ].join('');

  const bars = [...ltvObjs.filter(o => o.ltv !== null).map(o => {
    const ln = D.leningen.find(l => l.object_id === o.id);
    const max = ln?.covenant_ltv_max || 75;
    const pct = E.clamp(o.ltv / max * 100, 0, 100);
    const color = o.ltv > max ? '#f0857a' : o.ltv > max * 0.9 ? '#e8b64a' : '#86c96b';
    return { label: o.naam + ' LTV', val: pct, display: o.ltv.toFixed(0) + '% / max ' + max + '%', threshPct: 100, color };
  }),
  { label: 'Portefeuille DSCR', val: E.clamp((dscr / 2) * 100, 0, 100), display: dscr.toFixed(2) + ' / min 1,20', threshPct: 60, color: dscr >= 1.4 ? '#86c96b' : dscr >= 1.2 ? '#e8b64a' : '#f0857a' },
  { label: 'ICR portefeuille', val: E.clamp((icr / 4) * 100, 0, 100), display: icr.toFixed(2) + ' / min 1,40', threshPct: 35, color: icr >= 2 ? '#86c96b' : '#e8b64a' },
  ];

  document.getElementById('cov-bars').innerHTML = bars.map(b => `
    <div class="cov-row">
      <span class="cov-label">${b.label}</span>
      <div class="cov-track">
        <div class="cov-fill" style="width:${b.val}%;background:${b.color}"></div>
        <div class="cov-thresh" style="left:${b.threshPct}%"></div>
      </div>
      <span class="cov-val" style="color:${b.color}">${b.display}</span>
    </div>`).join('');

  document.getElementById('cov-sim-tbl').innerHTML = `
    <thead><tr><th>Covenant</th><th>Huidig</th><th>Limiet</th><th>Base</th><th>Downside</th><th>Worst case</th></tr></thead>
    <tbody>${ltvObjs.filter(o => o.ltv).map(o => {
    const ln = D.leningen.find(l => l.object_id === o.id);
    const max = ln?.covenant_ltv_max || 75;
    const base = o.ltv * 0.98;
    const dn = o.ltv * 1.14;
    const wc = o.ltv * 1.28;
    return `<tr>
      <td>${o.naam} LTV</td>
      <td class="num ${o.ltv > max ? 'red' : o.ltv > max * 0.92 ? 'amber' : ''}">${o.ltv.toFixed(0)}%</td>
      <td class="num">${max}%</td>
      <td class="num">${base.toFixed(0)}%</td>
      <td class="num ${dn > max ? 'red' : 'amber'}">${dn.toFixed(0)}%${dn > max ? ' ⚠' : ''}</td>
      <td class="num red">${wc.toFixed(0)}%${wc > max ? ' ✗' : ''}</td>
    </tr>`;
  }).join('')}</tbody>`;
}

// ---- WAARDERING ----
const valParams = {
  noi: E.totalNOI(),
  ebitda: E.totalNOI() * 0.79,
  debt: E.totaleSculd(),
  cash: E.totaleKas(),
  mult: D.waardering.ebitda_multiple,
  yield_pct: D.scenario_params.base.yield_vastgoed_pct,
  prem_pct: D.waardering.platform_premium_pct,
};
let impC = null;
const VAL_FMT = {};
function buildValuation() {
  const sliders = [
    { id: 'v-noi', label: 'NOI (€/jaar)', min: E.totalNOI() * 0.5, max: E.totalNOI() * 1.8, step: 10000, key: 'noi', fmt: v => E.fmt(v, 1) },
    { id: 'v-ebitda', label: 'Adj. EBITDA', min: E.totalNOI() * 0.4, max: E.totalNOI() * 1.5, step: 10000, key: 'ebitda', fmt: v => E.fmt(v, 0) },
    { id: 'v-debt', label: 'Totale schuld', min: E.totaleSculd() * 0.5, max: E.totaleSculd() * 1.5, step: 50000, key: 'debt', fmt: v => E.fmt(v, 1) },
    { id: 'v-cash', label: 'Cash', min: 0, max: E.totaleKas() * 3, step: 50000, key: 'cash', fmt: v => E.fmt(v, 2) },
    { id: 'v-mult', label: 'EBITDA multiple', min: 5, max: 14, step: 0.5, key: 'mult', fmt: v => v.toFixed(1) + '×' },
    { id: 'v-yield', label: 'Yield %', min: 4, max: 8, step: 0.25, key: 'yield_pct', fmt: v => v.toFixed(2) + '%' },
    { id: 'v-prem', label: 'Platform premium %', min: 0, max: 20, step: 1, key: 'prem_pct', fmt: v => v.toFixed(0) + '%' },
  ];
  sliders.forEach(s => VAL_FMT[s.key] = s.fmt);
  const half = 4;
  const renderS = arr => arr.map(s => `<div class="slider-row"><span class="slider-label">${s.label}</span><input type="range" min="${s.min}" max="${s.max}" step="${s.step}" value="${valParams[s.key]}" id="${s.id}" oninput="valParams['${s.key}']=parseFloat(this.value);document.getElementById('${s.id}-o').textContent=VAL_FMT['${s.key}'](parseFloat(this.value));recalcVal()"><span class="slider-val" id="${s.id}-o">${s.fmt(valParams[s.key])}</span></div>`).join('');
  document.getElementById('val-sliders').innerHTML = `<div>${renderS(sliders.slice(0, half))}</div><div>${renderS(sliders.slice(half))}</div>`;
  recalcVal();
}

function recalcVal() {
  const { noi, ebitda, debt, cash, mult, yield_pct, prem_pct } = valParams;
  const rv = noi / (yield_pct / 100);
  const ev = ebitda * mult;
  const eq = rv - debt + cash;
  const tv = eq * (1 + prem_pct / 100);
  const prem = eq * prem_pct / 100;

  document.getElementById('val-kpis').innerHTML = [
    kpi('Vastgoedwaarde', E.fmt(rv), E.fmt(noi, 1) + ' ÷ ' + yield_pct.toFixed(2) + '%', 'kv-blue'),
    kpi('Enterprise value', E.fmt(ev), E.fmt(ebitda, 0) + ' × ' + mult.toFixed(1) + '×', 'kv-blue'),
    kpi('Equity value', E.fmt(eq), 'Vastgoed − schuld + cash', eq > 0 ? 'kv-green' : 'kv-red'),
    kpi('Totale waarde', E.fmt(tv), 'Equity + ' + prem_pct.toFixed(0) + '% premium', 'kv-green'),
  ].join('');

  const uRv = noi * 1.08 / ((yield_pct / 100) * 0.93);
  const uEq = uRv - debt + cash;
  const dRv = noi * 0.87 / ((yield_pct / 100) * 1.24);
  const dEq = dRv - debt + cash;
  document.getElementById('val-scenarios').innerHTML = `
    <div class="val-scen-grid">
      <div class="val-scen alert-green"><div class="l">Upside</div><div class="v">${E.fmt(uRv)}</div><div class="s">Equity: ${E.fmt(uEq)}</div></div>
      <div class="val-scen alert-blue"><div class="l">Base</div><div class="v">${E.fmt(rv)}</div><div class="s">Equity: ${E.fmt(eq)}</div></div>
      <div class="val-scen alert-red"><div class="l">Downside</div><div class="v">${E.fmt(dRv)}</div><div class="s">Equity: ${E.fmt(dEq)}</div></div>
    </div>`;

  const max = tv * 1.05;
  const steps = [
    { l: 'Vastgoedwaarde', v: rv, c: '#B5D4F4', tc: '#0C447C', tot: true },
    { l: 'Min. schuld', v: -debt, c: '#F09595', tc: '#791F1F', tot: false },
    { l: 'Plus cash', v: cash, c: '#97C459', tc: '#27500A', tot: false },
    { l: 'Equity value', v: eq, c: '#378ADD', tc: '#042C53', tot: true },
    { l: 'Platform prem.', v: prem, c: '#e8b64a', tc: '#412402', tot: false },
    { l: 'Totale waarde', v: tv, c: '#534AB7', tc: '#26215C', tot: true },
  ];
  document.getElementById('val-bridge').innerHTML = steps.map(s => {
    const bw = Math.max(4, Math.abs(s.tot ? s.v : s.v) / max * 100);
    const disp = s.tot ? E.fmt(s.v) : (s.v < 0 ? '−' : '+') + E.fmt(Math.abs(s.v));
    return `<div class="bridge-row"><span class="bridge-label">${s.l}</span><div class="bridge-bar" style="width:${bw}%;background:${s.c}"><span class="bridge-bar-val" style="color:${s.tc}">${disp}</span></div></div>`;
  }).join('');

  const yields = [4, 4.5, 5, 5.4, 6, 6.5, 7, 7.5, 8];
  const nois = [0.7, 0.85, 1.0, noi / 1e6, 1.5, 1.8].map(v => v * 1e6);
  let h = '<thead><tr><th>NOI\\Y</th>';
  yields.forEach(y => h += `<th>${y}%</th>`);
  h += '</tr></thead><tbody>';
  nois.forEach(n => {
    h += `<tr><td style="font-weight:600">${E.fmt(n, 1)}</td>`;
    yields.forEach(y => {
      const eq2 = (n / (y / 100)) - debt + cash;
      const isBase = Math.abs(y - yield_pct) < 0.01 && Math.abs(n - noi) < 10000;
      const cls = isBase ? 'cell-base' : eq2 > eq * 1.2 ? 'cell-high' : eq2 > eq * 0.8 ? 'cell-mid' : 'cell-low';
      h += `<td class="${cls}">${(eq2 / 1e6).toFixed(1)}</td>`;
    });
    h += '</tr>';
  });
  document.getElementById('val-sens').innerHTML = h + '</tbody>';

  const impacts = [
    { l: 'Base', v: eq, c: '#6fa8ee' },
    { l: 'Huur −15%', v: (noi * 0.85 / (yield_pct / 100)) - debt + cash, c: '#f0857a' },
    { l: 'Yield +1,5%', v: (noi / ((yield_pct + 1.5) / 100)) - debt + cash, c: '#f0857a' },
    { l: 'Rente +150bps', v: eq - debt * 0.015 / 0.07, c: '#f6b2aa' },
    { l: 'Bouw +6m delay', v: eq - noi * 0.4, c: '#e8b64a' },
    { l: 'All-in worst', v: (noi * 0.8 / ((yield_pct + 2) / 100)) - debt * 1.05 + cash * 0.9, c: '#b84a40' },
  ];
  if (impC) impC.destroy();
  impC = new Chart(document.getElementById('impactChart'), {
    type: 'bar',
    data: { labels: impacts.map(s => s.l), datasets: [{ data: impacts.map(s => Math.round(s.v / 1e6 * 100) / 100), backgroundColor: impacts.map(s => s.c), borderRadius: 3 }] },
    options: { responsive: true, maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => '€' + Math.abs(ctx.parsed.x).toFixed(2) + 'M equity' } } }, scales: { x: { ticks: { font: { size: 10 }, callback: v => '€' + v + 'M' }, grid: { color: GRID } }, y: { ticks: { font: { size: 11 }, }, grid: { display: false } } } },
  });
}

// ---- GROEPSSTRUCTUUR ----
function buildOwnership() {
  const SVG = document.getElementById('org-svg');
  const VW = 420, BW = 100, BH = 40, FW = 170;
  const kleur = {
    ubo:     { fill: '#342c5a', stroke: '#8a7ee0', tc1: '#e1dcff', tc2: '#b4aaf0' },
    holding: { fill: '#1f4034', stroke: '#4fb28c', tc1: '#cdeee0', tc2: '#8fd4b8' },
    top:     { fill: '#4d2a1e', stroke: '#d27a55', tc1: '#fbdccf', tc2: '#eeae93' },
    bv:      { fill: '#1f3553', stroke: '#5b8fd9', tc1: '#d6e6fb', tc2: '#9fc2ef' },
  };
  const n = D.eigenaren.length;
  const kolomX = i => (VW / n) * (i + 0.5) - BW / 2;
  const bvs = [...new Set(D.objecten.filter(o => o.eigenaar_bv).map(o => o.eigenaar_bv))]
    .filter(bv => bv !== D.meta.bedrijfsnaam);
  const bvW = Math.min(BW, (VW - 10 * (bvs.length + 1)) / Math.max(bvs.length, 1));
  const bvGap = (VW - bvs.length * bvW) / (bvs.length + 1);

  const nodes = [
    ...D.eigenaren.map((e, i) => ({ id: e.id, x: kolomX(i), y: 20, w: BW, label: e.naam, sub: 'UBO · ' + e.participatie_pct + '%', ...kleur.ubo })),
    ...D.eigenaren.map((e, i) => ({ id: e.id + '_h', x: kolomX(i), y: 110, w: BW, label: e.holding, sub: '100% ' + e.naam.split(' ')[0], ...kleur.holding })),
    { id: 'fv', x: (VW - FW) / 2, y: 200, w: FW, label: D.meta.bedrijfsnaam, sub: D.eigenaren.map(e => e.participatie_pct + '% ' + e.naam.split(' ')[0]).join(' · '), ...kleur.top },
    ...bvs.map((bv, i) => ({ id: 'bv_' + i, bv, x: bvGap + i * (bvW + bvGap), y: 290, w: bvW, label: bv.replace(/ BV$/, ''), sub: D.objecten.filter(o => o.eigenaar_bv === bv).map(o => o.stad).join(', '), ...kleur.bv })),
  ];
  const byId = id => nodes.find(x => x.id === id);
  const lijn = (a, b, label) => {
    const x1 = a.x + a.w / 2, y1 = a.y + BH, x2 = b.x + b.w / 2, y2 = b.y;
    let out = `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2 - 2}" stroke="#8e8e8e" stroke-width="1.1" marker-end="url(#arr)"/>`;
    if (label) out += `<text x="${(x1 + x2) / 2 + 6}" y="${(y1 + y2) / 2 + 3}" font-size="9.5" fill="#c4c4c4" font-family="DM Sans,sans-serif">${label}</text>`;
    return out;
  };

  let svg = '';
  D.eigenaren.forEach(e => {
    svg += lijn(byId(e.id), byId(e.id + '_h'), '100%');
    svg += lijn(byId(e.id + '_h'), byId('fv'), e.participatie_pct + '%');
  });
  nodes.filter(x => x.bv).forEach(x => svg += lijn(byId('fv'), x, ''));

  svg += nodes.map(x => {
    const cx = x.x + x.w / 2;
    return `<g class="ent-box" onclick="showEnt('${x.id}')">
      <rect x="${x.x}" y="${x.y}" width="${x.w}" height="${BH}" rx="7" fill="${x.fill}" stroke="${x.stroke}" stroke-width="0.8"/>
      <text x="${cx}" y="${x.y + 16}" text-anchor="middle" font-size="10.5" font-weight="600" fill="${x.tc1}" font-family="DM Sans,sans-serif">${x.label}</text>
      <text x="${cx}" y="${x.y + 29}" text-anchor="middle" font-size="9" fill="${x.tc2}" font-family="DM Sans,sans-serif">${x.sub}</text>
    </g>`;
  }).join('');

  SVG.innerHTML = SVG.innerHTML + svg;

  nodes.filter(x => x.bv).forEach(x => {
    const kas = D.kasstand.find(k => k.entiteit === x.bv);
    const objs = D.objecten.filter(o => o.eigenaar_bv === x.bv);
    entData[x.id] = {
      naam: x.bv, Type: 'Object-BV', Eigenaar: '100% ' + D.meta.bedrijfsnaam,
      Objecten: objs.map(o => o.naam).join(', '),
      Marktwaarde: E.fmt(objs.reduce((s, o) => s + (o.marktwaarde || 0), 0)),
      Kas: E.fmt(kas ? kas.saldo : 0),
    };
  });
}

// ---- LOOK-THROUGH (pagina Eigenaren) ----
function buildLookThrough() {
  const lt = E.navPerEigenaar();
  const irr = E.portefeuilleIRR();
  document.getElementById('lt-tbl').innerHTML = `
    <thead><tr><th>Eigenaar</th><th>Holding</th><th>Participatie</th><th>Kapitaal ingebracht</th><th>ASL gegeven</th><th>NAV-aandeel</th><th>Equity-aandeel</th><th>IRR (portefeuille)</th></tr></thead>
    <tbody>${lt.map(e => `<tr>
      <td style="font-weight:600">${e.naam}</td>
      <td>${e.holding}</td>
      <td class="num">${e.participatie_pct}%</td>
      <td class="num">${E.fmt(e.kapitaal_ingebracht)}</td>
      <td class="num">${e.asl_gegeven ? E.fmt(e.asl_gegeven) + ' @ ' + e.asl_rente_pct + '%' : '—'}</td>
      <td class="num green">${E.fmt(e.nav_aandeel)}</td>
      <td class="num green">${E.fmt(e.equity_aandeel)}</td>
      <td class="num green">${irr === null ? '—' : irr.toFixed(1) + '%'}</td>
    </tr>`).join('')}</tbody>`;
}

const entData = {};
D.eigenaren.forEach(e => {
  entData[e.id] = { naam: e.naam, Type: 'UBO / natuurlijk persoon', Participatie: e.participatie_pct + '%', 'Kapitaal ingebracht': E.fmt(e.kapitaal_ingebracht), 'NAV-aandeel': E.fmt(E.nav() * e.participatie_pct / 100), 'ASL gegeven': E.fmt(e.asl_gegeven) };
  entData[e.id + '_h'] = { naam: e.holding, Type: 'Persoonlijke holding', Eigenaar: '100% ' + e.naam, 'Cash beschikbaar': E.fmt(D.kasstand.find(k => k.entiteit === e.holding)?.saldo || 0) };
});
entData['fv'] = { naam: D.meta.bedrijfsnaam, Type: 'Hoofdentiteit', 'Totale schuld': E.fmt(E.totaleSculd()), NAV: E.fmt(E.nav()), Eigenaren: D.eigenaren.map(e => e.participatie_pct + '% ' + e.naam).join(', ') };

function showEnt(id) {
  const d = entData[id];
  if (!d) return;
  document.getElementById('ent-naam').textContent = d.naam;
  document.getElementById('ent-rows').innerHTML = Object.entries(d).filter(([k]) => k !== 'naam').map(([k, v]) => `<div class="ed-row"><span class="ed-key">${k}</span><span class="ed-val">${v}</span></div>`).join('');
  document.getElementById('ent-detail').style.display = 'block';
}

// ---- EQUITY CALLS ----
function buildEquity() {
  const totaal = D.transacties.filter(t => t.type === 'equity_call').reduce((s, t) => s + Math.abs(t.bedrag), 0);
  const gewogen = E.gewogenEquityCall();
  const holdingKas = D.eigenaren.reduce((s, e) => s + (D.kasstand.find(k => k.entiteit === e.holding)?.saldo || 0), 0);

  document.getElementById('eq-sub').textContent = `${D.eigenaren.map(e => e.naam).join(' · ')} · ${D.transacties.filter(t => t.type === 'equity_call').length} calls gepland`;
  document.getElementById('eq-kpis').innerHTML = [
    kpi('Totale equity calls', E.fmt(totaal), D.transacties.filter(t => t.type === 'equity_call').length + ' events', 'kv-red'),
    kpi('Probability-gewogen', E.fmt(gewogen), 'Op basis van kansweging', 'kv-amber'),
    kpi('Holdings cash beschikbaar', E.fmt(holdingKas), D.eigenaren.length + ' holdings samen', 'kv-blue'),
  ].join('');

  const rows = D.transacties.filter(t => t.type === 'equity_call').map(t => {
    const obj = D.objecten.find(o => o.id === t.object_id);
    const splits = D.eigenaren.map(e => `${e.naam.split(' ')[0]}: ${E.fmt(Math.abs(t.bedrag) * e.participatie_pct / 100)}`).join('<br>');
    return `<tr>
      <td style="font-weight:600">${obj?.naam || t.naam}</td>
      <td class="num red">${E.fmt(t.bedrag)}</td>
      <td>${t.verwachte_datum.substring(0, 7)}</td>
      <td style="font-size:11px">${splits}</td>
      <td>${t.toelichting || '—'}</td>
      <td class="num">${t.kans_pct}%</td>
      <td>${certBadge(t.zekerheid)}</td>
    </tr>`;
  }).join('');
  document.getElementById('eq-tbl').innerHTML = `
    <thead><tr><th>Project</th><th>Totaal</th><th>Datum</th><th>Verdeling</th><th>Bron</th><th>Kans</th><th>Status</th></tr></thead>
    <tbody>${rows}</tbody>`;

  document.getElementById('eq-eigenaren').innerHTML = D.eigenaren.map(e => {
    const hKas = D.kasstand.find(k => k.entiteit === e.holding)?.saldo || 0;
    const calls = D.transacties.filter(t => t.type === 'equity_call').reduce((s, t) => s + Math.abs(t.bedrag) * e.participatie_pct / 100, 0);
    const gap = calls - hKas;
    const maxV = Math.max(hKas, calls);
    return `<div class="card" style="margin-bottom:0">
      <div class="card-title">${e.naam} — ${e.holding}</div>
      <div class="prog-wrap"><span class="prog-label">Holding cash beschikbaar</span><div class="prog-track"><div class="prog-fill" style="width:${E.clamp(hKas / maxV * 100, 0, 100)}%;background:var(--blue)"></div></div><span class="prog-val">${E.fmt(hKas)}</span></div>
      <div class="prog-wrap"><span class="prog-label">Totale equity calls (aandeel)</span><div class="prog-track"><div class="prog-fill" style="width:${E.clamp(calls / maxV * 100, 0, 100)}%;background:var(--red)"></div></div><span class="prog-val">${E.fmt(calls)}</span></div>
      ${gap > 0 ? alertEl('aandacht', `Tekort: ${E.fmt(gap)} extra financiering of dividend nodig.`) : alertEl('ok', 'Voldoende cash beschikbaar.')}
    </div>`;
  }).join('');
}

// ---- EXIT & RISK ----
function buildExit() {
  document.getElementById('exit-kpis').innerHTML = [
    kpi('Exitwaarde base', E.fmt(E.totaleWaarde()), 'Equity + platform premium', 'kv-green'),
    kpi('Exitwaarde downside', E.fmt(E.totaleWaarde(D.scenario_params.downside.yield_vastgoed_pct)), 'Yield ' + D.scenario_params.downside.yield_vastgoed_pct + '%', 'kv-red'),
    kpi('Exit readiness', '58%', '7/12 KPIs behaald', 'kv-amber'),
    kpi('Aanbevolen tijdlijn', 'Q3 2028', 'Na Eindhoven oplevering', 'kv-blue'),
  ].join('');

  const kpis = [
    { cat: 'Earnings', kpi: 'Adj. EBITDA', huidig: E.fmt(E.totalNOI() * 0.79, 0), doel: '€1,5M+', status: 'amber' },
    { cat: 'Vastgoed', kpi: 'Bezettingsgraad', huidig: '94%', doel: '95%+', status: 'amber' },
    { cat: 'Vastgoed', kpi: 'WAULT (gewogen)', huidig: '2,8 jr', doel: '4,0 jr+', status: 'red' },
    { cat: 'Financiering', kpi: 'LTV portefeuille', huidig: E.gewogenLTV().toFixed(0) + '%', doel: '<55%', status: E.gewogenLTV() < 55 ? 'green' : 'amber' },
    { cat: 'Financiering', kpi: 'DSCR', huidig: E.dscr().toFixed(2), doel: '1,50+', status: E.dscr() >= 1.5 ? 'green' : 'amber' },
    { cat: 'Structuur', kpi: 'Documentatie compleet', huidig: '65%', doel: '100%', status: 'red' },
    { cat: 'Cash', kpi: 'Free cashflow/jr', huidig: E.fmt(E.totalNOI() - E.maandelijkseSchulddienst() * 12, 0), doel: '€600k+', status: 'amber' },
    { cat: 'Portfolio', kpi: 'Concentratierisico', huidig: 'Middel', doel: 'Laag', status: 'amber' },
    { cat: 'Portfolio', kpi: 'Audit trail 3 jr', huidig: 'Ja', doel: 'Ja', status: 'green' },
  ];
  document.getElementById('exit-kpi-tbl').innerHTML = `
    <thead><tr><th>Categorie</th><th>KPI</th><th>Huidig</th><th>Exitdoel</th><th>Status</th></tr></thead>
    <tbody>${kpis.map(k => `<tr><td>${k.cat}</td><td style="font-weight:600">${k.kpi}</td><td class="num">${k.huidig}</td><td>${k.doel}</td><td>${badge(k.status === 'green' ? 'Behaald' : k.status === 'amber' ? 'In progress' : 'Aandacht', k.status)}</td></tr>`).join('')}</tbody>`;

  const risks = [
    { naam: 'Hypotheek afloop zonder herfi', kans: 'Laag', impact: 'Zeer hoog', score: 'red', actie: 'Aanvraag indienen 3 mnd voor afloop' },
    { naam: 'Bouwvertraging Eindhoven', kans: 'Middel', impact: 'Hoog', score: 'red', actie: 'Wekelijks bouwoverleg' },
    { naam: 'Grote huurder vertrekt', kans: 'Middel', impact: 'Hoog', score: 'red', actie: 'Contractverlenging initiëren' },
    { naam: 'Rentestijging +150bps', kans: 'Middel', impact: 'Middel', score: 'amber', actie: 'Vaste rente overwegen bij herfi' },
    { naam: 'Acquisitie valt weg', kans: 'Laag', impact: 'Laag', score: 'blue', actie: 'Kasreserve beschikbaar' },
    { naam: 'LTV-breach', kans: 'Laag', impact: 'Hoog', score: 'amber', actie: 'Bijstorten of taxatie verhogen' },
  ];
  document.getElementById('risk-tbl').innerHTML = `
    <thead><tr><th>Risico</th><th>Kans</th><th>Impact</th><th>Score</th><th>Mitigatie</th></tr></thead>
    <tbody>${risks.map(r => `<tr><td style="font-weight:600">${r.naam}</td><td>${r.kans}</td><td>${r.impact}</td><td>${badge(r.score === 'red' ? 'Hoog' : r.score === 'amber' ? 'Middel' : 'Laag', r.score)}</td><td style="color:var(--text-2)">${r.actie}</td></tr>`).join('')}</tbody>`;

  const breekpunten = E.generateAlerts().filter(a => a.niveau === 'kritiek');
  document.getElementById('breekpunten').innerHTML = (breekpunten.length
    ? breekpunten.map(a => alertEl('kritiek', a.tekst))
    : [alertEl('ok', 'Geen kritieke breekpunten gedetecteerd op basis van huidige data.')]
  ).join('');
}


// ---- CREDITEUREN ----
const CRED_BADGE = { open: 'blue', betaalregeling: 'purple', incasso: 'amber', faillissement: 'red', betaald: 'gray' };
const CRED_FILTERS = [
  { key: 'alle', label: 'Alle', f: c => c.status !== 'betaald' },
  { key: 'nu', label: 'Nu betalen', f: c => c.urgentie.niveau === 'kritiek' },
  { key: 'open', label: 'Open', f: c => c.status === 'open' },
  { key: 'betaalregeling', label: 'Betaalregeling', f: c => c.status === 'betaalregeling' },
  { key: 'incasso', label: 'Incasso', f: c => c.status === 'incasso' },
  { key: 'faillissement', label: 'Faillissement', f: c => c.status === 'faillissement' },
  { key: 'schuifbaar', label: 'Schuifbaar', f: c => c.status !== 'betaald' && c.schuifruimte !== 'nee' },
  { key: 'betaald', label: 'Betaald', f: c => c.status === 'betaald' },
];
let credFilter = 'alle';
let credC = null;

function buildCrediteuren() {
  const lijst = E.crediteurenGesorteerd();
  const actief = lijst.filter(c => c.status !== 'betaald');
  const som = arr => arr.reduce((s, c) => s + (c.bedrag_open || 0), 0);
  const nu = actief.filter(c => c.urgentie.niveau === 'kritiek');
  const binnen14 = actief.filter(c => c.urgentie.dagen !== null && c.urgentie.dagen <= 14);
  const incasso = actief.filter(c => c.status === 'incasso' || c.status === 'faillissement');
  const regelingen = actief.filter(c => c.status === 'betaalregeling');
  const vrijeKas = E.beschikbareKas();
  const teBetalen14 = binnen14.reduce((s, c) => s + c.te_betalen, 0);

  const vd = E.vandaag();
  document.getElementById('cred-sub').textContent =
    `${actief.length} openstaande crediteuren · ${E.fmt(som(actief))} totaal · Stand ${vd.getDate()} ${E.fmtDatum(vd.getFullYear() + '-' + (vd.getMonth() + 1))}`;

  document.getElementById('cred-kpis').innerHTML = [
    kpi('Totaal openstaand', E.fmt(som(actief)), actief.length + ' partijen', 'kv-red'),
    kpi('Te betalen ≤ 14 dagen', E.fmt(teBetalen14), `${binnen14.length} betalingen · vrije kas ${E.fmt(vrijeKas)}`, teBetalen14 > vrijeKas ? 'kv-red' : 'kv-amber'),
    kpi('Incasso / faillissement', String(incasso.length), incasso.length ? E.fmt(som(incasso)) + ' — direct oppakken' : 'Geen', incasso.length ? 'kv-red' : 'kv-green'),
    kpi('Betaalregelingen', String(regelingen.length), E.fmt(regelingen.reduce((s, c) => s + (c.termijn_bedrag || 0), 0)) + ' per maand', 'kv-blue'),
  ].join('');

  // Nu betalen
  const urgent = actief.filter(c => c.urgentie.niveau !== 'ok');
  document.getElementById('cred-alerts').innerHTML = urgent.length
    ? urgent.map(c => alertEl(c.urgentie.niveau,
      `<strong>${esc(c.naam)}</strong> · ${E.fmt(c.te_betalen)} vóór ${E.fmtDatum(c.deadline)} (${E.dagenTekst(c.urgentie.dagen)})` +
      ` · ${E.CRED_STATUS[c.status].label}${c.schuifruimte === 'nee' ? ' · niet schuifbaar' : c.schuifruimte === 'beperkt' ? ` · max ${c.max_uitstel_dagen || 7} dagen uitstel` : ` · uitstel tot ${c.max_uitstel_dagen || 30} dagen mogelijk`}` +
      (c.notitie ? `<br><span style="opacity:.85">${esc(c.notitie)}</span>` : ''), betaalKnop(c.id))).join('')
    : alertEl('ok', 'Geen betalingen die binnen 14 dagen actie vereisen.');

  // Filters
  document.getElementById('cred-filter').innerHTML = CRED_FILTERS.map(f =>
    `<button type="button" class="tab-btn${f.key === credFilter ? ' active-filter' : ''}" onclick="setCredFilter('${f.key}')">${f.label}<span class="cnt">${lijst.filter(f.f).length}</span></button>`).join('');
  buildCredTabel(lijst);

  // Betaalregelingen
  document.getElementById('cred-regelingen').innerHTML = regelingen.length ? `
    <thead><tr><th>Partij</th><th>Termijn</th><th>Volgende</th><th>Termijnen</th><th>Restschuld</th></tr></thead>
    <tbody>${regelingen.map(c => `<tr class="klikbaar" onclick="openDossier('${esc(c.id)}')">
      <td class="cred-naam">${esc(c.naam)}</td>
      <td class="num">${E.fmt(c.termijn_bedrag)}/mnd</td>
      <td class="${c.urgentie.niveau === 'kritiek' ? 'red' : c.urgentie.niveau === 'aandacht' ? 'amber' : ''} td-nowrap">${E.fmtDatum(c.volgende_termijn)}<br><span class="cred-dagen">${E.dagenTekst(c.urgentie.dagen)}</span></td>
      <td class="num">${c.termijnen_resterend ?? '—'}</td>
      <td class="num">${E.fmt(c.bedrag_open)}</td>
    </tr>`).join('')}</tbody>` : '<tbody><tr><td style="color:var(--text-3)">Geen lopende betaalregelingen.</td></tr></tbody>';

  // Schuifruimte
  const schuifbaar = actief.filter(c => c.schuifruimte && c.schuifruimte !== 'nee' && c.status !== 'faillissement' && c.status !== 'incasso');
  document.getElementById('cred-schuif').innerHTML = schuifbaar.length ? schuifbaar.map(c => `
    <div class="schuif-rij">
      <div><span class="cred-naam">${esc(c.naam)}</span><small>${c.schuifruimte === 'ja' ? 'Schuifbaar' : 'Beperkt schuifbaar'} · max ${c.max_uitstel_dagen || (c.schuifruimte === 'ja' ? 30 : 7)} dagen · deadline ${E.fmtDatum(c.deadline)}</small></div>
      <div class="num" style="white-space:nowrap">${E.fmt(c.te_betalen)}</div>
    </div>`).join('') +
    `<div class="schuif-totaal">Totaal uit te stellen: <strong>${E.fmt(schuifbaar.reduce((s, c) => s + c.te_betalen, 0))}</strong></div>`
    : '<p style="color:var(--text-3)">Geen posten met schuifruimte.</p>';

  // Betaalplanning per week (12 weken)
  const weken = Array.from({ length: 12 }, (_, i) => ({ start: new Date(vd.getTime() + i * 7 * 86400000), hard: 0, zacht: 0 }));
  const achterstallig = { hard: 0, zacht: 0 };
  actief.forEach(c => {
    // alle geplande betalingen: bij regeling elke maand een termijn
    const momenten = [];
    if (c.status === 'betaalregeling' && c.volgende_termijn && c.termijn_bedrag) {
      let rest = c.bedrag_open;
      for (let i = 0; i < (c.termijnen_resterend || 12) && rest > 0; i++) {
        const [j, m, d] = E.parseDatum(c.volgende_termijn);
        momenten.push({ datum: new Date(j, m + i, d), bedrag: Math.min(c.termijn_bedrag, rest) });
        rest -= c.termijn_bedrag;
      }
    } else if (c.vervaldatum) {
      const [j, m, d] = E.parseDatum(c.vervaldatum);
      momenten.push({ datum: new Date(j, m, d), bedrag: c.bedrag_open });
    }
    const soort = c.schuifruimte === 'ja' ? 'zacht' : 'hard';
    momenten.forEach(mo => {
      const w = Math.floor((mo.datum - vd) / (7 * 86400000));
      if (w < 0) achterstallig[soort] += mo.bedrag;
      else if (w < 12) weken[w][soort] += mo.bedrag;
    });
  });
  weken[0].hard += achterstallig.hard; weken[0].zacht += achterstallig.zacht;
  const labels = weken.map((w, i) => i === 0 ? 'Deze week' : `${w.start.getDate()} ${E.fmtDatum(w.start.getFullYear() + '-' + (w.start.getMonth() + 1)).split(' ')[0]}`);
  let cum = 0;
  const cumulatief = weken.map(w => (cum += w.hard + w.zacht));
  if (credC) credC.destroy();
  credC = new Chart(document.getElementById('credChart'), {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'Niet schuifbaar', data: weken.map(w => w.hard), backgroundColor: 'rgba(240,133,122,0.75)', borderRadius: 3, stack: 'b' },
      { label: 'Schuifbaar', data: weken.map(w => w.zacht), backgroundColor: 'rgba(232,182,74,0.7)', borderRadius: 3, stack: 'b' },
      { type: 'line', label: 'Cumulatief', stack: 'cum', data: cumulatief, borderColor: '#6fa8ee', borderWidth: 2, pointRadius: 0, tension: 0.3 },
    ]},
    options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: true, labels: { boxWidth: 10, font: { size: 11 } } }, tooltip: { callbacks: { label: ctx => ctx.dataset.label + ': ' + E.fmt(ctx.parsed.y) } } },
      scales: { x: { stacked: true, ticks: { font: { size: 11 } }, grid: { display: false } }, y: { stacked: true, ticks: { font: { size: 11 }, callback: v => E.fmt(v) } } } },
  });
}

function buildCredTabel(lijst) {
  const filter = CRED_FILTERS.find(f => f.key === credFilter) || CRED_FILTERS[0];
  const rijen = lijst.filter(filter.f);
  const prioTxt = { 1: 'Hoog', 2: 'Middel', 3: 'Laag' };
  document.getElementById('cred-tbl').innerHTML = `
    <thead><tr><th>Partij</th><th>Status</th><th>Openstaand</th><th>Nu te betalen</th><th>Deadline</th><th>Prio</th><th>Schuifruimte</th><th>Entiteit</th><th></th></tr></thead>
    <tbody>${rijen.length ? rijen.map(c => {
      const u = c.urgentie;
      const kl = u.niveau === 'kritiek' ? 'red' : u.niveau === 'aandacht' ? 'amber' : '';
      return `<tr class="klikbaar urg-${u.niveau}" onclick="openDossier('${esc(c.id)}')">
        <td><div class="cred-naam">${esc(c.naam)}</div><div class="cred-oms">${esc(c.omschrijving || c.categorie || '')}</div></td>
        <td>${badge(E.CRED_STATUS[c.status]?.label || c.status, CRED_BADGE[c.status] || 'gray')}</td>
        <td class="num">${E.fmt(c.bedrag_open)}</td>
        <td class="num ${kl}">${c.status === 'betaald' ? '—' : E.fmt(c.te_betalen)}</td>
        <td class="${kl} td-nowrap">${E.fmtDatum(c.deadline)}${c.status !== 'betaald' ? `<br><span class="cred-dagen">${E.dagenTekst(u.dagen)}</span>` : ''}</td>
        <td><span class="prio prio-${c.prioriteit || 2}">${prioTxt[c.prioriteit || 2]}</span></td>
        <td>${c.schuifruimte === 'ja' ? badge('Ja · ' + (c.max_uitstel_dagen || 30) + 'd', 'green') : c.schuifruimte === 'beperkt' ? badge('Beperkt · ' + (c.max_uitstel_dagen || 7) + 'd', 'amber') : badge('Nee', 'red')}</td>
        <td class="cred-oms">${esc(c.entiteit || '—')}</td>
        <td class="row-actions"><span class="rij-pijl" aria-hidden="true">›</span></td>
      </tr>`;
    }).join('') : '<tr><td colspan="9" style="color:var(--text-3)">Geen crediteuren in deze selectie.</td></tr>'}</tbody>`;
}

function setCredFilter(key) {
  credFilter = key;
  buildCrediteuren();
}

// Meldingen: teller in de zijbalk + (optioneel) browsermelding, max. 1x per dag
window.CRED = (function () {
  function urgent() {
    return E.crediteurenGesorteerd().filter(c => c.urgentie.niveau === 'kritiek');
  }
  function toonMelding(force) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const lijst = urgent();
    if (!lijst.length) return;
    const key = 'cred_melding_' + new Date().toISOString().slice(0, 10);
    try { if (!force && localStorage.getItem(key)) return; localStorage.setItem(key, '1'); } catch (e) { /* niets */ }
    const totaal = lijst.reduce((s, c) => s + c.te_betalen, 0);
    new Notification(`${lijst.length} betaling${lijst.length > 1 ? 'en' : ''} vereist actie (${E.fmt(totaal)})`, {
      body: lijst.slice(0, 4).map(c => `${c.naam}: ${E.fmt(c.te_betalen)} — ${E.dagenTekst(c.urgentie.dagen)}`).join('\n'),
      tag: 'crediteuren',
    });
  }
  function meldingenAan() {
    if (!('Notification' in window)) { alert('Deze browser ondersteunt geen meldingen.'); return; }
    Notification.requestPermission().then(p => {
      knop();
      if (p === 'granted') toonMelding(true);
      else alert('Meldingen zijn geblokkeerd. Sta ze toe via het slotje naast het webadres.');
    });
  }
  function knop() {
    const b = document.getElementById('cred-notif-btn');
    if (!b) return;
    if (!('Notification' in window)) { b.hidden = true; return; }
    if (Notification.permission === 'granted') { b.textContent = 'Browsermeldingen staan aan'; b.disabled = true; }
  }
  // Teller in de zijbalk
  const n = urgent().length;
  const tel = document.getElementById('nav-cred-count');
  if (tel && n) { tel.textContent = n; tel.hidden = false; }
  const dot = document.getElementById('nav-cred-dot');
  if (dot && n) dot.hidden = false;
  knop();
  toonMelding(false);
  return { meldingenAan };
})();
