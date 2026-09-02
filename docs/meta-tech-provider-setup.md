# HYBOTE Meta Tech Provider – Betriebsnotizen

## Öffentliche Meta-Kennungen

- Meta App ID: `1580264870470342`
- Embedded Signup Configuration ID: `1048835977913160` (v3; wird durch die v4-Konfiguration ersetzt, siehe unten)
- Graph API: `v26.0`
- Embedded Signup: **v4** (konfigurationsgetrieben, kein `sessionInfoVersion` mehr im Code)
- Coexistence-Feature-Typ: `whatsapp_business_app_onboarding` (Konstante `COEXISTENCE_FEATURE_TYPE` in `meta-connect.js`)
- Kundenseite: `https://hybote.ai/meta-connect.html` – Sprachen en, de, ar, ru, fr

Diese Kennungen sind für den Browser bestimmt und keine Geheimnisse.

## Erforderliche Vercel-Umgebungsvariablen

- `META_APP_ID=1580264870470342`
- `META_APP_SECRET=<Meta App Secret>`
- `META_GRAPH_VERSION=v26.0`
- `META_ALLOWED_ORIGINS=https://hybote.ai,https://www.hybote.ai`
- `N8N_BASE_URL=https://flow.hybote.ai`
- `N8N_API_KEY=<eingeschränkter n8n Public API Key>`
- `N8N_PROJECT_ID=jsIyw3Baf0VCkxWB`
- `N8N_TENANT_TABLE_ID=VhpHGERnVgpRWRbs`
- `N8N_WHATSAPP_CREDENTIAL_TYPE=whatsAppApi`
- `N8N_ONBOARDING_LOG_TABLE_ID=EgTH6F84tJ82WNhc`
- `META_PIN_SECRET=<64 Hex-Zeichen>` – leitet die Registrierungs-PIN je Nummer ab
- `META_INVITE_SECRET=<64 Hex-Zeichen>` – signiert die Einladungslinks; identisch in der Root-`.env` des Sales Pilot (der signiert, Vercel prüft)
- `META_WEBHOOK_VERIFY_TOKEN=<64 Hex-Zeichen>` – Vergleichswert für Metas `hub.verify_token`
- `N8N_WHATSAPP_WEBHOOK_URL=<Production-URL des n8n-Webhook-Node>` – vollständige URL, **nicht** aus `N8N_BASE_URL` zusammengebaut
- `N8N_WEBHOOK_AUTH_HEADER=X-Hybote-Webhook-Token` – Headername der n8n-Header-Auth-Credential
- `N8N_WEBHOOK_AUTH_VALUE=<64 Hex-Zeichen>` – Geheimwert dieses Headers
- `N8N_WEBHOOK_LOG_TABLE_ID=<Data-Table-ID>` – optional, protokolliert nur Webhook-Fehler

`META_APP_SECRET`, `N8N_API_KEY`, `META_PIN_SECRET`, `META_INVITE_SECRET`, `META_WEBHOOK_VERIFY_TOKEN` und `N8N_WEBHOOK_AUTH_VALUE` dürfen niemals in HTML, Browser-JavaScript, Git, Screenshots oder Chat-Nachrichten gespeichert werden.

## Zugang zur Verbindungsseite

Die Seite ist ohne signierten Einladungslink nicht benutzbar. Ohne gültiges Token zeigt sie
einen Hinweis statt des Formulars und lädt das Meta-SDK gar nicht erst.

Firma, E-Mail und Kundennummer stammen ausschließlich aus dem Token, nicht aus dem Formular –
die Felder sind reine Anzeige. Der Link läuft standardmäßig nach 14 Tagen ab; der Sales Pilot erzeugt
mit einem Klick einen neuen (Operations Pilot → Kunde → Onboarding).

Das Token trägt zusätzlich `tenant_key` (Schlüssel der Zeile in `wa_tenants`, vom Sales Pilot vergeben)
und `lang` (en|de|ar|ru|fr). Die Seite wählt ihre Sprache in dieser Reihenfolge: `?lang` (Sprachpille)
→ `lang` aus dem Token → Browsersprache → Englisch. Das Meta-SDK wird erst danach in dieser Sprache
geladen; der Meta-Dialog selbst folgt der Facebook-Sprache des Kunden. Firma und E-Mail werden über
`extras.setup.business` in den Dialog vorbefüllt – mehr Branding erlaubt Meta nicht.

