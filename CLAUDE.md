# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Website von hybote.ai: statische HTML-Seiten ohne Build-Schritt plus Vercel Serverless Functions (CommonJS, Node) unter `api/`. Code-Kommentare, Commit-Messages und Doku sind auf Deutsch; das so beibehalten.

## Befehle

```bash
node serve.mjs                        # lokaler Server, Port aus PORT, sonst 3000 (.claude/launch.json: "hybote", autoPort)
node build/verify.mjs                 # statische Prüfung aller Seiten, vor jedem Deploy
node --test build/*.test.cjs          # Unit-Tests der Meta-Functions (node:test, kein Framework)
node --test build/meta-webhook.test.cjs --test-name-pattern="handshake"   # einzelner Test
node build/film-frames.mjs [kapitel]  # Scroll-Film aus dem Rohmaterial bauen (ffmpeg + cwebp, brew install ffmpeg webp)
```

- `node --test build/` (Verzeichnis statt Glob) schlägt fehl, immer den Glob nehmen.
- `serve.mjs` ist in `.gitignore`, also nur lokal vorhanden. Es bildet Vercels Verzeichnis-Index und Range-Requests nach, führt aber keine `api/`-Functions aus. Screenshot-Hilfe: `?dev=1` schaltet die Einblendungen ab (Reveal, Hero-Einstieg, Rollladen, Scroll-Hinweis; Headless-Chrome löst den IntersectionObserver nie aus). `?nobg=1` ist seit dem Neuaufbau 10/2026 wirkungslos (kein WebGL, kein Spline mehr).
- `file://` taugt nicht zum Ansehen (absolute `/fonts/`-Pfade). 404 auf `/_vercel/insights/script.js` ist lokal normal.
- Den Film nur in einer sichtbaren Seite prüfen: in einem verborgenen Tab laufen weder requestAnimationFrame noch ResizeObserver, der Canvas bleibt leer. Headless geht es mit Playwright (Seite ist dort sichtbar); `?film=hud` zeigt fps, Verzug und Ladestand.

## Deploy

`git push origin main` löst über die Vercel-Git-Integration das Production-Deployment aus. **Nie `vercel --prod` aus einem uncommitteten Arbeitsverzeichnis**: Am 27./28.09.2026 ging so ein kaputter Stand live, und auf dem Hobby-Plan sind nur die zwei neuesten Deployments rollback-fähig. Vorher `node build/verify.mjs` laufen lassen und das Rendering wirklich ansehen, nicht nur Konsolenwerte lesen.

`.vercelignore` schließt `/docs/` und `/build/` nur im Wurzelordner aus (ohne führenden Slash träfe es auch `api/docs`).

## Architektur

### Statische Seiten

