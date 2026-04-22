# QGen Dokumentation

## Überblick

QGen ist ein quote/document generator für DAZE-Angebote auf Basis von Next.js 16, TypeScript und filesystem-basierten Templates. Das System rendert aus strukturierten JSON-Daten HTML, PDF und DOCX.

Der Kern-Shift in diesem Repo ist der **agent-first Template-Flow**:
- Templates sind echte Dateien im Repo
- Agents erzeugen oder patchen Templates aus Prompts
- jede Änderung wird validiert
- jede neue Version rendert sofort Preview-Dateien mit Sample-Daten

Damit bleibt das System deterministisch, versionierbar und agent-tauglich.

---

## Ziele

QGen soll drei Dinge gleichzeitig gut können:

1. **Schnell Angebote rendern**
   - JSON rein
   - HTML/PDF/DOCX raus

2. **Templates sauber versionieren**
   - jedes Template lebt unter `templates/<id>/`
   - Metadaten, Schema und HTML sind getrennt und lesbar

3. **Templates agentisch weiterentwickeln**
   - Prompt rein
   - Template-Dateien + Preview raus
   - kein separater WYSIWYG-Editor nötig

---

## Repo-Struktur

```text
qgen/
├── docs/
│   └── QGEN-DOCUMENTATION.md
├── generated/
│   └── ... erzeugte HTML/PDF/DOCX/Sample-Dateien
├── hunter-skill/
│   └── HUNTER-QGEN-SKILL.md
├── scripts/
│   ├── generate-sample.mjs
│   └── qgen.mjs
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── generate/route.ts
│   │   │   └── templates/author/route.ts
│   │   ├── generate/page.tsx
│   │   ├── templates/page.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── QuoteGeneratorClient.tsx
│   │   └── QuotePreview.tsx
│   └── lib/
│       ├── qgen.ts
│       ├── quote-shared.ts
│       ├── template-authoring.ts
│       └── template-registry.ts
└── templates/
    └── <template-id>/
        ├── metadata.json
        ├── schema.json
        └── template.html
```

---

## Template-Modell

Jedes Template besteht aus genau drei Dateien:

### `metadata.json`
Beschreibt das Template:
- `id`
- `name`
- `description`
- `version`
- optional `authoring`-Block mit Prompt-/Directive-Herkunft

### `schema.json`
Definiert den Input-Vertrag:
- erlaubte Felder
- required vs optional
- Typen
- nested objects

### `template.html`
Die eigentliche Render-Struktur mit Placeholdern wie:
- `{{recipient.company}}`
- `{{totalRecurring_money}}`
- `{{sender.email}}`

---

## Render-Flow

### Input
QGen nimmt strukturierte Angebotsdaten als JSON.

Beispielhafte Felder:
- Angebotsnummer
- Datum / Gültigkeit
- Empfänger
- Lizenz
- Setup-Kosten
- Senderdaten

### Verarbeitung
`src/lib/quote-shared.ts` und `src/lib/qgen.ts` berechnen:
- Währungswerte
- Netto-/Brutto-Summen
- wiederkehrende Beträge
- Datumslabels
- Render-Context für HTML/DOCX/PDF

### Output
Ein Render-Lauf kann erzeugen:
- `.html`
- `.pdf`
- `.docx`

---

## Agent-first Template-Authoring

Der wichtigste neue Flow liegt in `src/lib/template-authoring.ts`.

### Was der Flow macht
Aus einem Prompt wird:
1. ein Authoring-Plan abgeleitet
2. ein Ziel-Schema erzeugt oder gepatcht
3. HTML generiert
4. Metadaten geschrieben
5. Sample-Daten gebaut
6. Preview in HTML/PDF/DOCX erzeugt
7. alles validiert

### Unterstützte Befehle

#### Neues Template erzeugen
```bash
node ./scripts/qgen.mjs create-template-from-prompt \
  --id agent-brief \
  --from invoice-standard \
  --out ./generated/agent-brief/authoring-preview \
  --prompt-file ./prompts/agent-brief.txt
```

#### Bestehendes Template patchen
```bash
node ./scripts/qgen.mjs patch-template-from-prompt \
  --template agent-brief \
  --out ./generated/agent-brief/patched-preview \
  --prompt "layout: compact"
```

---

## Prompt-Direktiven

Unterstützte Direktiven:

- `tone:`
- `layout: split|spotlight|compact`
- `accent:`
- `accent-strong:`
- `surface:`
- `shell:`
- `ink:`
- `doc-title:`
- `headline:`
- `intro:`
- `callout-title:`
- `callout-body:`
- `notes-title:`
- `notes-body:`
- `closing:`
- `add-field:`
- `remove-field:`
- `require-field:`
- `optional-field:`

