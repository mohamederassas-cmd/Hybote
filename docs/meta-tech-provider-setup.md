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

`META_APP_SECRET` und `N8N_API_KEY` dürfen niemals in HTML, Browser-JavaScript, Git, Screenshots oder Chat-Nachrichten gespeichert werden.

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

Die n8n-Datentabelle `wa_tenants` enthält die geprüften Spalten `tenant_key`, `company_name`, `work_email`, `customer_reference`, `meta_business_id`, `waba_id`, `phone_number_id`, `credential_id`, `workflow_id`, `status` und `token_expires_at`. Der bestehende aktive Workflow `WhatsApp Gateway (HYBOTE)` bleibt bis zu einem erfolgreichen Pilot-Test unverändert.

## Token-Betrieb

Die aktuelle Meta-Vorlage erzeugt einen Systemnutzer-Token mit 60 Tagen Laufzeit. n8n muss:

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

Noch offen:

- Abschluss der Meta-Zugriffsverifizierung; Status derzeit `Eingereicht – Wird geprüft`
- bestätigte Angaben zu nationalen Sicherheitsanfragen und den internen Verfahren für behördliche Auskunftsersuchen
- realer Embedded-Signup-Test und Upload der daraus erstellten Screen-Recordings
- endgültige App-Review-Einreichung und anschließende Veröffentlichung
