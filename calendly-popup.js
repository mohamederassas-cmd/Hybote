/* Calendly als Fenster auf unserer Seite statt Sprung zu calendly.com (26.10.2026).
   Grund: Die Weiterleitung nach der Buchung („Redirect to an external site“) ist im kostenlosen Calendly-Tarif gesperrt.
   Im Fenster oder im eingebetteten Kalender meldet Calendly die Buchung per postMessage, dann leiten wir selbst auf
   /danke.html?via=calendly weiter.
   - Links mit data-cal-popup öffnen das Fenster; href bleibt die volle Calendly-Adresse samt UTM (Rückfall ohne
     JavaScript, bei Strg/Cmd-Klick und wenn widget.js nicht lädt).
   - widget.js und widget.css lädt das Skript erst beim Klick, außer die Seite bindet sie schon ein (Startseite). */
(function () {
  var WIDGET_JS = 'https://assets.calendly.com/assets/external/widget.js';
  var WIDGET_CSS = 'https://assets.calendly.com/assets/external/widget.css';
  var waiting = null;

  function lang() {
    var l = document.documentElement.lang;
    return l === 'de' || l === 'ar' ? l : 'en';
  }

  // Ruft done(true) auf, sobald window.Calendly da ist, done(false) bei Fehler oder nach 6 Sekunden.
  function loadCalendly(done) {
    if (window.Calendly) return done(true);
    if (waiting) return waiting.push(done);
    waiting = [done];
    function finish(ok) {
      var list = waiting || [];
      waiting = null;
      list.forEach(function (fn) { fn(ok && !!window.Calendly); });
    }
    if (!document.querySelector('link[href="' + WIDGET_CSS + '"]')) {
      var css = document.createElement('link');
      css.rel = 'stylesheet';
      css.href = WIDGET_CSS;
      document.head.appendChild(css);
    }
    var script = document.querySelector('script[src="' + WIDGET_JS + '"]');
    if (!script) {
      script = document.createElement('script');
      script.src = WIDGET_JS;
      script.async = true;
      document.head.appendChild(script);
    }
    script.addEventListener('load', function () { finish(true); });
    script.addEventListener('error', function () { finish(false); });
    setTimeout(function () { if (waiting) finish(!!window.Calendly); }, 6000);
  }

  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[data-cal-popup]') : null;
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    var url = a.href;
    a.setAttribute('aria-busy', 'true');
    loadCalendly(function (ok) {
      a.removeAttribute('aria-busy');
      if (ok) window.Calendly.initPopupWidget({ url: url });
      else window.location.href = url;
    });
  });

  // Gebucht (Fenster oder eingebetteter Kalender): kurz die Bestätigung von Calendly zeigen, track.js sendet
  // calendly_booked, dann auf die Dankesseite in der Sprache der Seite.
  window.addEventListener('message', function (e) {
    if (e.origin !== 'https://calendly.com' || !e.data || e.data.event !== 'calendly.event_scheduled') return;
    setTimeout(function () {
      window.location.href = '/danke.html?via=calendly' + (lang() !== 'en' ? '&lang=' + lang() : '');
    }, 1600);
  });
})();