- `index.html` ist die gesamte One-Page-Startseite (~200 KB, Neuaufbau 10/2026, Neugestaltung „Der Concierge“ 26.10.2026) mit Inline-CSS und Inline-Skripten. Fremdbibliotheken: Calendly sowie GSAP 3.15 + ScrollTrigger und Lenis 1.3, alle drei selbst gehostet unter `vendor/` (kein CDN). Abschnitte in dieser Reihenfolge (prüft `verify.mjs` für die mit id): Film-Szene mit Hero `#top`, Benchmark-Band (ohne id, direkt nach dem Film: Problem zuerst, Link auf `/benchmark/`), Live-Beispiel `#beispiele` (Immobilien-Chat-Demo im Glas-Handy plus Erklärvideo `#video`), Leistungen `#leistungen` (Bento aus vier Glaskarten mit kleiner animierter Oberfläche: Posteingang, Ablauf, Dokumentprüfung, Kundenprojekte `media/work-*.webp` im Browserrahmen), Fünf-Sterne-Standard und Gründer `#ueber-uns`, optional Kundenstimmen `#kunden`, FAQ `#faq`, Kontakt `#kontakt` (Hintergrund: Standbild `dawn`). `#beispiele` ist Ziel der 301-Redirects der alten Branchenseiten.
- Alle Texte stehen im Wörterbuch `const T = { en, de, ar }` und zusätzlich als englischer Inline-Default an Elementen mit `data-i18n`. Sprache kommt nur aus `?lang=`, sonst `en`; `setLang` schreibt sie per `replaceState` zurück in die Adresse und feuert das Event `hybote:lang` (Video und Demo hören darauf). Ändert man einen Text, müssen T.en und der Inline-Default übereinstimmen; `verify.mjs` prüft das, ebenso DE/AR-Vollständigkeit und doppelte Keys (im Objektliteral gewinnt sonst stillschweigend der spätere).
- Live-Demo: Dialogtexte liegen als `demo.*`-Keys in T (damit greifen die Tonregeln), der Ablauf steht im Skript als `STEPS`/`SLOTS`. Die Demo hat eine eigene Sprachwahl, folgt aber der Seitensprache. Ohne JavaScript bleibt ein statisches EN-Transkript stehen.
- Scroll-Film (nach dem Vorbild Bugal Immobilien): der HYBOTE-Concierge (der Roboter aus dem Erklärvideo, fotorealistisch: weißer Kopf, Navy-Visier, Headset, goldene Fliege, Smoking) in einer lebensgroßen Fünf-Sterne-Lobby, bildfüllend; fünf Kapitel von der Anfrage um 23:47 bis zum Morgengrauen (`light`, `turn`, `open`, `book`, `bell`) plus Hero-Loop. Der Concierge steht in allen Bildern rechts (Kopf bei ~82 % der Breite), alles Lesbare steht links. Higgsfield-Clips (Kling 3.0 pro, je 5 s, Start- und End-Bild aus nano_banana_pro-Schlüsselbildern, die alle auf `k0-night` aufbauen) liegen mit Job-IDs in `assets-src/film/` (`shots.json`; altes Rezeptions-Material in `_rezeption/`, Probebilder in `assets-src/concierge/`; nicht im Repo, nicht auf Vercel). `build/film-frames.mjs` macht daraus WebP-Bildfolgen in `film/<kapitel>/<desktop|phone>/` (15 fps, Desktop 1920 breit, Handy = 3:4-Ausschnitt um `cx` 0,78, Schwarz auf `#070b16` gegradet), Loops und Standbilder, schreibt `film-manifest.js` (Handy-Einträge mit `cx`) und zieht die `?v=`-Hashes in `index.html` nach. `film/` enthält nur Medien und ist ein Jahr im Cache (`vercel.json`), neue Dateien kommen über den Hash.
- `film.js` ist die Engine (Port aus Bugal: Worker-Dekodierung, progressives Laden, Überblendung, sticky Bühne, eine gescrubbte Timeline, am Desktop Lenis, am Touch-Gerät gedämpfte Filmuhr). Ohne Film (reduzierte Bewegung, Datensparmodus, `?film=off`, keine Bibliotheken) bleibt `.film-scene` ohne `.is-live` ein normaler Abschnitt mit Standbildern. Das Bild füllt die Bühne immer (`cover`); `ZOOM` gibt je Kapitel nur eine leichte Fahrt dazu, Ende und Anfang zweier Kapitel müssen denselben Wert haben. Impuls und Kanal-Chips hängen per `data-anchor data-shot data-x data-y` an Punkten im 16:9-Endbild ihres Kapitels; `data-side="before"` stellt die Beschriftung vor den Punkt (Linie zeigt auf den Concierge). Auf Arabisch spiegelt CSS das Filmbild (der Concierge steht dann links), `film.js` spiegelt Anker, Chip-Seite und Schlussfenster mit. Am Handy stehen Kapiteltext und Karten unten (der Kopf bleibt oben frei), die Kanal-Chips als Zeile. Startzustände animierter Elemente stehen im CSS (`.is-live …`), weil ScrollTrigger Inline-Werte beim Refresh zurücksetzt.
- Calendly: Karte ohne `backdrop-filter` und ohne overflow-/Radius-Zuschnitt um das iframe; Buchungsbereich max. 1000px breit, ab 900px (Kalender und Uhrzeiten nebeneinander) feste Höhe 700px statt `resize`. Hintergrund: Mohameds Chrome zeigte Geisterbilder (doppelte Ziffern) beim Datums- und Monatswechsel; headless und im App-Browser nicht nachstellbar. Eigene Farben im Embed ignoriert Calendly im kostenlosen Plan.
- Überblendung im Film: zwischen Nachbarbildern nur in der Mitte der Strecke (`pair()` in `film.js`), sonst wirkt langsames Scrollen unscharf.
- Floating Buttons sind aus, solange der Film läuft oder der Footer zu sehen ist (`html.fabs-off`); die Höhe des Cookie-Hinweises steht als `--cookie-h` und hält Footer und Hero-Knopf frei.
- FAQ: `toggleFaq(j)` arbeitet nach DOM-Reihenfolge, Eintrag j braucht `id="faq-a-j"` und `onclick="toggleFaq(j)"`. Der FAQ-JSON-LD-Block ist handgepflegt und muss bei Textänderungen mitgezogen werden.
- Kundenstimmen `#kunden` (seit 26.10.2026): nur echte, vom Kunden schriftlich freigegebene Stimmen (Tim Sprachendienste, Finanztime, Bucan Automobile), DE im Originalwortlaut, EN/AR übersetzt mit Hinweis `kunden.tr` (auf Deutsch ausgeblendet), unterschrieben mit Logo (`media/kunden/*.webp`, weiße Fassung, 120 px hoch, angezeigt 40 px), Firma + Branche, Link auf die Firmen-Webseite (`.voice-site`, neuer Tab, `rel="noopener"`; von den Kunden erlaubt) und „Projekt · Monat“. Der Einleitungssatz `kunden.sub` sagt „ein paar unserer Kundenstimmen“, damit es nicht nach nur drei Kunden klingt. Zitatkarten ohne Sterne oder TrustScore (Trustpilot erlaubt keine nachgebauten; Widgets mit Bewertungstext nur im Bezahlplan) und Echtheitshinweis nach § 5b Abs. 3 UWG (Key `kunden.note`) direkt darunter. Trustpilot erst erwähnen und `https://www.trustpilot.com/review/hybote.ai` verlinken, wenn die Bewertungen dort sichtbar sind; dann je Karte „Auf Trustpilot lesen“ und den Echtheitshinweis ergänzen. Kein `Review`/`AggregateRating`-JSON-LD (Google wertet eigene Bewertungen auf der eigenen Seite nicht). `verify.mjs` prüft Hinweis und Link-Pflicht.
- Kundenseiten mit eigenem `.html`/`.js`/`.css`-Trio, alle `noindex`:
  - `meta-connect.*`: WhatsApp Embedded Signup (Meta SDK v4, Coexistence), fünf Sprachen (en/de/ar/ru/fr) im `translations`-Objekt von `meta-connect.js`.
  - `connect.*`: Instagram- und E-Mail-Postfach-Anbindung (Microsoft, Google, IMAP); WhatsApp-Links leitet sie auf `meta-connect.html` um.
  - `angebot.*`: Online-Annahme von Angeboten.
  - `v/index.html`: persönliche Videolinks `/v/<code>` (Rewrite in `vercel.json`).