Signatur: `base64url(JSON) + "." + base64url(HMAC-SHA256)`, identisch zu `signSessionToken()` im
Sales Pilot. Der Sales Pilot signiert, Vercel prüft. Bewusst ohne Netzwerkaufruf zwischen beiden
Systemen: zum Signup-Zeitpunkt darf nichts von der Erreichbarkeit des Macs abhängen.

`api/meta/_invite.js` beginnt mit einem Unterstrich und wird von Vercel deshalb nicht als eigene
Serverless-Function veröffentlicht, sondern nur als Modul eingebunden.

## Registrierung der Telefonnummer

Ohne `POST /{phone_number_id}/register` geht bei einer klassisch migrierten Nummer keine einzige
Nachricht raus (Fehler 133010). Coexistence-Nummern kommen dagegen bereits verbunden aus dem
Meta-Dialog und dürfen nicht erneut registriert werden. Der Endpunkt entscheidet deshalb anhand
von `status`: nur wenn die Nummer nicht `CONNECTED` ist, wird registriert.

Die 6-stellige PIN wird deterministisch aus `HMAC-SHA256(META_PIN_SECRET, phone_number_id)`
abgeleitet. Sie steht damit in keiner Tabelle und ist trotzdem jederzeit reproduzierbar, wenn
eine Nummer neu registriert werden muss. **Geht `META_PIN_SECRET` verloren, lässt sich keine
bestehende Nummer mehr neu registrieren** – das Geheimnis gehört in den Passwortmanager.

Behandelte Fehlerfälle: `133005` (Kunde hat eigene 2FA-PIN gesetzt) → `PIN_CONFLICT`,
`133016` (10 Registrierungen je Nummer in 72 Stunden) → `REGISTRATION_RATE_LIMITED`,
`133006` (Nummer nicht verifiziert) → `NUMBER_NOT_VERIFIED`.

## Coexistence

Standardweg für Neukunden. Der Kunde behält Nummer, WhatsApp Business App und Chatverlauf.

Voraussetzungen beim Kunden: App ab Version 2.24.17, Nummer seit mindestens 7 Tagen in Benutzung,
Handy mit Kamera für den QR-Code.

Nach erfolgreichem Signup stößt der Endpunkt zwei Aufrufe auf `POST /{phone_number_id}/smb_app_data`
an: `sync_type: smb_app_state_sync` (Kontakte) und `sync_type: history` (Verlauf, 180 Tage in drei
Phasen). **Das Zeitfenster beträgt 24 Stunden ab Abschluss des Signups** – danach müsste der Kunde
das gesamte Onboarding wiederholen. Deshalb passiert das im selben Request und nicht in einem
späteren Cron.

Die Aufrufe sind bewusst nicht fatal: Schlägt der Kontakte-Sync fehl, ist die Nummer keine
Coexistence-Nummer und der Verlaufs-Sync wird gar nicht erst versucht. Beide Ergebnisse landen im
Audit-Log (`state:ok;history:ok`).

Der Coexistence-Dialog meldet im Abschluss-Event (`FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING`) nur die
WABA, keine Nummer. `complete.js` liest die Nummer dann aus `GET /{waba_id}/phone_numbers`: bei genau
einer Nummer diese, sonst die mit `is_on_biz_app`. Gibt es keine eindeutige Nummer, antwortet der
Endpunkt `409 PHONE_NUMBER_UNRESOLVED`.

Die Coexistence-Webhook-Felder (`smb_message_echoes`, `smb_app_state_sync`, `history`) werden per
Terminal gesetzt: `node scripts/meta/subscriptions.mjs set` im Sales Pilot (ein POST ersetzt die
komplette Feldliste, das Skript zeigt vorher den Diff).

Grenzen, die vor jeder Kundenzusage gelten: keine Marketing-Templates auf Coexistence-Nummern,
Durchsatz 20 Nachrichten/Sekunde, Trennung nur manuell durch den Kunden über die App.
**Ob Utility-Templates (Terminerinnerungen) erlaubt sind, ist noch nicht verifiziert** – vor der
ersten Zusage an der eigenen Nummer prüfen.

## Eingeschränkter n8n-API-Schlüssel

Der API-Schlüssel ist ausschließlich für das Embedded Signup bestimmt und erhält nur:

- `credential:create`
- `credential:update`
- `credential:list`
- `dataTableRow:upsert`

Der Produktionsschlüssel `HYBOTE Embedded Signup` wurde am 30. August 2026 mit einer Laufzeit von 90 Tagen erstellt und muss vorsorglich spätestens am 27. November 2026 gemeinsam in n8n und Vercel erneuert werden.

