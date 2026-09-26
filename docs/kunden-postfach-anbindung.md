# Kunden-Postfach-Anbindung und kanalbewusste Einladungen (26.09.2026)

## Überblick

Der Operations Pilot verschickt seit dem 26.09.2026 je Kanal einen eigenen persönlichen Link:

| Kanal | Kundenseite | Kanal im Token | Ergebnis |
|---|---|---|---|
| WhatsApp | `hybote.ai/meta-connect.html?invite=…` (unverändert) | `channel: "whatsapp"` (fehlt in alten Links = WhatsApp) | n8n-Credential `whatsAppApi` + Zeile `wa_tenants` |
| Instagram | `hybote.ai/connect.html?invite=…` | `channel: "instagram"` | vorbereitet: Seite zeigt „wird freigeschaltet“, bis `INSTAGRAM_SIGNUP_ENABLED=1` und `IG_CONFIG_ID` in `connect.js` gesetzt sind |
| E-Mail | `hybote.ai/connect.html?invite=…` | `channel: "email"`, `providers: ["microsoft","google","imap"]` | n8n-Credential (`microsoftOutlookOAuth2Api`, `gmailOAuth2` oder `imap` + `smtp`) + Zeile `mail_tenants` |

Der Sales Pilot signiert die Links (`server/src/services/ops/invite.ts`), Vercel prüft sie (`api/meta/_invite.js`).
Ein neuer Link ersetzt nur den bisherigen Link **desselben Kanals**. Der Kunden-Token (OAuth-Refresh-Token
bzw. App-Passwort) liegt ausschließlich als n8n-Credential; `mail_tenants` und die SQLite des Sales Pilot
tragen nur Zuordnung und Status.

## Dateien

- `connect.html`, `connect.js`, `connect.css` – Kundenseite für Instagram + E-Mail (liest den Kanal aus dem Token,
  WhatsApp-Links werden auf `meta-connect.html` umgeleitet).
- `api/connect/invite.js` – Token auflösen + Feature-Flags (`instagramEnabled`, `mailConfigured`, `microsoft`, `google`).
- `api/connect/status.js` – Verbindungsstand aus `mail_tenants` (Erfolgsseite nach Redirect, „bereits verbunden“).
- `api/connect/ms/start.js`, `api/connect/ms/callback.js` – Microsoft Entra, Authorization Code, Authority `common`.
- `api/connect/google/start.js`, `api/connect/google/callback.js` – Google OAuth 2.0 mit `access_type=offline`.
- `api/connect/imap/verify.js` – IMAP/SMTP prüfen (imapflow, nodemailer), zwei Credentials anlegen.
- `api/connect/session.js` – CSRF-Cookie nur für den IMAP-POST.
- `api/connect/ig/complete.js` – Stub (503 `INSTAGRAM_NOT_ENABLED`).
- `api/connect/_state.js` – OAuth-State (HMAC), Cookies `hybote_connect_nonce` / `hybote_connect_invite`
  (**SameSite=Lax**, weil der Callback ein Cross-Site-Redirect ist), Rate-Limit, Redirect zurück zur Seite.
- `api/connect/_n8n.js`, `api/connect/_mailTenant.js` – n8n Public API (Credential anlegen/aktualisieren,
  `mail_tenants` upsert nach `tenant_key`, Audit in `wa_onboarding_log` mit `outcome` `MAIL_OK` / `MAIL_FAILED`).
- `package.json` (Repo-Root) – `imapflow`, `nodemailer` für die IMAP-Function.

## Vercel-Umgebungsvariablen (neu)

- `N8N_MAIL_TENANT_TABLE_ID=kr70dG8aoKBukGaa` – Datentabelle `mail_tenants` (Projekt `jsIyw3Baf0VCkxWB`)
- `MS_CONNECT_CLIENT_ID`, `MS_CONNECT_CLIENT_SECRET`, optional `MS_CONNECT_TENANT` (Default `common`)
- `GOOGLE_CONNECT_CLIENT_ID`, `GOOGLE_CONNECT_CLIENT_SECRET`
- `INSTAGRAM_SIGNUP_ENABLED` – leer lassen, bis Meta die Instagram-Rechte freigibt
- optional `CONNECT_STATE_SECRET` (sonst `META_INVITE_SECRET`), `CONNECT_BASE_URL` (Default `https://hybote.ai`)

