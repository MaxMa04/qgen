---
name: qgen-daze-offers
description: Nutze den lokalen DAZE Quote Generator in `/home/max-mannstein/coding/qgen`, um Angebote als PDF, DOCX oder HTML zu erzeugen. Verwenden, wenn Hunter ein Angebot, eine Test-Rechnung, ein PDF-Angebot, ein DAZE-Quote, oder ein exportierbares Angebotsdokument für einen Lead generieren soll.
---

# QGen für Hunter

Nutze dieses Skill, wenn du für DAZE schnell ein Angebot oder eine Test-Rechnung erzeugen sollst.

## Projektpfad

- Repo: `/home/max-mannstein/coding/qgen`
- Web UI: Next.js App im selben Repo
- CLI: `node ./scripts/qgen.mjs`
- Sample Output Folder: `/home/max-mannstein/coding/qgen/generated`
- Agent-first Authoring Route: `POST /api/templates/author`

## Unterstützte Wege

### 1. Schnellster Weg, wenn nur ein erstes Angebotsdokument gebraucht wird

Im Repo arbeiten und direkt die Sample-Datei oder eine eigene JSON-Datei generieren:

```bash
cd /home/max-mannstein/coding/qgen
npm run generate:sample
```

Das erzeugt:

- `generated/sample-quote.json`
- `generated/angebot-42011.html`
- `generated/angebot-42011.pdf`
- `generated/angebot-42011.docx`

## 2. Eigene Angebotsdaten verwenden

Erstelle oder überschreibe eine JSON-Datei nach diesem Schema:

```json
{
  "offer_number": "42012",
  "date": "2026-04-21",
  "valid_until": "2026-05-05",
  "recipient": {
    "company": "Muster GmbH",
    "contact_person": "Herr Beispiel",
    "street": "Musterstraße 1",
    "zip_city": "10115 Berlin"
  },
  "license": {
    "name": "DAZE Professional",
    "price_monthly": 129,
    "discount_percent": 10,
    "discount_label": "Einführungsrabatt"
  },
  "setup": {
    "enabled": true,
    "price": 249,
    "description": "Enthält Einrichtung, Stammdatenimport und Konfiguration."
  },
  "sender": {
    "company": "DAZE",
    "address_line1": "Emil-Junghannß-Str. 5",
    "address_line2": "09376 Oelsnitz/Erzgeb.",
    "country": "Deutschland",
    "ust_id": "DE 141316905",
    "phone": "(+49) 17640418251",
    "email": "support@dazeapp.de",
    "web": "www.dazeapp.de",
    "signee": "Max Mannstein"
  }
}
```

Dann generieren:

```bash
cd /home/max-mannstein/coding/qgen
node ./scripts/qgen.mjs generate --template daze-standard --data ./generated/dein-angebot.json --out ./generated
```

## 3. Web UI nutzen

Für manuelles Preview im Browser:

```bash
cd /home/max-mannstein/coding/qgen
npm run dev
```

Dann:

- `/templates` zeigt verfügbare Templates
- `/generate` zeigt JSON-Editor + Live Preview
- Export läuft über Buttons für PDF, DOCX und HTML

## 4. Agent-first Template-Authoring

Wenn Hunter nicht nur ein Angebot rendern, sondern ein neues Template aus einer Beschreibung erzeugen oder ein vorhandenes Template per Prompt anpassen soll, jetzt diese Flows nutzen:

### Neues Template direkt aus Prompt erzeugen

```bash
cd /home/max-mannstein/coding/qgen
node ./scripts/qgen.mjs create-template-from-prompt \
  --id agent-brief \
  --from invoice-standard \
  --out ./generated/agent-brief/authoring-preview \
  --prompt $'tone: ops briefing\nlayout: spotlight\naccent: #0f766e\nheadline: Rollout-Briefing für {{recipient.company}}\nintro: Diese agentisch erstellte Vorlage fasst Angebot und Rollout-Rahmen zusammen.\nadd-field: recipient.department:string!'
```