Vercel legt den Kundentoken direkt als verschlüsseltes n8n-Credential vom Typ `whatsAppApi` ab. Der Token wird nicht in einer Workflow-Ausführung und nicht in der Datentabelle gespeichert. Das Register `wa_tenants` enthält ausschließlich Kundenzuordnung, Meta-IDs, Credential-ID, Workflow-ID, Status und Ablaufdatum.

Bei einer erneuten Autorisierung derselben Telefonnummer aktualisiert der Endpunkt das vorhandene Credential mit dem neuen Token. Dadurch entstehen keine parallelen veralteten Zugangsdaten.

Die neun Produktionsvariablen wurden am 30. August 2026 in Vercel gespeichert und durch eine erfolgreiche Produktions-Neubereitstellung aktiviert. Der Sicherheitscheck ergab `200` für die Sitzungserstellung und erwartungsgemäß `400 INVALID_ONBOARDING_DATA` für eine leere Abschlussanfrage. Damit ist bestätigt, dass die Serverfunktion vollständig konfiguriert ist, ohne ein Kundenkonto zu verändern.

## Callback-Empfang: `api/meta/webhook.js`

Die Callback-URL ist `https://hybote.ai/api/meta/webhook`. Vercel prüft die Signatur und reicht die
geprüften Bytes an einen header-authentifizierten n8n-Webhook weiter.

**Warum nicht direkt in n8n:** Ein Code-Node auf flow.hybote.ai darf weder Umgebungsvariablen lesen
(`access to env vars denied`) noch `require('crypto')` benutzen (`Module 'crypto' is disallowed`) –
beides an einer Wegwerf-Probe auf der Produktivinstanz belegt. Eine Signaturprüfung dort wäre nur
möglich, wenn man die Sandbox für **alle** Code-Nodes global aufweicht. Nebeneffekt der
Vercel-Lösung: kein `whatsAppTrigger` mehr, und damit auch nicht mehr die Falle, dass ein zweiter
Trigger die Callback-Registrierung still überschreibt.

### Der Rohbody ist der kritische Punkt

`X-Hub-Signature-256` ist ein HMAC über die **Bytes**, die Meta gesendet hat. Eine neu serialisierte
Nutzlast (`JSON.stringify(request.body)`) reproduziert diese Bytes nicht zuverlässig –
Schlüsselreihenfolge, Unicode-Escapes und Whitespace weichen ab, und die Prüfung würde sporadisch
scheitern. Vercels Node-Helper puffert den Body eager und spielt ihn danach über einen PassThrough
wieder ab, aber ausschließlich über die gepatchten `request.on('data')` und `request.on('end')`:

| Zugriffsart | Funktioniert |
|---|---|
| `request.on('data'/'end')` | ja |
| `for await (… of request)` | nein – hängt am bereits beendeten Originalstream |
| `request.once(…)` / `request.pipe(…)` | nein – von `restoreBody` nicht gepatcht |

Der Endpunkt liest deshalb ausschließlich über `.on()` und fasst `request.body` nie an. Bleibt der
Stream stumm, antwortet er nach drei Sekunden mit `503 RAW_BODY_UNAVAILABLE` – er scheitert lieber
laut, als still eine falsche Signaturprüfung zu machen.

> **`NODEJS_HELPERS=0` ist keine Lösung, sondern eine Falle.** Die Variable gilt projektweit und
> würde `request.body` in `complete.js` auf `undefined` setzen: jedes Onboarding bräche mit
> `INVITE_INVALID` ab. Niemals setzen.

### Antwortverhalten gegenüber Meta

Erfolg ⇒ `200`. Fehlgeschlagene Weiterleitung an n8n ⇒ `502`, damit Metas At-least-once-Retry als
Warteschlange dient; eingehende Nachrichten sind nicht reproduzierbar, Meta ist die einzige Quelle.
Fehlkonfiguration ⇒ `503`. Ungültige oder fehlende Signatur ⇒ `401` **ohne** Weiterleitung.

Ein „fire and forget" wäre auf Vercel unzuverlässig – die Ausführung endet mit der Antwort, ein
nicht awaitetes `fetch` wird abgeschnitten. Das Risiko, dass Meta die Subscription nach anhaltenden
Fehlern deaktiviert, wird bewusst getragen: ein lautes Versagen mit Alert im App Dashboard ist einem
stillen Nachrichtenverlust vorzuziehen. **Der einzige echte Selbstschuss wäre ein falsches
`META_APP_SECRET`** – dann bekäme jede Zustellung `401`. Deshalb der curl-Test unten, bevor die
Callback-URL umgestellt wird. Metas Retries erzeugen Duplikate; der Gateway-Workflow dedupliziert
über `messages[].id` bzw. den mitgesendeten `X-Hybote-Delivery`-Hash.