### Beispiel
```text
tone: ops briefing
layout: spotlight
accent: #0f766e
headline: Rollout-Briefing für {{recipient.company}}
intro: Diese agentisch erstellte Vorlage fasst Angebot und Rollout-Rahmen zusammen.
add-field: recipient.department:string!
```

---

## Validierung

Template-Änderungen werden nicht blind akzeptiert.

QGen prüft vor dem Schreiben:

1. **Schema-Form**
   - sinnvolle Objektstruktur
   - gültige required-Listen
   - konsistente Feldtypen

2. **Sample-Daten gegen Schema**
   - generierte Sample-Daten müssen das neue Schema erfüllen

3. **Placeholder gegen Render-Context**
   - HTML darf keine unbekannten Variablen referenzieren

Wenn eine Prüfung fehlschlägt, wird die Änderung abgelehnt.

---

## Web-App und API

### Seiten
- `/` → Einstieg
- `/templates` → verfügbare Templates
- `/generate` → JSON + Preview + Export

### API-Endpunkte

#### Rendern
```http
POST /api/generate?format=pdf|docx|html&template=<id>
```

#### Agent-first Authoring
```http
POST /api/templates/author
```

Beispiel:
```bash
curl -X POST http://127.0.0.1:3000/api/templates/author \
  -H 'content-type: application/json' \
  --data-binary '{"action":"create","id":"api-agent-brief","prompt":"tone: api flow"}'
```

---

## CLI

Zentrale CLI-Datei: `scripts/qgen.mjs`

### Unterstützte Commands
```bash
node ./scripts/qgen.mjs list-templates
node ./scripts/qgen.mjs create-template --id partner-brief --name "Partner Brief" --description "Bootstrap aus bestehendem Template"
node ./scripts/qgen.mjs patch-template --template invoice-standard --version 0.1.1
node ./scripts/qgen.mjs create-template-from-prompt --id agent-brief --from invoice-standard --prompt-file ./prompts/agent-brief.txt
node ./scripts/qgen.mjs patch-template-from-prompt --template agent-brief --prompt "layout: compact"
node ./scripts/qgen.mjs generate-from-template --template daze-standard --data ./generated/sample-quote.json --out ./generated
```

---

## UX-/Copy-Regeln

### 1. Umlaute
In Copy, Templates, JSON-Metadaten und Prompt-Copy immer echte Umlaute verwenden:
- `ä`, `ö`, `ü`, `Ä`, `Ö`, `Ü`, `ß`
- nicht `ae`, `oe`, `ue`, `ss`

Ausnahme: technische Identifier, Dateinamen oder externe Systeme, die explizit ASCII verlangen.

### 2. Preis-Tabellen
Preis-Tabellen dürfen nicht gequetscht wirken.

Regel:
- horizontales Padding zwischen den Spalten bewusst großzügig halten
- insbesondere vor numerischen Spalten wie Menge, Einzelpreis und Gesamt
- diese Regel gehört zur Template-Authoring-Pipeline und gilt nicht nur für einzelne manuell angepasste Templates

---

## Bestehende Templates

Aktuell im Repo:
- `daze-standard`
- `invoice-standard`
- `partner-brief`
- `agent-brief`
- `api-agent-brief`
- `telegram-agent-brief`
- `telegram-agent-brief-2`

Diese Templates zeigen:
- klassisches Angebot
- nüchterne Invoice-Optik
- agentisch erzeugte Briefing-Templates
- API-erzeugte Templates

---

## Verifikation / bekannte funktionierende Flows

Bereits erfolgreich verifiziert:
- `npm run build`
- `npm run generate:sample`
- `list-templates`
- `generate-from-template`
- `create-template-from-prompt`
- `patch-template-from-prompt`
- PDF/DOCX/HTML-Ausgabe
- API-Authoring-Route

Zusätzlich wurden mehrere echte Preview-Dateien erzeugt und verschickt.

---

## Pflege-Regeln für das Repo

1. Repo-Skill aktuell halten:
   - `hunter-skill/HUNTER-QGEN-SKILL.md`

2. Bei Architektur-/Flow-Änderungen auch Doku anpassen:
   - `README.md`
   - `docs/QGEN-DOCUMENTATION.md`
   - Skill-Datei, falls relevant

3. Änderungen testen, dann committen und pushen.

---

## Empfohlene nächste Schritte

Sinnvolle Folgearbeiten:
- mehrere echte Angebots-Schemas unterstützen
- Template-Library weiter ausbauen
- Prompt-Direktiven um Layout-Varianten und Inhaltsblöcke erweitern
- Diff-/Review-Flow für Template-Patches ergänzen
- bessere Preview-Ansicht im Web für Template-Autoren
- Notion/CRM-Export oder Angebotsdaten-Import ergänzen
