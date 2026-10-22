// Online-Annahme eines Angebots (22.10.2026). Daten kommen von /api/docs/* (Token aus ?d=).
(function () {
  'use strict';

  var T = {
    de: {
      secure: 'Persönlicher Link', loading: 'Ihr Angebot wird geladen …',
      errorEyebrow: 'Link nicht verfügbar', errorTitle: 'Dieser Link ist nicht mehr gültig.',
      errorBody: 'Das Angebot ist abgelaufen, wurde durch eine neue Fassung ersetzt oder der Link ist unvollständig. Schreiben Sie uns kurz, wir senden Ihnen gern einen neuen Link.',
      itemsTitle: 'Leistungen', net: 'Alle Preise netto zuzüglich etwaiger Steuern und Abgaben.',
      docsTitle: 'Ihre Unterlagen', docsHint: 'Bitte lesen Sie die Unterlagen vor der Annahme. Mit der Annahme gelten alle hier aufgeführten Dokumente als vereinbart.',
      acceptTitle: 'Angebot annehmen', name: 'Vor- und Nachname', role: 'Funktion', email: 'E-Mail für die Bestätigung',
      acceptBtn: 'Angebot verbindlich annehmen',
      acceptFine: 'Mit dem Klick schließen Sie den Vertrag elektronisch. Als Nachweis speichern wir Name, Funktion, E-Mail, Zeitpunkt, IP-Adresse und die Prüfsummen der Dokumente. Sie erhalten eine Bestätigung mit allen Unterlagen per E-Mail.',
      declineToggle: 'Angebot ablehnen', declineReason: 'Grund (optional)', declineBtn: 'Ablehnung senden', privacy: 'Datenschutz',
      eyebrow: 'Angebot {n}', forCompany: 'für {c}', validUntil: 'gültig bis {d}', from: 'von {p}',
      oneTime: 'Einmalig', monthly: 'Monatlich', usage: 'nach Nutzung', unit: { einmalig: 'einmalig', monatlich: 'monatlich', nutzung: 'nach Nutzung' },
      view: 'Ansehen', download: 'Herunterladen', kb: '{k} KB',
      confirm: 'Ich bin berechtigt, {c} zu vertreten, habe die oben aufgeführten Unterlagen gelesen und nehme das Angebot {n} verbindlich an.',
      errName: 'Bitte Vor- und Nachname und Funktion angeben.', errEmail: 'Bitte eine gültige E-Mail-Adresse angeben.', errConfirm: 'Bitte die Bestätigung ankreuzen.',
      errGeneric: 'Das hat nicht geklappt. Bitte in einer Minute erneut versuchen oder an merassas@hybote.ai schreiben.',
      sending: 'Wird übermittelt …',
      acceptedTitle: 'Vielen Dank, das Angebot ist angenommen.',
      acceptedBody: 'Angenommen am {d}{by}. Die Bestätigung mit allen Unterlagen und dem Annahmeprotokoll erhalten Sie in Kürze per E-Mail. Wir melden uns zum Start.',
      by: ' von {n}',
      declinedTitle: 'Sie haben das Angebot abgelehnt.',
      declinedBody: 'Danke für Ihre Rückmeldung. Wenn sich etwas ändert, schreiben Sie uns jederzeit an merassas@hybote.ai.',
      declineConfirm: 'Angebot wirklich ablehnen?'
    },
    en: {
      secure: 'Personal link', loading: 'Loading your proposal …',
      errorEyebrow: 'Link unavailable', errorTitle: 'This link is no longer valid.',
      errorBody: 'The proposal has expired, has been replaced by a new version, or the link is incomplete. Drop us a line and we will gladly send you a new link.',
      itemsTitle: 'Services', net: 'All prices net, plus any applicable taxes and duties.',
      docsTitle: 'Your documents', docsHint: 'Please read the documents before accepting. On acceptance, all documents listed here form part of the agreement.',
      acceptTitle: 'Accept the proposal', name: 'Full name', role: 'Position', email: 'Email for the confirmation',
      acceptBtn: 'Accept the proposal (binding)',
      acceptFine: 'By clicking, you conclude the agreement electronically. As evidence we store your name, position, email, time, IP address and the checksums of the documents. You will receive a confirmation with all documents by email.',
      declineToggle: 'Decline the proposal', declineReason: 'Reason (optional)', declineBtn: 'Send decline', privacy: 'Privacy',
      eyebrow: 'Proposal {n}', forCompany: 'for {c}', validUntil: 'valid until {d}', from: 'from {p}',
      oneTime: 'One-time', monthly: 'Monthly', usage: 'usage-based', unit: { einmalig: 'one-time', monatlich: 'monthly', nutzung: 'usage-based' },
      view: 'View', download: 'Download', kb: '{k} KB',
      confirm: 'I am authorised to represent {c}, have read the documents listed above and accept proposal {n} as binding.',
      errName: 'Please enter your full name and position.', errEmail: 'Please enter a valid email address.', errConfirm: 'Please tick the confirmation.',
      errGeneric: 'That did not work. Please try again in a minute or write to merassas@hybote.ai.',
      sending: 'Sending …',
      acceptedTitle: 'Thank you, the proposal is accepted.',
      acceptedBody: 'Accepted on {d}{by}. You will shortly receive the confirmation with all documents and the acceptance record by email. We will be in touch to get started.',
      by: ' by {n}',
      declinedTitle: 'You have declined the proposal.',
      declinedBody: 'Thank you for letting us know. If anything changes, write to us any time at merassas@hybote.ai.',
      declineConfirm: 'Really decline the proposal?'
    }
  };

  var token = new URLSearchParams(window.location.search).get('d') || '';
  var lang = (navigator.language || '').toLowerCase().indexOf('de') === 0 ? 'de' : 'en';
  var data = null;

  function t(key, vars) {
    var text = T[lang][key] || T.en[key] || key;
    Object.keys(vars || {}).forEach(function (k) { text = text.split('{' + k + '}').join(vars[k]); });
    return text;
  }
  function $(id) { return document.getElementById(id); }
  function show(id) { ['view-loading', 'view-error', 'view-offer'].forEach(function (v) { $(v).hidden = v !== id; }); }
  function applyStatic() {
    document.documentElement.lang = lang;
    document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.getAttribute('data-i18n')); });
  }
  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso.length === 10 ? iso + 'T12:00:00Z' : iso);
    return d.toLocaleDateString(lang === 'de' ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }
  function fileUrl(i, download) {
    return '/api/docs/file?d=' + encodeURIComponent(token) + '&i=' + i + (download ? '&download=1' : '');
  }

  function renderOffer() {
    document.title = 'HYBOTE – ' + t('eyebrow', { n: data.number });
    $('offer-eyebrow').textContent = t('eyebrow', { n: data.number });
    $('offer-title').textContent = data.title;
    $('offer-company').textContent = t('forCompany', { c: data.company });
    $('offer-meta').textContent = [t('from', { p: data.provider }), data.validUntil ? t('validUntil', { d: fmtDate(data.validUntil) }) : ''].filter(Boolean).join(' · ');
    if (data.intro) { $('offer-intro').textContent = data.intro; $('offer-intro').hidden = false; }

    var items = $('offer-items');
    items.textContent = '';
    data.items.forEach(function (item) {
      var li = el('li');
      var name = el('span', 'item-name', item.name);
      name.appendChild(el('span', 'item-unit', (item.qty && item.qty !== 1 ? item.qty + ' × ' : '') + (T[lang].unit[item.unit] || item.unit)));
      li.appendChild(name);
      li.appendChild(el('span', 'item-total', item.total || t('usage')));
      items.appendChild(li);
    });
    var totals = $('offer-totals');
    totals.textContent = '';
    if (data.totals.oneTime) { totals.appendChild(el('dt', null, t('oneTime'))); totals.appendChild(el('dd', null, data.totals.oneTime)); }
    if (data.totals.monthly) { totals.appendChild(el('dt', null, t('monthly'))); totals.appendChild(el('dd', null, data.totals.monthly)); }

    var docs = $('offer-docs');
    docs.textContent = '';
    data.documents.forEach(function (doc) {
      var li = el('li');
      var title = el('span', 'doc-title', doc.title);
      title.appendChild(el('span', 'doc-meta', t('kb', { k: Math.max(1, Math.round((doc.bytes || 0) / 1024)) }) + ' · SHA-256 ' + String(doc.sha256 || '').slice(0, 16) + '…'));
      li.appendChild(title);
      var view = el('a', null, t('view')); view.href = fileUrl(doc.i, false); view.target = '_blank'; view.rel = 'noopener noreferrer';
      var dl = el('a', null, t('download')); dl.href = fileUrl(doc.i, true); dl.rel = 'noopener noreferrer';
      li.appendChild(view); li.appendChild(dl);
      docs.appendChild(li);
    });

    $('confirm-text').textContent = t('confirm', { c: data.company, n: data.number });
    renderState();
    show('view-offer');
  }

  function renderState() {
    var open = data.state === 'open';
    $('accept-card').hidden = !open;
    $('done-card').hidden = open;
    $('done-card').classList.toggle('is-declined', data.state === 'declined');
    if (data.state === 'accepted') {
      $('done-title').textContent = t('acceptedTitle');
      $('done-body').textContent = t('acceptedBody', { d: fmtDate(data.acceptedAt), by: data.acceptedName ? t('by', { n: data.acceptedName }) : '' });
    } else if (data.state === 'declined') {
      $('done-title').textContent = t('declinedTitle');
      $('done-body').textContent = t('declinedBody');
    } else if (!open) {
      show('view-error');
    }
  }

  function post(path, body) {
    return fetch('/api/docs/' + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ d: token }, body)), credentials: 'omit'
    }).then(function (r) { return r.json().then(function (j) { return { status: r.status, body: j }; }); });
  }

  function fail(message, field) {
    var box = $('form-error');
    box.textContent = message;
    box.hidden = false;
    ['f-name', 'f-role', 'f-email'].forEach(function (id) { $(id).removeAttribute('aria-invalid'); });
    if (field) { $(field).setAttribute('aria-invalid', 'true'); $(field).focus(); }
  }

  $('accept-form').addEventListener('submit', function (event) {
    event.preventDefault();
    var name = $('f-name').value.trim(), role = $('f-role').value.trim(), email = $('f-email').value.trim();
    if (name.length < 3) return fail(t('errName'), 'f-name');
    if (role.length < 2) return fail(t('errName'), 'f-role');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail(t('errEmail'), 'f-email');
    if (!$('f-confirm').checked) return fail(t('errConfirm'));
    $('form-error').hidden = true;
    var btn = $('accept-btn');
    btn.disabled = true; btn.textContent = t('sending');
    post('accept', { name: name, role: role, email: email, confirm: true }).then(function (res) {
      if (res.body && res.body.state) { data.state = res.body.state; data.acceptedAt = res.body.acceptedAt; data.acceptedName = res.body.acceptedName; }
      if (res.status === 200 || (res.body && res.body.state && res.body.state !== 'open')) { renderState(); window.scrollTo({ top: 0, behavior: 'smooth' }); return; }
      fail(res.body && res.body.code === 'EMAIL_INVALID' ? t('errEmail') : res.body && res.body.code === 'NAME_ROLE_REQUIRED' ? t('errName') : t('errGeneric'));
    }).catch(function () { fail(t('errGeneric')); }).then(function () { btn.disabled = false; btn.textContent = t('acceptBtn'); });
  });

  $('decline-toggle').addEventListener('click', function () { $('decline-form').hidden = !$('decline-form').hidden; });
  $('decline-form').addEventListener('submit', function (event) {
    event.preventDefault();
    if (!window.confirm(t('declineConfirm'))) return;
    var btn = $('decline-btn');
    btn.disabled = true;
    post('decline', { reason: $('f-reason').value.trim() }).then(function (res) {
      if (res.body && res.body.state) { data.state = res.body.state; renderState(); }
    }).catch(function () { fail(t('errGeneric')); }).then(function () { btn.disabled = false; });
  });

  applyStatic();
  if (!token) { show('view-error'); return; }
  fetch('/api/docs/offer?d=' + encodeURIComponent(token), { credentials: 'omit' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (json) {
      if (!json || !json.ok) { show('view-error'); return; }
      data = json;
      lang = json.language === 'de' ? 'de' : 'en';
      applyStatic();
      renderOffer();
    })
    .catch(function () { show('view-error'); });
})();
