# QGen

DAZE Quote Generator MVP auf Basis von Next.js 16 + TypeScript.

Ausführliche Doku: [`docs/QGEN-DOCUMENTATION.md`](./docs/QGEN-DOCUMENTATION.md)

## Features
- `templates/<id>/` für filesystem-basierte Templates mit `metadata.json`, `schema.json` und `template.html`
- Zweites Beispieltemplate `invoice-standard` als Beleg für das echte Dateisystem-Template-Modell
- Template-Registry in `src/lib/template-registry.ts`
- Agent-first Authoring mit `create-template-from-prompt` und `patch-template-from-prompt`
- HTTP-Authoring-Route `POST /api/templates/author`
- Validierung für Schema-Form, Sample-Daten und Template-Placeholder vor dem Akzeptieren einer Änderung
- Sofortige Preview-/Sample-Generierung für neu erzeugte oder gepatchte Templates
- `/templates` für eingebaute Templates
- `/generate` für JSON-Eingabe + Live Preview
- Export via `/api/generate?format=pdf|docx|html&template=<id>`
- CLI: `qgen list-templates`, `qgen create-template`, `qgen patch-template`, `qgen generate-from-template`
- Sample-Generierung via `npm run generate:sample`

## Start

```bash
npm install
npm run dev
```

## Sample erzeugen

```bash
npm run generate:sample
```

## CLI

```bash
node ./scripts/qgen.mjs list-templates
node ./scripts/qgen.mjs create-template --id partner-brief --name "Partner Brief" --description "Bootstrap aus bestehendem Template"
node ./scripts/qgen.mjs patch-template --template invoice-standard --version 0.1.1
node ./scripts/qgen.mjs create-template-from-prompt --id agent-brief --from invoice-standard --prompt-file ./prompts/agent-brief.txt
node ./scripts/qgen.mjs patch-template-from-prompt --template agent-brief --prompt "layout: compact"
node ./scripts/qgen.mjs generate-from-template --template daze-standard --data ./generated/sample-quote.json --out ./generated
```

## Agent-first Authoring

`create-template-from-prompt` und `patch-template-from-prompt` nehmen einen Prompt entgegen, erzeugen bzw. aktualisieren die drei Template-Dateien und rendern direkt eine Vorschau mit Sample-Daten.

Unterstützte Direktiven im Prompt:

- `tone: ...`
- `layout: split|spotlight|compact`
- `accent: #rrggbb`
- `accent-strong: #rrggbb`
- `surface: #rrggbb`
- `shell: #rrggbb`
- `ink: #rrggbb`
- `doc-title: ...`
- `headline: ...`
- `intro: ...`
- `callout-title: ...`
- `callout-body: ...`
- `notes-title: ...`
- `notes-body: ...`
- `closing: ...`
- `add-field: path:type` oder `add-field: path:type!`
- `remove-field: path`
- `require-field: path`
- `optional-field: path`

Beispiel:

```bash
node ./scripts/qgen.mjs create-template-from-prompt \
  --id agent-brief \
  --from invoice-standard \
  --out ./generated/agent-brief/authoring-preview \
  --prompt $'tone: ops briefing\nlayout: spotlight\naccent: #0f766e\nheadline: Rollout-Briefing für {{recipient.company}}\nintro: Diese agentisch erstellte Vorlage fasst Angebot und Rollout-Rahmen zusammen.\nadd-field: recipient.department:string!'
```

Wichtig: In Copy, Templates, JSON-Metadaten und Prompts immer echte Umlaute verwenden, also `ä`, `ö`, `ü`, `Ä`, `Ö`, `Ü`, `ß` statt ASCII-Ersatz wie `ae`, `oe`, `ue`, `ss`, außer ein externer Identifier verlangt explizit ASCII.
Außerdem Preis-Tabellen nicht zu eng setzen: horizontales Padding zwischen den Spalten bewusst großzügig halten, besonders vor Mengen-, Einzelpreis- und Gesamt-Spalten.

Die Preview liegt standardmäßig unter `generated/<template-id>/authoring-preview/` mit:

- `sample-data.json`
- `preview-<template-id>.html`
- `preview-<template-id>.pdf`
- `preview-<template-id>.docx`

## HTTP Flow

```bash
curl -X POST http://127.0.0.1:3000/api/templates/author \
  -H 'content-type: application/json' \
  --data-binary '{"action":"create","id":"api-agent-brief","prompt":"tone: api flow"}'
```