Wichtig: In Texten, Templates, JSON-Metadaten und Prompt-Copy immer echte Umlaute schreiben, also `ä`, `ö`, `ü`, `Ä`, `Ö`, `Ü`, `ß` statt `ae`, `oe`, `ue`, `ss`, außer ein technischer Identifier verlangt ausdrücklich ASCII.

Das erzeugt oder aktualisiert:

- `templates/agent-brief/metadata.json`
- `templates/agent-brief/schema.json`
- `templates/agent-brief/template.html`
- `generated/agent-brief/authoring-preview/sample-data.json`
- `generated/agent-brief/authoring-preview/preview-agent-brief.html`
- `generated/agent-brief/authoring-preview/preview-agent-brief.pdf`
- `generated/agent-brief/authoring-preview/preview-agent-brief.docx`

### Bestehendes Template per Prompt patchen

```bash
cd /home/max-mannstein/coding/qgen
node ./scripts/qgen.mjs patch-template-from-prompt \
  --template agent-brief \
  --out ./generated/agent-brief/patched-preview \
  --prompt $'layout: compact\naccent: #7c3aed\nnotes-title: Betriebsnotizen\nnotes-body: Kompaktere Agent-Version.\nadd-field: sender.success_manager_email:string'
```

Dabei wird vor dem Schreiben validiert:

- Schema-Struktur
- generierte Sample-Daten gegen das Schema
- alle Placeholder im HTML gegen den realen Render-Context

Wenn die Validierung fehlschlägt, wird die Änderung nicht akzeptiert.

### HTTP-Endpunkt für Agenten / App-Workflows

Wenn Hunter über die laufende Next-App arbeiten soll:

```bash
cd /home/max-mannstein/coding/qgen
npm run dev
```

Dann per HTTP:

```bash
curl -X POST http://127.0.0.1:3000/api/templates/author \
  -H 'content-type: application/json' \
  --data-binary '{"action":"create","id":"api-agent-brief","prompt":"tone: api flow"}'
```

## Wichtige Notes

- PDF-Generierung nutzt Puppeteer.
- Auf dieser Maschine braucht Chromium `--no-sandbox`, das ist im Code schon berücksichtigt.
- CLI und Sample-Generator sind verifiziert funktionsfähig.
- Build ist verifiziert mit `npm run build`.
- Agent-first Authoring erzeugt sofort Preview-Dateien und Sample-Daten im `generated/`-Baum.

## Empfohlener Ablauf für Hunter

1. Prüfen, ob nur ein schneller Test gebraucht wird.
2. Falls ja, `npm run generate:sample` ausführen.
3. Falls echte Lead-Daten vorliegen, JSON dafür schreiben.
4. `node ./scripts/qgen.mjs generate ...` ausführen.
5. Bei Template-Arbeit zuerst `create-template-from-prompt` oder `patch-template-from-prompt` nutzen.
6. PDF-Pfad aus dem JSON-Output nehmen und an Max oder den Zielkanal zurückgeben.

## Verifizierte Dateien

Aktuell erfolgreich generiert:

- `/home/max-mannstein/coding/qgen/generated/angebot-42011.pdf`
- `/home/max-mannstein/coding/qgen/generated/angebot-42011.docx`
- `/home/max-mannstein/coding/qgen/generated/angebot-42011.html`
- `/home/max-mannstein/coding/qgen/generated/sample-quote.json`
- `/home/max-mannstein/coding/qgen/generated/agent-brief/authoring-preview/preview-agent-brief.pdf`
- `/home/max-mannstein/coding/qgen/generated/agent-brief/patched-preview/preview-agent-brief.pdf`
- `/home/max-mannstein/coding/qgen/generated/api-agent-brief/authoring-preview/preview-api-agent-brief.pdf`

## Wenn etwas kaputt ist

In dieser Reihenfolge prüfen:

1. `cd /home/max-mannstein/coding/qgen && npm install`
2. `npm run generate:sample`
3. `node ./scripts/qgen.mjs create-template-from-prompt --id smoke-test --prompt "tone: smoke test"`
4. `npm run build`

Wenn `generate:sample` klappt, ist die Kernfunktion OK.
Wenn `build` klappt, ist die Web-App OK.
