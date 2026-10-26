/* Eigene Ereignisse für Vercel Web Analytics (Pro, 25.10.2026, Marketing Pilot liest sie über die Web-Analytics-API).
   Keine Cookies, keine personenbezogenen Daten: nur Ereignisname plus Seite bzw. Ziel.
   - video_play / video_10s / video_complete: Erklärvideo (#explainer-video) auf der Startseite
   - cta_calendly: Klick auf einen Calendly-Link, calendly_view / calendly_booked: eingebetteter Kalender oder Calendly-Fenster
   - pdf_download: Klick auf eine PDF-Datei (z. B. Benchmark)
   - whatsapp_click: Klick auf den WhatsApp-Selbsttest (wa.me, /links/ und /benchmark/)
   - link_click: Knopf auf /links/ (Ziel als data-track oder Pfad) */
(function () {
  window.va = window.va || function () { (window.vaq = window.vaq || []).push(arguments); };
  function send(name, data) {
    try { window.va('event', { name: name, data: data || {} }); } catch (e) { /* Messung ist optional */ }
  }
  var page = location.pathname;

  // Erklärvideo: Start, 10 Sekunden gesehen, zu Ende gesehen (je Seitenaufruf einmal).
  function watchVideo() {
    var v = document.getElementById('explainer-video');
    if (!v) return;
    var sent = {};
    function once(name) { if (!sent[name]) { sent[name] = true; send(name, { page: page }); } }
    v.addEventListener('play', function () { once('video_play'); });
    v.addEventListener('timeupdate', function () { if (v.currentTime >= 10) once('video_10s'); });
    v.addEventListener('ended', function () { once('video_complete'); });
  }

  // Klicks auf Calendly, PDFs, WhatsApp und die Knöpfe der Link-Seite.
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (/calendly\.com\//i.test(href)) send('cta_calendly', { page: page });
    else if (/\.pdf(\?|#|$)/i.test(href)) send('pdf_download', { page: page, file: href.split('/').pop().split('?')[0].slice(0, 80) });
    else if (/^https:\/\/wa\.me\//i.test(href)) send('whatsapp_click', { page: page });
    if (page.indexOf('/links') === 0) send('link_click', { target: (a.getAttribute('data-track') || href.split('?')[0]).slice(0, 80) });
  }, true);

  // Eingebetteter Kalender oder Calendly-Fenster (calendly-popup.js): angezeigt und gebucht.
  window.addEventListener('message', function (e) {
    if (e.origin !== 'https://calendly.com' || !e.data || !e.data.event) return;
    if (e.data.event === 'calendly.event_type_viewed') send('calendly_view', { page: page });
    if (e.data.event === 'calendly.event_scheduled') send('calendly_booked', { page: page });
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchVideo, { once: true });
  else watchVideo();
})();