- Rechtstexte (`agb.html`, `datenschutz.html`, `data-deletion.html`) teilen `legal.css` (seit 26.10.2026 wie die Startseite: schwebende Glasleiste mit weißer Wortmarke, Raumlicht `.ambient`, Text in einer Glaskarte). `datenschutz.html` hat drei Sprachblöcke; neue Dienste in allen drei nachtragen.
- `danke.html` (noindex) hat zwei Fassungen: `?via=calendly` nach einer Buchung (die Startseite leitet 1,6 s nach `calendly.event_scheduled` dorthin, damit `track.js` `calendly_booked` noch sendet), sonst nach dem Kontaktformular. Hintergrund `media/danke-dawn*.webp` (eigene Kopie, nicht an den Film-Hash gekoppelt). Der direkte Calendly-Link kommt nur dorthin, wenn im Termintyp „Free Intro Call“ die Bestätigungsseite auf Weiterleitung nach `https://hybote.ai/danke.html?via=calendly` steht (Calendly-Einstellung, nicht per API).
- Schriften liegen selbst gehostet in `fonts/` (`fonts.css`). Die `*-latin-ext.woff2`-Dateien enthalten **kein** Basis-Alphabet; wer sie als Latin einbindet, lässt die Seite auf Times/Arial fallen, obwohl `document.fonts` "loaded" meldet.

