/**
 * ============================================================
 *  ACCOUNTMENU, THEMA, ZIJBALK-MODUS
 *  Profiel en voorkeuren worden in deze browser bewaard.
 *  Laden NA editor.js.
 * ============================================================
 */

(function () {
  const $ = id => document.getElementById(id);
  const lees = (k, d) => { try { return localStorage.getItem(k) || d; } catch (e) { return d; } };
  const schrijf = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* privévenster */ } };
  const esc = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const CHANGELOG = [
    { versie: '1.5', titel: 'Accountmenu en nieuwe navigatie', punten: ['Accountmenu rechtsboven met profiel, thema en gegevens', 'Licht, donker of systeemthema', 'Zijbalk als iconenbalk die uitklapt bij hover (instelbaar)', 'Compactere typografie'] },
    { versie: '1.4', titel: 'Leningovereenkomst uitlezen met AI', punten: ['Upload een PDF of foto; de AI vult de leningvelden in', 'Per veld zekerheid en bronpassage, opslaan pas na controle'] },
    { versie: '1.3', titel: 'Crediteuren', punten: ['Overzicht van alle te betalen partijen met status, deadlines en prioriteit', 'Betaalregelingen, schuifruimte en betaalplanning', 'Meldingen voor betalingen die niet kunnen wachten'] },
    { versie: '1.2', titel: 'Objecten en leningen beheren', punten: ['Toevoegen, wijzigen en verwijderen vanuit het dashboard', 'Export, import en herstel van gegevens'] },
    { versie: '1.1', titel: 'Nieuwe vormgeving', punten: ['Donker thema en Management-overzicht', 'Herziene navigatie en Nederlandse getalnotatie'] },
  ];

  // ---------- MENU'S OPENEN / SLUITEN ----------
  const menus = [];
  function maakMenu(knop, menu) {
    const open = () => {
      menus.forEach(m => m.sluit());
      menu.hidden = false;
      knop.setAttribute('aria-expanded', 'true');
      const eerste = menu.querySelector('.pm-item');
      if (eerste) eerste.focus({ preventScroll: true });
    };
    const sluit = () => { menu.hidden = true; knop.setAttribute('aria-expanded', 'false'); };
    knop.addEventListener('click', e => { e.stopPropagation(); menu.hidden ? open() : sluit(); });
    menu.addEventListener('click', e => e.stopPropagation());
    menu.addEventListener('keydown', e => {
      const items = [...menu.querySelectorAll('.pm-item')];
      const i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    });
    const m = { sluit, knop };
    menus.push(m);
    return m;
  }
  document.addEventListener('click', () => menus.forEach(m => m.sluit()));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && menus.some(m => m.knop.getAttribute('aria-expanded') === 'true')) {
      const open = menus.find(m => m.knop.getAttribute('aria-expanded') === 'true');
      menus.forEach(m => m.sluit());
      if (open) open.knop.focus();
    }
  });

  // ---------- PROFIEL ----------
  function profiel() {
    try { return JSON.parse(lees('profiel', '{}')) || {}; } catch (e) { return {}; }
  }
  function initialen(naam, email) {
    const bron = (naam || '').trim() || (email || '').split('@')[0];
    if (!bron) return '?';
    const delen = bron.split(/[\s._-]+/).filter(Boolean);
    return ((delen[0] || '')[0] + (delen.length > 1 ? delen[delen.length - 1][0] : (delen[0] || '')[1] || '')).toUpperCase();
  }
  function toonProfiel() {
    const p = profiel();
    $('avatar-init').textContent = initialen(p.naam, p.email);
    $('am-naam').textContent = p.naam || p.email || 'Mijn account';
    $('am-email').textContent = p.naam && p.email ? p.email : (p.email ? '' : 'Profiel nog niet ingesteld');
  }
  function accountModal() {
    const p = profiel();
    const body = `
      <p class="modal-uitleg">Je profiel wordt alleen in deze browser bewaard en is zichtbaar in het accountmenu.</p>
      <div class="f-grid f-grid-2">
        <label class="f-veld"><span>Naam</span><input name="naam" value="${esc(p.naam)}" placeholder="Voor- en achternaam"></label>
        <label class="f-veld"><span>E-mailadres</span><input name="email" type="email" value="${esc(p.email)}" placeholder="naam@bedrijf.nl"></label>
        <label class="f-veld"><span>Functie</span><input name="functie" value="${esc(p.functie)}" placeholder="Bijv. directeur"></label>
      </div>`;
    EDITOR.openModal('Account', body, f => {
      const nieuw = { naam: f.elements.naam.value.trim(), email: f.elements.email.value.trim(), functie: f.elements.functie.value.trim() };
      schrijf('profiel', JSON.stringify(nieuw));
      toonProfiel();
      document.querySelector('.modal').close();
    });
  }
  function changelogModal() {
    const body = `<div class="changelog">${CHANGELOG.map(c => `
      <div class="cl-item">
        <div class="cl-versie">v${c.versie}</div>
        <div><div class="cl-titel">${c.titel}</div><ul>${c.punten.map(x => `<li>${x}</li>`).join('')}</ul></div>
      </div>`).join('')}</div>`;
    const form = EDITOR.openModal('Changelog', body, () => document.querySelector('.modal').close());
    form.querySelector('button[type=submit]').textContent = 'Sluiten';
    form.querySelectorAll('[data-sluit].btn').forEach(b => b.remove());
  }

  // ---------- THEMA ----------
  function zetThemaKnoppen() {
    const t = lees('thema', 'system');
    document.querySelectorAll('[data-thema]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.thema === t)));
  }
  function kiesThema(t) {
    schrijf('thema', t);
    const effectief = t === 'system' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : t;
    if (effectief !== document.documentElement.dataset.theme) location.reload(); // grafieken opnieuw tekenen
    else zetThemaKnoppen();
  }
  if (window.matchMedia) {
    matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
      if (lees('thema', 'system') === 'system') location.reload();
    });
  }

  // ---------- ZIJBALK-MODUS ----------
  function zetZijbalk(m) {
    document.documentElement.dataset.sidebar = m;
    schrijf('zijbalk', m);
    document.querySelectorAll('[data-sbmode]').forEach(b => b.setAttribute('aria-checked', String(b.dataset.sbmode === m)));
    // Tooltips alleen nodig als de labels nooit zichtbaar worden
    document.querySelectorAll('.sb-panel .nav-item').forEach(n => {
      const label = n.querySelector('.nav-label');
      if (m === 'dicht' && label) n.title = label.textContent; else n.removeAttribute('title');
    });
  }

  // ---------- AANSLUITEN ----------
  const accountMenu = maakMenu($('account-btn'), $('account-menu'));
  const sbMenu = maakMenu($('sb-mode-btn'), $('sb-mode-menu'));

  $('account-menu').addEventListener('click', e => {
    const b = e.target.closest('.pm-item');
    if (!b) return;
    if (b.dataset.thema) { kiesThema(b.dataset.thema); return; }
    accountMenu.sluit();
    ({
      account: accountModal,
      changelog: changelogModal,
      print: () => window.print(),
      export: EDITOR.exportDataJs,
      import: EDITOR.importeer,
      herstel: EDITOR.herstel,
    }[b.dataset.actie] || (() => {}))();
  });
  $('sb-mode-menu').addEventListener('click', e => {
    const b = e.target.closest('[data-sbmode]');
    if (!b) return;
    zetZijbalk(b.dataset.sbmode);
    sbMenu.sluit();
  });

  let tz = 'Auto';
  try { tz = 'Auto (' + Intl.DateTimeFormat().resolvedOptions().timeZone + ')'; } catch (e) { /* oud */ }
  $('am-tz').textContent = tz;

  // Paginanaam in de bovenbalk
  const zetPagina = () => {
    const actief = document.querySelector('.nav-item.active .nav-label');
    if (actief) $('tb-pagina').textContent = actief.textContent;
  };
  const vorigeNav = window.nav;
  window.nav = function (id, el) { vorigeNav(id, el); zetPagina(); };

  toonProfiel();
  zetThemaKnoppen();
  zetZijbalk(lees('zijbalk', 'hover'));
  zetPagina();
})();