### Vor der Umstellung der Callback-URL prüfen

```
node build/verify.mjs
node --test build/meta-complete.test.cjs
node --test build/meta-webhook.test.cjs
```

Danach am Deployment, in dieser Reihenfolge:

1. `vercel env ls` – `NODEJS_HELPERS` darf **nicht** gesetzt sein.
2. Handshake: `curl -i "https://hybote.ai/api/meta/webhook?hub.mode=subscribe&hub.verify_token=$TOKEN&hub.challenge=1234567890"`
   ⇒ `200`, `Content-Type: text/plain`, Body exakt `1234567890`. Mit falschem Token ⇒ `403`.
3. **Rohbody-Test** mit absichtlich krummem JSON (unregelmäßiger Whitespace, `\u00fc`-Escape):
   signieren mit `openssl dgst -sha256 -hmac "$META_APP_SECRET"`, senden mit `--data-binary`.
   `200` oder `502` ⇒ Signatur akzeptiert, Weg frei. `401 SIGNATURE_INVALID` oder
   `503 RAW_BODY_UNAVAILABLE` ⇒ auf die Web-Handler-Signatur (`module.exports = { GET, POST }`)
   ausweichen, dort läuft `addHelpers` nicht und `await request.text()` liefert die exakten Bytes.
4. Ein manipuliertes letztes Signaturzeichen muss `401` ergeben.
5. Erst danach die Callback-URL und den Verify-Token im Meta App Dashboard eintragen.

Der Test aus Schritt 3 gehört nach jedem größeren Wechsel der Vercel-Node-Runtime wiederholt:
`restoreBody` ist ein internes Implementierungsdetail, kein zugesichertes API.

## Mandantenmodell

Jeder Kunde behält sein eigenes Meta Business Portfolio, seine WABA und seine Telefonnummer.
Auf der gemeinsamen n8n-Instanz bekommt jeder Kunde **einen Workflow-Klon der Vorlage, ein eigenes
Tabellenpaar (Verlauf + Puffer) und eine eigene Konfigurationszeile** – Trennung durch
Systemgrenze, nicht durch Filterdisziplin. Details und die sechs Stellen einer Bereitstellung:
`docs/kundenagent-vorlage.md`.

Verteilung seit Stufe C (02.09.2026): `WhatsApp Gateway v2 (HYBOTE)` dedupliziert, bestimmt die
Ereignisart (`message`, `echo`, `history_import`, `status`, `account`), sucht den Mandanten in
`wa_tenants` über `metadata.phone_number_id`, heftet die Zeile als `tenant` an die Nutzlast und
ruft den Workflow aus `workflow_id` auf – **nur** bei `status = live`. Kein oder nicht-liver
Mandant ⇒ Telegram-Alarm, nie stiller Verlust. Status-Updates außer `failed` werden verworfen.

Der Kundenagent (Vorlage: `Layla v2 – WhatsApp Agent (HYBOTE)`) liest Tabellen-IDs und
`tenant_key` aus `tenant`, Persona, Leistungswissen und Termin-Playbook aus `wa_tenant_config`.
Inhaber-Echos (`smb_message_echoes`) werden als Rolle `owner` gespeichert, ohne Antwort; der
Coexistence-Verlauf (`history`) wird je Thread einmalig importiert.

`wa_tenants` enthält `tenant_key`, `company_name`, `work_email`, `customer_reference`,
`meta_business_id`, `waba_id`, `phone_number_id`, `credential_id`, `workflow_id`, `status`,
`token_expires_at`, `platform_type`, `display_phone_number`, `coexistence`, `registered_at`,
`provisioned_at`, `history_table_id` und `buffer_table_id`. Der Upsert-Schlüssel ist die
`phone_number_id`, nicht die `waba_id`: Eine WABA kann mehrere Nummern tragen.

Jeder Onboarding-Versuch – Erfolg wie Fehlschlag – hinterlässt eine Zeile in `wa_onboarding_log`.
Das Schreiben ist bewusst nicht fatal. Das alte Gateway `WhatsApp Gateway (HYBOTE)` bleibt bis zum
Abschluss der Umschaltung deaktivierbar als Rückweg erhalten und wird erst nach sieben stabilen
Tagen archiviert.