Weiterverwendet: `N8N_BASE_URL`, `N8N_API_KEY`, `N8N_PROJECT_ID`, `N8N_ONBOARDING_LOG_TABLE_ID`,
`META_INVITE_SECRET`, `META_ALLOWED_ORIGINS`. Der `N8N_API_KEY` braucht `credential:create` und
Schreibrecht auf Datentabellen-Zeilen (hat er für WhatsApp bereits).

Im Sales Pilot (`.env`): `N8N_MAIL_TENANT_TABLE_ID=kr70dG8aoKBukGaa`; der Sync spiegelt `mail_tenants`
in `tenants.mail_*` und hakt den Checklistenschritt `mail_connected` ab.

## Portale (einmalig, manuell)

**Microsoft Entra – neue App-Registrierung „HYBOTE Mail Connect“** (nicht die Device-Code-App des Sales Pilot):
Kontotyp „Konten in einem beliebigen Organisationsverzeichnis und persönliche Microsoft-Konten“,
Plattform **Web**, Redirect-URI `https://hybote.ai/api/connect/ms/callback`, delegierte Berechtigungen
`openid email offline_access User.Read Mail.ReadWrite Mail.Send`, Client-Secret (Ablauf notieren, max. 24 Monate).
Publisher-Verifizierung (MPN-ID) einplanen, sonst zeigt Microsoft „nicht verifiziert“ und manche Kundentenants
verlangen Admin-Zustimmung. Die Credential in n8n trägt `customScopes=true` mit genau diesen Rechten, damit der
Refresh keine nicht erteilten Scopes anfordert.

**Google Cloud – Projekt „HYBOTE Mail Connect“:** Gmail API aktivieren, OAuth-Zustimmungsbildschirm Extern,
Status **Testing** (Testnutzer eintragen, z. B. Mohameds Gmail), OAuth-Client „Webanwendung“ mit Redirect
`https://hybote.ai/api/connect/google/callback`. Scopes `gmail.modify`, `gmail.send`, `openid`, `email`.
Achtung: im Testmodus verfallen Refresh-Tokens externer Nutzer nach 7 Tagen; `gmail.modify` ist ein
restricted scope (Verifizierung + CASA für Produktion). Übergang für Google-Kunden: IMAP mit App-Passwort.

## Ablauf E-Mail

1. Sales Pilot: Ops-Akte → Karte „E-Mail-Postfach“ → Anbieter wählen → Link erzeugen → per E-Mail senden.
2. Kunde öffnet `connect.html`, wählt Anbieter. Microsoft/Google: Redirect zum Anbieter, Callback legt
   Credential + `mail_tenants`-Zeile an und leitet auf `connect.html?invite=…&result=ok`. IMAP: Formular,
   serverseitiger Verbindungstest, dann Credentials.
3. Sales Pilot-Sync (Setting `ops.sync_interval_s`) spiegelt `mail_tenants` → Akte zeigt „E-Mail verbunden“,
   Event `mail.connected`, Checkliste `mail_connected`.

Fehlercodes in der URL (`?error=`): `INVITE_INVALID`, `INVITE_CHANNEL_MISMATCH`, `PROVIDER_NOT_ALLOWED`,
`NOT_CONFIGURED`, `TOO_MANY_ATTEMPTS`, `OAUTH_DENIED`, `OAUTH_FAILED`, `STATE_INVALID`, `SERVER_ERROR`.

## Noch nicht enthalten (bewusst)

- Kunden-E-Mail-Agent in n8n (Vorlage klonen wie bei WhatsApp) – Folgevorhaben.
- `mail_status = error` aus n8n-Fehlern (der Sync liest nur).
- Instagram-Login (Code-Tausch, Scopes, `ig_tenants`) – nach Meta-Freigabe in `api/connect/ig/complete.js`.