### Serverless Functions (`api/`)

Das Vercel-Hobby-Limit liegt bei 12 Functions je Deployment. Deshalb bündeln Catch-all-Router mehrere Pfade, und Dateien mit führendem Unterstrich sind Helfer, keine Endpunkte:

- `api/connect/[...path].js` verteilt per `routes`-Map an `api/connect/_handlers/*` (OAuth-Start/Callback für Microsoft und Google, IMAP-Prüfung, Status, Video-Aufrufe). Neue Pfade dort eintragen, keine neue Function anlegen.
- `api/docs/[...path].js`: Angebotsannahme (`offer`, `file`, `accept`, `decline`). PDFs aus einem privaten Vercel-Blob-Store, Status in der n8n-Tabelle `ops_documents`.
- `api/meta/*`: `complete.js` (Code-Austausch, n8n-Credential, Mandantenzeile; der Live-Onboarding-Pfad), `webhook.js` (Eingangstor für alle Meta-Callbacks), `invite.js`, `session.js`; `_invite.js` prüft die Einladungs-Tokens.

Zusammenspiel mit anderen Systemen, ohne direkte Netzwerkverbindung zwischen ihnen:

- Einladungs- und Annahme-Links sind signierte Tokens `base64url(JSON).base64url(HMAC-SHA256)`. Der Sales Pilot (`server/src/services/ops/invite.ts`) bzw. der Control Tower signiert, Vercel prüft mit demselben Geheimnis (`META_INVITE_SECRET`, `CONNECT_STATE_SECRET`, `DOC_ACCEPT_SECRET`). Das Format muss auf beiden Seiten identisch bleiben.
- Persistenz ist ausschließlich die n8n Public API (`flow.hybote.ai`): Kunden-Tokens landen nur als verschlüsselte n8n-Credentials, die Data Tables (`wa_tenants`, `mail_tenants`, `ops_documents`, Logs) tragen nur Zuordnung und Status.
- `webhook.js` prüft die Meta-Signatur auf den **Rohbytes** des Streams und reicht sie unverändert an einen header-authentifizierten n8n-Webhook weiter. Nie `request.body` verwenden oder die Nutzlast neu serialisieren, sonst scheitert die Signaturprüfung sporadisch. n8n kann das selbst nicht prüfen (Code-Nodes haben dort keinen Zugriff auf env und `crypto`).
- Helfer sind bewusst zwischen `complete.js`, `webhook.js` und `api/connect/_n8n.js` dupliziert statt ausgelagert: `verify.mjs` nagelt Inhalte von `complete.js` per String-Match fest. `complete.js` nur anfassen, wenn es wirklich nötig ist, und danach `verify.mjs` laufen lassen.

Benötigte Umgebungsvariablen und Kennungen: `docs/meta-tech-provider-setup.md` (Meta/WhatsApp), `docs/kunden-postfach-anbindung.md` (Postfach-Anbindung), Kopfkommentar von `api/docs/[...path].js` (Angebote).

### `build/verify.mjs`

Kein Linter, sondern eine Sammlung von String- und Regex-Prüfungen, die Geschäftsregeln absichern: Calendly-Buchungsblock, i18n-Vollständigkeit, CI-Textregeln, Rechtstexte, Sitemap und Redirects der entfernten Branchenseiten, Meta-Signup und Webhook. Schlägt eine Prüfung an, ist meist die Prüfung die Spezifikation; nicht einfach die Prüfung lockern, ohne nachzufragen.

## Inhalts- und Gestaltungsregeln

Diese Regeln setzt `verify.mjs` großteils durch:

- Ton: keine Gedankenstriche (em dash), keine Ausrufezeichen, keine Emojis, kein "Audit"/"Assessment" als Angebot (der Anker heißt `#beispiele`). CTA ist der kostenlose "Free intro call" über Calendly.
- Positionierung: KI-Agenten auf Fünf-Sterne-Service-Niveau sind der Kern; Automationen, maßgeschneiderte KI-Lösungen und Software-Entwicklung ergänzen sie. Beratung ist keine eigene Leistung mehr. Projektbelege mit Kundennamen (Tim Sprachendienste, Bucan Automobile, Finanztime) sind vom Owner freigegeben. Keine Preise auf der Seite. Positionierungs- oder größere Textwechsel vorher mit dem Owner abstimmen.
- Meta-Status: nur beschreibend ("WhatsApp Business Platform"). Verboten sind "Meta-Partner", "offizieller Partner", "Meta Verified", "Powered by Meta" sowie Meta- oder WhatsApp-Logos. Die Aussage steht an vier Stellen (`hero.trust1`, `footer.provider`, FAQ-Key `faq.q8`/`faq.a8` plus JSON-LD, Trust-Chip auf `meta-connect.html`).
- Gründertext: nur "über ein Jahrzehnt in der gehobenen und namhaften Hotellerie", keine Jahreszahl, nicht "Fünf-Sterne-Hotellerie".
- Glas (Owner-Wunsch 26.10.2026, wie auf der früheren Live-Seite): Tokens `--glass*` in `:root`, Klasse `.glass` (Fläche + helle Kante oben + Unschärfe, Rückfall ohne `backdrop-filter` auf `--s1`), `.btn--glass` als Zweit-Aktion, Raumlicht `.ambient` hinter allem (Grund liegt deshalb auf `html`, `body` ist transparent). Über dem laufenden Film nur 8px Unschärfe (`--film-blur`), sonst kostet jedes Filmbild zu viel; mit `?film=hud` prüfen. Die Skill `design-taste-frontend` meldet Glas, Eyebrows, Nummerierung 01–05, Verläufe, Schatten und Montserrat als FAIL: das ist gewollt, nicht „reparieren“.
- CI v3 (seit 10/2026): fast schwarzer Grund `--bg`, Flächen `--s1`–`--s4`, Cyan `--accent` steht für die Antwort (Hauptaktion, Floating Buttons, Impuls im Film, Statuspunkte; Schrift auf Cyan ist `--bg`). Warmes Lampenlicht kommt nur aus dem Film, nie als Schriftfarbe. Pill-Buttons, Karten mit 12px-Radius, kein Gold als CSS-Farbe, keine kursiven oder farbigen Akzentwörter in Headlines. Die reinen Geschmacksregeln (keine Schatten, keine Verläufe, keine Linien) hat der Owner am 25.10.2026 aufgehoben: Scrims über dem Film und Linien in Listen sind erlaubt. Display und H2 in Cormorant Garamond, sonst Montserrat (Text 400). Arabisch über die Tokens `--serif`/`--sans` auf Cairo, ohne `!important`. Keine neuen `!important`.
- Gestaltungsprüfung zusätzlich mit der Skill `design-taste-frontend` (`lint.mjs`, `inspect.mjs` gegen `?dev=1&film=off`). Bekannte, gewollte Befunde: die Glas-Stilregeln (siehe oben), `covered-text` durch feste Navigation, Cookie-Hinweis und Floating Buttons, `late-title` (der Hero-Text hat `pointer-events: none`, der Prüfer sieht den Canvas darunter). Echte Funde sind Überbreite, Text unter 13px und Kontrast.
- Film-Leistung headless nur mit Grafikkarte messen: Playwright `chromium.launch({ channel: 'chromium', args: ['--use-angle=metal', '--ignore-gpu-blocklist'] })`; die Headless-Shell rechnet ohne GPU und liefert bei 2560px zu niedrige fps.
- Die Branchenseiten (`/real-estate`, `/car-dealerships`, `/medical-practices`) wurden am 21.10.2026 entfernt und leiten per 301 auf `/#beispiele` um. Nicht ohne Rückfrage neu bauen.
- Bekannte Eigenheit: Calendly parkt ein iframe bei `left:-9999px`, deshalb `html { overflow-x: clip }` (nicht `hidden`).
