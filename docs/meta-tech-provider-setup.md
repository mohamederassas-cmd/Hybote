# HYBOTE Meta Tech Provider – Betriebsnotizen

## Öffentliche Meta-Kennungen

- Meta App ID: `1580264870470342`
- Embedded Signup Configuration ID: `1048835977913160`
- Graph API: `v26.0`
- Session Info Version: `3`
- Kundenseite: `https://hybote.ai/meta-connect.html`

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
- `META_INVITE_SECRET=<64 Hex-Zeichen>` – signiert die Einladungslinks; identisch im Sales Pilot

`META_APP_SECRET`, `N8N_API_KEY`, `META_PIN_SECRET` und `META_INVITE_SECRET` dürfen niemals in HTML, Browser-JavaScript, Git, Screenshots oder Chat-Nachrichten gespeichert werden.

## Zugang zur Verbindungsseite

Die Seite ist ohne signierten Einladungslink nicht benutzbar. Ohne gültiges Token zeigt sie
einen Hinweis statt des Formulars und lädt das Meta-SDK gar nicht erst.

Firma, E-Mail und Kundennummer stammen ausschließlich aus dem Token, nicht aus dem Formular –
die Felder sind reine Anzeige. Der Link läuft standardmäßig nach 14 Tagen ab.

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

Nach erfolgreichem Signup stößt der Endpunkt `POST /{phone_number_id}/smb_app_data` an, um
Kontakte und Verlauf zu übernehmen. **Das Zeitfenster beträgt 24 Stunden ab Abschluss des
Signups** – danach müsste der Kunde das gesamte Onboarding wiederholen. Deshalb passiert das im
selben Request und nicht in einem späteren Cron.

Der Aufruf ist bewusst nicht fatal: Schlägt er fehl, ist die Nummer höchstwahrscheinlich keine
Coexistence-Nummer. Ergebnis und Fehlercode landen im Audit-Log, damit der erste echte Durchlauf
die exakte Signatur dieses Endpunkts belegt, statt sie zu vermuten.

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

## Mandantenmodell

Jeder Kunde behält sein eigenes Meta Business Portfolio, seine WABA und seine Telefonnummer. Die eindeutige Zuordnung erfolgt mindestens über:

- HYBOTE-Kunden-ID
- Meta Business ID
- WABA ID
- Phone Number ID
- Token-Ablaufzeit
- Workflow-/Agent-ID in n8n

Keine Konversation, kein Token und keine CRM-Verbindung darf zwischen Mandanten geteilt werden.

Die n8n-Datentabelle `wa_tenants` enthält `tenant_key`, `company_name`, `work_email`,
`customer_reference`, `meta_business_id`, `waba_id`, `phone_number_id`, `credential_id`,
`workflow_id`, `status`, `token_expires_at`, `platform_type`, `display_phone_number`,
`coexistence`, `registered_at` und `provisioned_at`.

Der Upsert-Schlüssel ist die `phone_number_id`, nicht die `waba_id`: Eine WABA kann mehrere
Nummern tragen, und mit `waba_id` als Filter überschreibt die zweite Nummer die Zeile der ersten.

Jeder Onboarding-Versuch – Erfolg wie Fehlschlag – hinterlässt eine Zeile in `wa_onboarding_log`.
Das Schreiben ist bewusst nicht fatal: ein fehlendes Log darf ein funktionierendes Onboarding
nicht verhindern. Der bestehende aktive Workflow `WhatsApp Gateway (HYBOTE)` bleibt bis zu einem erfolgreichen Pilot-Test unverändert.

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

## Frist: Embedded Signup v4 bis 15. Oktober 2026

Embedded Signup v2 **und v3** werden am 15. Oktober 2026 abgeschaltet. Die aktuelle
Implementierung nutzt `sessionInfoVersion: '3'`.

v4 verlangt eine **neue** Facebook-Login-for-Business-Konfiguration, also eine neue Config-ID in
`meta-connect.js`. Die drei Feature-Typen `only_waba_sharing`, `marketing_messages_lite` und
`coex` werden **nicht** automatisch migriert – da HYBOTE auf Coexistence setzt, ist die Migration
Pflicht und keine Option.