## Token-Betrieb

Die Konfigurationsvorlage sieht 60 Tage vor. **Ob der Token tatsächlich abläuft, ist noch nicht
belegt** – Business-Integration-System-User-Token laufen je nach Konfiguration gar nicht ab.
Der Endpunkt schreibt deshalb nur ein Ablaufdatum, wenn Meta eines liefert (`expires_in` aus dem
Code-Tausch oder `expires_at` aus `debug_token`), statt den Vorlagenwert abzuschreiben. Der erste
echte Signup entscheidet, ob die folgende Weckerkette überhaupt gebraucht wird:

1. `expiresAt` speichern.
2. Spätestens 15 Tage vor Ablauf intern warnen.
3. Spätestens 7 Tage vor Ablauf den Kunden zur erneuten Autorisierung auffordern.
4. Nach erfolgreicher Erneuerung den alten Token ersetzen und aus dem aktiven Credential-Speicher entfernen.

## Meta App Review

Benötigte Berechtigungen:

- `whatsapp_business_management`
- `whatsapp_business_messaging`
- `business_management`
- `public_profile`

Reviewer-Nachweise:

- Eigenes Video für `whatsapp_business_messaging`: Versand aus HYBOTE/n8n und Empfang derselben Nachricht in WhatsApp.
- Eigenes Video für `whatsapp_business_management`: API- oder UI-Ablauf zur Erstellung und Anzeige einer Nachrichtenvorlage.
- Testanleitung mit URL zur Kundenseite, Testzugang und nummerierten Schritten.

Bereits im Review-Entwurf gespeichert:

- Unternehmensbeschreibung und Nutzungsbeschreibungen für `whatsapp_business_messaging`, `business_management` und `whatsapp_business_management`
- Zustimmung zur zulässigen Nutzung für alle vier Berechtigungen
- Website-Plattform `https://hybote.ai/`
- Reviewer-Testanleitung für `https://hybote.ai/meta-connect.html`
- Verantwortliche Stelle `Hybote AI Systems LLC`, USA
- technische Dienstleister Vercel Inc. (USA), Hetzner Online GmbH (Deutschland) und OpenAI, L.L.C. (USA)
- keine Weitergabe personenbezogener Meta-Nutzerdaten aufgrund nationaler Sicherheitsanfragen in den vorangegangenen zwölf Monaten
- alle vier Verfahren für behördliche Auskunftsersuchen; dokumentiert in `docs/government-data-request-policy.md`

Die Tech-Provider-Zugriffsverifizierung wurde am 31. August 2026 genehmigt.

Noch offen:

- realer Embedded-Signup-Test und Upload der daraus erstellten Screen-Recordings
- endgültige App-Review-Einreichung und anschließende Veröffentlichung
- Reviewer-Anleitung um den Einladungslink ergänzen: Die Seite ist ohne Token nicht mehr frei
  erreichbar. Ohne diesen Hinweis lehnt der Prüfer aus reinem Missverständnis ab.

## Embedded Signup v4 (Frist 15. Oktober 2026 für v2/v3)

Embedded Signup v2 **und v3** werden am 15. Oktober 2026 abgeschaltet. Der Code ist seit dem
02.09.2026 v4-fähig: kein `sessionInfoVersion`, `extras` enthält nur `setup` (Vorbefüllung) und den
Coexistence-Feature-Typ. Danach gibt es keine Frist mehr – der Flow selbst hat kein Ablaufdatum.

Noch zu tun (nur im App Dashboard, nicht im Code): Facebook Login for Business → Configurations →
neue Konfiguration „HYBOTE Embedded Signup v4", Login-Variante WhatsApp Embedded Signup, Produkte
auswählen (setzt v4), Coexistence aktivieren, Token **ohne** Ablauf (nicht die 60-Tage-Vorlage). Die
neue ID in `META_CONFIG_ID` (`meta-connect.js`) eintragen. `build/verify.mjs` prüft nur noch, dass
dort eine numerische Meta-ID steht. Die drei Feature-Typen werden **nicht** automatisch migriert.

Metas Doku nennt den Coexistence-Feature-Typ uneinheitlich (`whatsapp_business_app_onboarding` auf
der Coexistence-Seite, `coex` in der Versionsübersicht). Deshalb steht er genau einmal in
`COEXISTENCE_FEATURE_TYPE`; beim ersten Test mit der v4-Konfiguration am echten Dialog prüfen.
