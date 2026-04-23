---
name: qgen-agent-skill
description: Use the local QGen repo in `/home/max-mannstein/coding/qgen` to render DAZE offers and related documents as PDF, DOCX, or HTML, or to create and patch filesystem-based templates via prompt-driven authoring. Trigger when an agent should generate an offer, render a quote document, test an export, inspect available templates, or create/update a QGen template from a prompt.
---

# QGen Skill

Use this skill when an agent needs to work with the local QGen repo.

## Project

- Repo: `/home/max-mannstein/coding/qgen`
- CLI: `node ./scripts/qgen.mjs`
- Outputs: `/home/max-mannstein/coding/qgen/generated`
- Detailed docs: `./docs/QGEN-DOCUMENTATION.md`

## Fastest path

For a quick end-to-end smoke test:

```bash
cd /home/max-mannstein/coding/qgen
npm run generate:sample
```

This writes sample JSON plus HTML/PDF/DOCX outputs under `generated/`.

## Core workflows

### 1. List templates

```bash
cd /home/max-mannstein/coding/qgen
node ./scripts/qgen.mjs list-templates
```

### 2. Generate from existing template

```bash
cd /home/max-mannstein/coding/qgen
node ./scripts/qgen.mjs generate-from-template \
  --template daze-standard \
  --data ./generated/sample-quote.json \
  --out ./generated
```

### 3. Create template from prompt

```bash
cd /home/max-mannstein/coding/qgen
node ./scripts/qgen.mjs create-template-from-prompt \
  --id agent-brief \
  --from invoice-standard \
  --out ./generated/agent-brief/authoring-preview \
  --prompt $'tone: ops briefing\nlayout: spotlight\naccent: #0f766e\nheadline: Rollout-Briefing für {{recipient.company}}\nintro: Diese agentisch erstellte Vorlage fasst Angebot und Rollout-Rahmen zusammen.\nadd-field: recipient.department:string!'
```

### 4. Patch existing template from prompt

```bash
cd /home/max-mannstein/coding/qgen
node ./scripts/qgen.mjs patch-template-from-prompt \
  --template agent-brief \
  --out ./generated/agent-brief/patched-preview \
  --prompt $'layout: compact\naccent: #7c3aed\nnotes-title: Betriebsnotizen\nnotes-body: Kompaktere Agent-Version.\nadd-field: sender.success_manager_email:string'
```

### 5. Web/API flow

```bash
cd /home/max-mannstein/coding/qgen
npm run dev
```

Then use:
- `/templates` for registry overview
- `/generate` for JSON + preview
- `POST /api/templates/author` for agent-first authoring
- `POST /api/generate?format=pdf|docx|html&template=<id>` for export

## Non-negotiable rules

- Use real umlauts in copy and template metadata: `ä`, `ö`, `ü`, `Ä`, `Ö`, `Ü`, `ß` — not `ae`, `oe`, `ue`, `ss`, unless a technical identifier must stay ASCII.
- Price tables need noticeable horizontal spacing between columns, especially before numeric columns like quantity, unit price, and total.
- Prefer `create-template-from-prompt` / `patch-template-from-prompt` over manual ad-hoc template edits when the job is fundamentally authoring.
- Keep the repo skill current when QGen flows or constraints change.

## What QGen validates before accepting template changes

- schema structure
- generated sample data against the schema
- HTML placeholders against the real render context

If validation fails, the change should be treated as rejected.

## Suggested execution order

1. Check whether a quick sample/export is enough.
2. If yes, run `npm run generate:sample`.
3. If real data exists, create a JSON input file and render with `generate-from-template`.
4. If the task is template authoring, use prompt-driven create/patch flows.
5. Return the generated file path(s) or send the rendered artifact.

## Troubleshooting

Run these in order:

```bash
cd /home/max-mannstein/coding/qgen
npm install
npm run generate:sample
node ./scripts/qgen.mjs create-template-from-prompt --id smoke-test --prompt "tone: smoke test"
npm run build
```

If `generate:sample` passes, the core rendering path is healthy.
If `npm run build` passes, the web app is healthy.

## Reference

For architecture, template model, API details, and maintenance rules, read:

- `./docs/QGEN-DOCUMENTATION.md`
