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
- `N8N_META_ONBOARDING_WEBHOOK_URL=<Production webhook URL>`
- `N8N_META_ONBOARDING_WEBHOOK_SECRET=<mindestens 32 zufällige Bytes>`

`META_APP_SECRET`, die n8n-Webhook-URL und das Webhook-Geheimnis dürfen niemals in HTML, Browser-JavaScript, Git, Screenshots oder Chat-Nachrichten gespeichert werden.

## Erwarteter n8n-Endpunkt

Der Endpunkt empfängt `POST`-Anfragen mit:

- `X-HYBOTE-Event: meta.whatsapp.embedded_signup.completed`
- `X-HYBOTE-Signature: sha256=<hex hmac>`
- JSON-Nutzlast mit Kunde, WABA, Telefonnummer, Zugriffstoken und Ablaufzeit

Vor jeder weiteren Verarbeitung muss n8n die HMAC-SHA-256-Signatur über den unveränderten Raw Body mit `N8N_META_ONBOARDING_WEBHOOK_SECRET` prüfen. Nur bei gültiger Signatur darf der Token verschlüsselt gespeichert oder als n8n-Credential verwendet werden.

Der Workflow darf erfolgreiche oder fehlgeschlagene Ausführungsdaten mit Zugriffstoken nicht dauerhaft im n8n-Verlauf speichern. Nach dem Schreiben in den verschlüsselten Credential-Speicher muss das Token-Feld aus allen weiteren Workflow-Daten entfernt werden.

## Mandantenmodell

Jeder Kunde behält sein eigenes Meta Business Portfolio, seine WABA und seine Telefonnummer. Die eindeutige Zuordnung erfolgt mindestens über:

- HYBOTE-Kunden-ID
- Meta Business ID
- WABA ID
- Phone Number ID
- Token-Ablaufzeit
- Workflow-/Agent-ID in n8n

Keine Konversation, kein Token und keine CRM-Verbindung darf zwischen Mandanten geteilt werden.

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
