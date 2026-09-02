# Kundenagent (Vorlage) – Bereitstellung eines Mandanten

Stand: 02.09.2026 (Stufe C). Die Vorlage ist der Workflow **Layla v2 – WhatsApp Agent (HYBOTE)**
(`rdQR5UIcZ5ogOT5X`) bzw. dessen Klon **Kundenagent (Vorlage)**. Jeder Kunde bekommt einen Klon,
ein eigenes Tabellenpaar und eine eigene Konfigurationszeile. Das Gateway `WhatsApp Gateway v2
(HYBOTE)` (`x4G3WQPN8nmquEh4`) verteilt über `wa_tenants`.

## Wie eine Nachricht läuft

```
Meta → hybote.ai/api/meta/webhook (Signatur) → n8n Gateway v2
  → Dedupe (wa_seen_events) → Aenderungen aufteilen (hybote_event)
  → Mandant suchen (wa_tenants, phone_number_id) → nur status = live
  → Mandant anheften (tenant: tenant_key, workflow_id, history_table_id, buffer_table_id, …)
  → Execute Workflow (workflow_id aus der Zeile)
      → Kundenagent: Ereignisart
           message        → Puffer → Debounce → Mandantenkonfiguration laden → Historie → Agent → Antwort
           echo           → Zeile role=owner in der Verlaufstabelle, KEINE Antwort
           history_import → Coexistence-Verlauf einmalig in die Verlaufstabelle
```

Der Agent liest **alles Mandantenspezifische** aus zwei Quellen:

- `tenant` in der Nutzlast (vom Gateway angeheftet): `tenant_key`, `history_table_id`, `buffer_table_id`.
- `wa_tenant_config` (Zeile mit `tenant_key`): `agent_name`, `company_name`, `owner_name`,
  `contact_email`, `website`, `escalation_telegram_chat_id`, `timezone`, `timezone_label`,
  `booking_link`, `persona`, `knowledge_base`, `booking_playbook`.

Fehlt eines davon, scheitert der Node `Konfiguration prüfen` **laut** – es gibt bewusst keinen
Rückfall auf HYBOTEs Tabellen.

## Die sechs Stellen einer Bereitstellung

1. **Zwei Tabellen** anlegen, Schema exakt wie `wa_chat_history` (`wa_id`, `role`, `text`,
   `created_at`) und `wa_message_buffer` (`wa_id`, `message_id`, `text`, `received_at`, `kind`).
   Namenskonvention: `wa_chat_history_<tenant_key>`, `wa_message_buffer_<tenant_key>`.
2. **Zeile in `wa_tenant_config`** mit dem `tenant_key` des Kunden. Pflichtfelder: `agent_name`,
   `company_name`, `owner_name`, `timezone`, `timezone_label`, `escalation_telegram_chat_id`,
   `persona`, `knowledge_base`, `booking_playbook`. Das `booking_playbook` muss zu den Tools des
   Klons passen – hat der Klon keine Termin-Tools, beschreibt es nur die Aufnahme des Anliegens
   (Beispiel: Zeile `probe`).
3. **Klon der Vorlage** anlegen. Die Tabellen-IDs müssen **nicht** im Workflow geändert werden –
   sie kommen per Expression aus `tenant`.
4. **`whatsAppApi`-Credential des Kunden** an **drei** Nodes setzen: `WhatsApp Antwort senden`,
   `Audio-URL holen`, `Audio herunterladen`. Die Credential legt `api/meta/complete.js` beim
   Embedded Signup an (`credential_id` in `wa_tenants`).
5. **Termin-Tools** (`check_availability`, `book_demo`, `find_demo`, `cancel_demo`, `send_email`)
   sind HYBOTE-spezifisch: entfernen oder auf das Kundensystem umstellen. `escalate_hot_lead` und
   `notify_demo_event` bleiben (Telegram-Ziel kommt aus der Konfiguration).
6. **Zeile in `wa_tenants`** vervollständigen: `workflow_id` (Klon), `history_table_id`,
   `buffer_table_id`, `status = live`. Erst mit `live` routet das Gateway; vorher landet jede
   Nachricht als Telegram-Alarm „nicht live".

Umschalten oder Zurückschalten eines Mandanten auf einen anderen Workflow ist **nur** der
Tabelleneintrag `wa_tenants.workflow_id` – kein Publish nötig. Für Zeilen-Updates gibt es das
Werkzeug **Werkzeug – Tabellenzeile aktualisieren** (`mcwvqXgl8QGrmkH6`, nie aktiv, per
Test-Ausführung mit `{ table_id, key_column, key_value, data }`).

## Rechte für die Automatisierung (Phase 2)

Der heutige Vercel-Schlüssel darf nur `credential:*` und `dataTableRow:upsert`. Für die
automatische Bereitstellung aus dem Sales Pilot braucht ein zweiter Schlüssel zusätzlich
`dataTable:create`, `workflow:create`, `workflow:update`, `workflow:activate`.

## Meta App Dashboard

Neben `messages` und den Kontoereignis-Feldern müssen für Coexistence-Kunden die Felder
`smb_message_echoes`, `history` und `smb_app_state_sync` abonniert sein – das geht nur im
Dashboard, nicht in n8n. Ein Coexistence-Verlauf kommt in Chunks (`history[].metadata.chunk_order`);
der Import prüft je Thread, ob für die `wa_id` schon Zeilen existieren, und importiert nur dann.

## Grenzen

- Der Klon-Ansatz trägt bis etwa 10–15 Kunden; danach werden Agent-Verbesserungen teurer als ein
  geteilter Workflow. Auslöser fürs Playbook v3.
- `smb_app_state_sync` (Kontakte) wird nicht gespeichert.
- Feldnamen der Coexistence-Payloads sind nach Metas Doku modelliert und beim ersten echten Chunk
  gegen die Execution zu prüfen (Node `Verlauf aufbereiten`).
