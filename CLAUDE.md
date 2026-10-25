# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Website von hybote.ai: statische HTML-Seiten ohne Build-Schritt plus Vercel Serverless Functions (CommonJS, Node) unter `api/`. Code-Kommentare, Commit-Messages und Doku sind auf Deutsch; das so beibehalten.

## Befehle

```bash
node serve.mjs                        # lokaler Server, Port aus PORT, sonst 3000 (.claude/launch.json: "hybote", autoPort)
node build/verify.mjs                 # statische Prüfung aller Seiten, vor jedem Deploy
node --test build/*.test.cjs          # Unit-Tests der Meta-Functions (node:test, kein Framework)
node --test build/meta-webhook.test.cjs --test-name-pattern="handshake"   # einzelner Test
```

- `node --test build/` (Verzeichnis statt Glob) schlägt fehl, immer den Glob nehmen.
- `serve.mjs` ist in `.gitignore`, also nur lokal vorhanden. Es bildet Vercels Verzeichnis-Index und Range-Requests nach, führt aber keine `api/`-Functions aus. Screenshot-Hilfe: `?dev=1` schaltet die Scroll-Reveal-Animation ab (Headless-Chrome löst den IntersectionObserver nie aus). `?nobg=1` ist seit dem Neuaufbau 10/2026 wirkungslos (kein WebGL, kein Spline mehr).
- `file://` taugt nicht zum Ansehen (absolute `/fonts/`-Pfade). 404 auf `/_vercel/insights/script.js` ist lokal normal.

## Deploy

`git push origin main` löst über die Vercel-Git-Integration das Production-Deployment aus. **Nie `vercel --prod` aus einem uncommitteten Arbeitsverzeichnis**: Am 27./28.09.2026 ging so ein kaputter Stand live, und auf dem Hobby-Plan sind nur die zwei neuesten Deployments rollback-fähig. Vorher `node build/verify.mjs` laufen lassen und das Rendering wirklich ansehen, nicht nur Konsolenwerte lesen.

`.vercelignore` schließt `/docs/` und `/build/` nur im Wurzelordner aus (ohne führenden Slash träfe es auch `api/docs`).

## Architektur

### Statische Seiten

- `index.html` ist die gesamte One-Page-Startseite (~125 KB, Neuaufbau 10/2026) mit Inline-CSS und Inline-Skripten, ohne Fremdbibliotheken außer Calendly. Abschnitte in dieser Reihenfolge (prüft `verify.mjs`): Hero `#top`, Live-Beispiel `#beispiele` (Immobilien-Chat-Demo plus Erklärvideo `#video`), Leistungen `#leistungen`, Fünf-Sterne-Standard und Gründer `#ueber-uns`, optional Kundenstimmen `#kunden`, FAQ `#faq`, Kontakt `#kontakt`. `#beispiele` ist Ziel der 301-Redirects der alten Branchenseiten.
- Alle Texte stehen im Wörterbuch `const T = { en, de, ar }` und zusätzlich als englischer Inline-Default an Elementen mit `data-i18n`. Sprache kommt nur aus `?lang=`, sonst `en`; `setLang` schreibt sie per `replaceState` zurück in die Adresse und feuert das Event `hybote:lang` (Video und Demo hören darauf). Ändert man einen Text, müssen T.en und der Inline-Default übereinstimmen; `verify.mjs` prüft das, ebenso DE/AR-Vollständigkeit und doppelte Keys (im Objektliteral gewinnt sonst stillschweigend der spätere).
- Live-Demo: Dialogtexte liegen als `demo.*`-Keys in T (damit greifen die Tonregeln), der Ablauf steht im Skript als `STEPS`/`SLOTS`. Die Demo hat eine eigene Sprachwahl, folgt aber der Seitensprache. Ohne JavaScript bleibt ein statisches EN-Transkript stehen.
- Hero-Bild: Higgsfield-Generierung (Rezeption bei Nacht), `media/hero-lobby-{1600,2560}.{webp,jpg}` und `hero-lobby-mobile.*` (Hochformat). Das Foto steht im DOM vor dem Text, wird per `order: 2` darunter gesetzt und läuft mit negativem Rand unter den Text.
- FAQ: `toggleFaq(j)` arbeitet nach DOM-Reihenfolge, Eintrag j braucht `id="faq-a-j"` und `onclick="toggleFaq(j)"`. Der FAQ-JSON-LD-Block ist handgepflegt und muss bei Textänderungen mitgezogen werden.
- Kundenstimmen `#kunden` erst einbauen, wenn echte, freigegebene Zitate vorliegen. Trustpilot erlaubt keine nachgebauten Sterne oder TrustScores (Widgets mit Bewertungstext nur im Bezahlplan); daher Zitatkarten ohne Sterne, Link auf `https://www.trustpilot.com/review/hybote.ai` und Echtheitshinweis nach § 5b Abs. 3 UWG (Key `kunden.note`) direkt daneben. `verify.mjs` prüft das.
- Kundenseiten mit eigenem `.html`/`.js`/`.css`-Trio, alle `noindex`:
  - `meta-connect.*`: WhatsApp Embedded Signup (Meta SDK v4, Coexistence), fünf Sprachen (en/de/ar/ru/fr) im `translations`-Objekt von `meta-connect.js`.
  - `connect.*`: Instagram- und E-Mail-Postfach-Anbindung (Microsoft, Google, IMAP); WhatsApp-Links leitet sie auf `meta-connect.html` um.
  - `angebot.*`: Online-Annahme von Angeboten.
  - `v/index.html`: persönliche Videolinks `/v/<code>` (Rewrite in `vercel.json`).
- Rechtstexte (`agb.html`, `datenschutz.html`, `data-deletion.html`) teilen `legal.css`. `datenschutz.html` hat drei Sprachblöcke; neue Dienste in allen drei nachtragen.
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
- CI v3 (seit 10/2026, Mercury-Prinzip): fast schwarzer Grund `--bg`, Flächen `--s1`–`--s4` statt Linien und Schatten, Cyan `--accent` nur auf der Hauptaktion, den Floating Buttons und kleinen Statuspunkten (Schrift auf Cyan ist `--bg`). Pill-Buttons, Karten mit 12px-Radius, kein Gold, keine kursiven oder farbigen Akzentwörter in Headlines, keine Eyebrow-Labels, keine `box-shadow`, kein `backdrop-filter`. Display und H2 in Cormorant Garamond, sonst Montserrat (Text 400). Arabisch über die Tokens `--serif`/`--sans` auf Cairo, ohne `!important`. Keine neuen `!important`.
- Gestaltungsprüfung zusätzlich mit der Skill `design-taste-frontend` (`lint.mjs`, `inspect.mjs` gegen `?dev=1`). Bekannter, gewollter Befund: `covered-text` durch Cookie-Hinweis und Floating Buttons (fest positioniert); ohne die beiden ist die Seite FAIL-frei.
- Die Branchenseiten (`/real-estate`, `/car-dealerships`, `/medical-practices`) wurden am 21.10.2026 entfernt und leiten per 301 auf `/#beispiele` um. Nicht ohne Rückfrage neu bauen.
- Bekannte Eigenheit: Calendly parkt ein iframe bei `left:-9999px`, deshalb `html { overflow-x: clip }` (nicht `hidden`).
