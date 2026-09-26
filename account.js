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
    { versie: '1.8', titel: 'Contactpersonen en termijnschema', punten: ['Contactpersonen per crediteur met functie, bedrijf, rol, telefoon en e-mail', 'Betaalregeling met eigen termijnen: bedrag A vóór deadline A, bedrag B vóór deadline B, met totaal', 'Betalingen worden automatisch op de termijnen afgeboekt'] },
    { versie: '1.7', titel: 'Crediteurdossiers', punten: ['Betalen-knop bij elke melding opent het dossier van de crediteur', 'Facturen per BV, eerst te betalen bedrag, betaalgegevens en vrije kas per BV', 'Betalingen registreren, betaalregeling-termijnen en documenten per dossier'] },
    { versie: '1.6', titel: 'Objecten en documenten', punten: ['Nieuwe subpagina Portefeuille → Objecten met een detailpagina per object', 'Documenten per object toevoegen (taxatierapport, koop-/leningovereenkomst, huurcontract, …)', 'Checklist van kerndocumenten per object'] },
    { versie: '1.5', titel: 'Accountmenu en nieuwe navigatie', punten: ['Accountmenu rechtsboven met profiel, thema en gegevens', 'Profielfoto, eigen logo en naam van het dashboard instellen', 'Licht, donker of systeemthema', 'Zijbalk als iconenbalk die uitklapt bij hover (instelbaar)', 'Compactere typografie'] },
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

  // ---------- PROFIEL & DASHBOARD-INSTELLINGEN ----------
  function leesJson(k) {
    try { return JSON.parse(lees(k, '{}')) || {}; } catch (e) { return {}; }
  }
  const profiel = () => leesJson('profiel');
  const dashInst = () => leesJson('dashboard_instellingen');
  const LOGO_STANDAARD = document.querySelector('.tb-logo').innerHTML;

  function initialen(naam, email) {
    const bron = (naam || '').trim() || (email || '').split('@')[0];
    if (!bron) return '?';
    const delen = bron.split(/[\s._-]+/).filter(Boolean);
    return ((delen[0] || '')[0] + (delen.length > 1 ? delen[delen.length - 1][0] : (delen[0] || '')[1] || '')).toUpperCase();
  }
  function toonProfiel() {
    const p = profiel();
    const btn = $('account-btn');
    btn.innerHTML = p.foto
      ? `<img src="${esc(p.foto)}" alt="">`
      : `<span id="avatar-init">${esc(initialen(p.naam, p.email))}</span>`;
    btn.classList.toggle('met-foto', !!p.foto);
    const kop = document.querySelector('.pm-profiel');
    kop.classList.toggle('met-foto', !!p.foto);
    let img = kop.querySelector('img');
    if (p.foto) {
      if (!img) { img = document.createElement('img'); kop.prepend(img); }
      img.src = p.foto; img.alt = '';
    } else if (img) img.remove();
    $('am-naam').textContent = p.naam || p.email || 'Mijn account';
    $('am-email').textContent = p.naam && p.email ? p.email : (p.email ? (p.functie || '') : 'Profiel nog niet ingesteld');
  }
  function toonDashboard() {
    const d = dashInst();
    if (d.naam) $('sb-naam').textContent = d.naam;
    if (d.label !== undefined && d.label !== '') $('sb-sub').textContent = d.label;
    $('sb-sub').hidden = d.label === '-';
    document.querySelector('.tb-logo').innerHTML = d.logo ? `<img src="${esc(d.logo)}" alt="">` : LOGO_STANDAARD;
    document.querySelector('.tb-logo').classList.toggle('met-afb', !!d.logo);
    document.title = (d.naam || D.meta.bedrijfsnaam) + ' — ' + (D.meta.subtitel || 'Portfolio dashboard');
  }

  // Afbeelding verkleinen tot een klein vierkant, zodat hij in de browseropslag past
  function verklein(file, maat, vorm) {
    return new Promise((resolve, reject) => {
      if (!/^image\//.test(file.type)) return reject(new Error('Kies een afbeelding (JPG, PNG, WEBP of SVG).'));
      if (file.size > 10 * 1024 * 1024) return reject(new Error('Afbeelding is groter dan 10 MB.'));
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = c.height = maat;
        const ctx = c.getContext('2d');
        const w = img.naturalWidth || maat, h = img.naturalHeight || maat;
        if (vorm === 'vullen') {           // profielfoto: bijsnijden tot vierkant
          const z = Math.min(w, h);
          ctx.drawImage(img, (w - z) / 2, (h - z) / 2, z, z, 0, 0, maat, maat);
        } else {                           // logo: passend, transparante rand
          const f = Math.min(maat / w, maat / h);
          ctx.drawImage(img, (maat - w * f) / 2, (maat - h * f) / 2, w * f, h * f);
        }
        URL.revokeObjectURL(url);
        resolve(vorm === 'vullen' ? c.toDataURL('image/jpeg', 0.86) : c.toDataURL('image/png'));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Afbeelding kon niet worden gelezen.')); };
      img.src = url;
    });
  }

  function afbKiezer(id, titel, waarde, rond) {
    return `<div class="afb-kiezer" data-afb="${id}">
      <div class="afb-voorbeeld${rond ? ' rond' : ''}">${waarde ? `<img src="${esc(waarde)}" alt="">` : '<span>Geen</span>'}</div>
      <div class="afb-acties">
        <span class="afb-titel">${titel}</span>
        <div>
          <button type="button" class="btn btn-small" data-kies>Afbeelding kiezen</button>
          <button type="button" class="btn btn-small" data-wis ${waarde ? '' : 'hidden'}>Verwijderen</button>
        </div>
        <small class="afb-fout"></small>
      </div>
      <input type="file" accept="image/*" hidden>
    </div>`;
  }

  function accountModal() {
    const p = profiel();
    const d = dashInst();
    const body = `
      <div class="f-groep">Profiel</div>
      ${afbKiezer('foto', 'Profielfoto', p.foto, true)}
      <div class="f-grid f-grid-2" style="margin-top:14px">
        <label class="f-veld"><span>Naam</span><input name="naam" value="${esc(p.naam)}" placeholder="Voor- en achternaam"></label>
        <label class="f-veld"><span>E-mailadres</span><input name="email" type="email" value="${esc(p.email)}" placeholder="naam@bedrijf.nl"></label>
        <label class="f-veld"><span>Functie</span><input name="functie" value="${esc(p.functie)}" placeholder="Bijv. directeur"></label>
      </div>
      <div class="f-groep">Dashboard</div>
      ${afbKiezer('logo', 'Logo (linksboven)', d.logo, false)}
      <div class="f-grid f-grid-2" style="margin-top:14px">
        <label class="f-veld"><span>Naam van het dashboard</span><input name="dash_naam" value="${esc(d.naam)}" placeholder="${esc(D.meta.bedrijfsnaam)}"></label>
        <label class="f-veld"><span>Label naast de naam</span><input name="dash_label" value="${esc(d.label)}" placeholder="${esc(D.meta.subtitel || 'Portfolio')}" maxlength="24"><small>Vul "-" in om geen label te tonen</small></label>
      </div>
      <p class="modal-uitleg">Profiel en dashboardinstellingen worden alleen in deze browser bewaard.</p>`;

    const nieuw = { foto: p.foto || '', logo: d.logo || '' };
    const form = EDITOR.openModal('Account', body, f => {
      const prof = { naam: f.elements.naam.value.trim(), email: f.elements.email.value.trim(), functie: f.elements.functie.value.trim(), foto: nieuw.foto };
      const dash = { naam: f.elements.dash_naam.value.trim(), label: f.elements.dash_label.value.trim(), logo: nieuw.logo };
      schrijf('profiel', JSON.stringify(prof));
      schrijf('dashboard_instellingen', JSON.stringify(dash));
      if (JSON.parse(lees('profiel', '{}')).foto !== prof.foto || JSON.parse(lees('dashboard_instellingen', '{}')).logo !== dash.logo) {
        alert('De afbeelding kon niet worden bewaard (browseropslag vol of geblokkeerd).');
      }
      // Naam/label terugzetten naar data.js als het veld leeg is
      $('sb-naam').textContent = dash.naam || D.meta.bedrijfsnaam;
      $('sb-sub').textContent = dash.label && dash.label !== '-' ? dash.label : (D.meta.subtitel || 'Portfolio dashboard');
      toonProfiel();
      toonDashboard();
      document.querySelector('.modal').close();
    });

    form.querySelectorAll('.afb-kiezer').forEach(k => {
      const soort = k.dataset.afb;
      const input = k.querySelector('input[type=file]');
      const voorbeeld = k.querySelector('.afb-voorbeeld');
      const wis = k.querySelector('[data-wis]');
      const fout = k.querySelector('.afb-fout');
      const zet = v => {
        nieuw[soort] = v;
        voorbeeld.innerHTML = v ? `<img src="${esc(v)}" alt="">` : '<span>Geen</span>';
        wis.hidden = !v;
      };
      k.querySelector('[data-kies]').onclick = () => input.click();
      wis.onclick = () => zet('');
      input.onchange = () => {
        const file = input.files[0];
        if (!file) return;
        fout.textContent = '';
        verklein(file, soort === 'foto' ? 192 : 128, soort === 'foto' ? 'vullen' : 'passend')
          .then(zet)
          .catch(err => fout.textContent = err.message)
          .finally(() => input.value = '');
      };
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
  toonDashboard();
  zetThemaKnoppen();
  zetZijbalk(lees('zijbalk', 'hover'));
  zetPagina();
})();
