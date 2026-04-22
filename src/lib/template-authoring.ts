import fs from "node:fs/promises";
import path from "node:path";
import {
  buildTemplateContextFromInput,
  createTemplate,
  generateAllFormats,
  loadTemplate,
  patchTemplate,
  projectRoot,
  sampleQuote,
  type QuoteInput,
} from "./qgen.ts";
import {
  defaultTemplateId,
  type TemplateAuthoringMetadata,
  type TemplateDefinition,
  type TemplateMetadata,
} from "./template-registry.ts";

type JsonObject = Record<string, unknown>;

type ThemeLayout = "split" | "spotlight" | "compact";

type AuthoringFieldSpec = {
  path: string;
  type: string;
  required: boolean;
};

type AuthoringPlan = {
  prompt: string;
  baseTemplateId: string;
  theme: {
    accent: string;
    accentStrong: string;
    surface: string;
    shell: string;
    ink: string;
    layout: ThemeLayout;
    toneLabel: string;
  };
  copy: {
    docTitle: string;
    headline: string;
    intro: string;
    calloutTitle: string;
    calloutBody: string;
    notesTitle: string;
    notesBody: string;
    closing: string;
  };
  fields: {
    add: AuthoringFieldSpec[];
    remove: string[];
    require: string[];
    optional: string[];
  };
  directives: Record<string, unknown>;
};

type CreateTemplateFromPromptInput = {
  id?: string;
  name?: string;
  description?: string;
  version?: string;
  prompt: string;
  baseTemplateId?: string;
  previewOutDir?: string;
};

type PatchTemplateFromPromptInput = {
  id: string;
  prompt: string;
  name?: string;
  description?: string;
  version?: string;
  previewOutDir?: string;
};

type TemplatePreviewPaths = {
  outDir: string;
  sampleDataPath: string;
  htmlPath: string;
  pdfPath: string;
  docxPath: string;
};

type AuthoredTemplateResult = {
  template: TemplateDefinition;
  preview: TemplatePreviewPaths;
  sampleData: JsonObject;
  validation: {
    placeholderKeys: string[];
    sampleErrors: string[];
  };
};

const defaultTheme = {
  accent: "#1d4ed8",
  accentStrong: "#0f172a",
  surface: "#eff6ff",
  shell: "#e2e8f0",
  ink: "#0f172a",
  layout: "split" as ThemeLayout,
  toneLabel: "Agent-authored template",
};

const defaultCopy = {
  docTitle: "Angebot",
  headline: "Angebot für {{recipient.company}}",
  intro:
    "Diese Vorlage wurde aus einem Prompt erzeugt und bleibt bewusst dateibasiert: HTML, JSON-Schema und Metadaten werden zusammen versioniert.",
  calloutTitle: "Status",
  calloutBody: "{{modeLabel}} | Netto im Startmonat {{sumNetFirstMonth_money}} | Ab {{secondMonthLabel}} {{sumNetRecurring_money}}",
  notesTitle: "Hinweise",
  notesBody:
    "Dieses Dokument kann sofort mit Sample-Daten gerendert werden. Anpassungen an Text, Farben und Zusatzfeldern laufen weiter durch denselben Template-Pfad wie alle bestehenden Exporte.",
  closing: "Freundliche Grüße<br /><strong>{{sender.signee}}</strong>",
};

const coreFieldPaths = new Set([
  "offer_number",
  "date",
  "valid_until",
  "recipient",
  "recipient.company",
  "recipient.contact_person",
  "recipient.street",
  "recipient.zip_city",
  "license",
  "license.name",
  "license.price_monthly",
  "setup",
  "setup.enabled",
  "setup.price",
  "setup.description",
  "sender",
  "sender.company",
  "sender.address_line1",
  "sender.address_line2",
  "sender.country",
  "sender.ust_id",
  "sender.phone",
  "sender.email",
  "sender.web",
  "sender.signee",
]);

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function titleCaseFromSlug(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function splitCsvValues(value: string) {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeDirectiveKey(key: string) {
  return key.trim().toLowerCase().replace(/[\s_]+/g, "-");
}

function parsePrompt(prompt: string) {
  const directives = new Map<string, string[]>();
  const bodyLines: string[] = [];

  for (const line of prompt.split(/\r?\n/)) {
    const directiveMatch = line.match(/^\s*@?([a-zA-Z][\w\s-]*):\s*(.+?)\s*$/);
    if (!directiveMatch) {
      bodyLines.push(line);
      continue;
    }

    const isDirective = line.trimStart().startsWith("@") || normalizeDirectiveKey(directiveMatch[1]) !== "create-a-modern-service-offer-template-for-ai-workflow-consulting";
    if (!isDirective && directives.size === 0) {
      bodyLines.push(line);
      continue;
    }

    const key = normalizeDirectiveKey(directiveMatch[1]);
    const value = directiveMatch[2].trim();
    const current = directives.get(key) ?? [];
    current.push(value);
    directives.set(key, current);
  }

  const body = bodyLines.join("\n").trim();
  return { directives, body };
}

function getDirective(directives: Map<string, string[]>, key: string) {
  const values = directives.get(key);
  return values?.at(-1);
}

function getDirectiveList(directives: Map<string, string[]>, key: string) {
  return directives.get(key) ?? [];
}

function normalizeHexColor(value: string | undefined, fallback: string) {
  if (!value) {
    return fallback;
  }

  const normalized = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) {
    return normalized.toLowerCase();
  }

  return fallback;
}

function normalizeLayout(value: string | undefined, fallback: ThemeLayout) {
  if (value === "compact" || value === "spotlight" || value === "split") {
    return value;
  }
  return fallback;
}

function deriveId(candidateId: string | undefined, name: string | undefined, promptBody: string) {
  if (candidateId) {
    return slugify(candidateId);
  }

  if (name) {
    return slugify(name);
  }

  const bodySeed = promptBody
    .split(/\s+/)
    .slice(0, 6)
    .join(" ");
  return slugify(bodySeed || "agent-template");
}

function deriveDescription(value: string | undefined, promptBody: string, fallbackName: string) {
  if (value) {
    return value;
  }

  const sentence = promptBody.split(/[.!?]/).map((part) => part.trim()).find(Boolean);
  return sentence || `${fallbackName} template generated from a prompt.`;
}

function parseFieldSpec(value: string): AuthoringFieldSpec {
  const [rawPath, rawType = "string"] = value.split(":").map((part) => part.trim());
  if (!rawPath) {
    throw new Error(`Invalid add-field directive "${value}". Expected "path:type" or "path:type!".`);
  }

  const required = rawType.endsWith("!");
  const type = rawType.replace(/!$/, "");
  if (!["string", "number", "integer", "boolean", "date", "nullable-string", "nullable-number"].includes(type)) {
    throw new Error(`Unsupported field type "${type}" in add-field "${value}".`);
  }

  return { path: rawPath, type, required };
}

function toJsonSchemaLeaf(type: string) {
  switch (type) {
    case "string":
      return { type: "string" };
    case "number":
      return { type: "number" };
    case "integer":
      return { type: "integer" };
    case "boolean":
      return { type: "boolean" };
    case "date":
      return { type: "string", format: "date" };
    case "nullable-string":
      return { type: ["string", "null"] };
    case "nullable-number":
      return { type: ["number", "null"] };
    default:
      return { type: "string" };
  }
}

function ensureObjectSchema(schema: JsonObject, fieldPath: string) {
  if (!isRecord(schema.properties)) {
    schema.properties = {};
  }

  const properties = schema.properties as JsonObject;
  const current = properties[fieldPath];
  if (!isRecord(current)) {
    const next = {
      type: "object",
      additionalProperties: false,
      properties: {},
      required: [],
    } satisfies JsonObject;
    properties[fieldPath] = next;
    return next;
  }

  current.type ??= "object";
  current.additionalProperties ??= false;
  current.properties ??= {};
  current.required ??= [];
  return current;
}

function getSchemaNode(schema: JsonObject, fieldPath: string) {
  const segments = fieldPath.split(".").filter(Boolean);
  let current = schema;

  for (const segment of segments) {
    if (!isRecord(current.properties)) {
      return undefined;
    }

    const next = current.properties[segment];
    if (!isRecord(next)) {
      return undefined;
    }

    current = next;
  }

  return current;
}

function setSchemaNode(schema: JsonObject, fieldPath: string, value: JsonObject, required: boolean) {
  const segments = fieldPath.split(".").filter(Boolean);
  const leaf = segments.pop();

  if (!leaf) {
    throw new Error(`Invalid schema field path "${fieldPath}".`);
  }

  let current = schema;
  for (const segment of segments) {
    current = ensureObjectSchema(current, segment);
  }

  const properties = current.properties as JsonObject;
  properties[leaf] = value;
  current.required ??= [];
  if (Array.isArray(current.required)) {
    const requiredList = current.required as unknown[];
    const existing = new Set(requiredList.filter((entry): entry is string => typeof entry === "string"));
    if (required) {
      existing.add(leaf);
    }
    current.required = Array.from(existing).sort();
  }
}

function updateRequiredFlag(schema: JsonObject, fieldPath: string, required: boolean) {
  const segments = fieldPath.split(".").filter(Boolean);
  const leaf = segments.pop();

  if (!leaf) {
    return;
  }

  let current = schema;
  for (const segment of segments) {
    const next = getSchemaNode(current, segment);
    if (!next) {
      return;
    }
    current = next;
  }

  if (!Array.isArray(current.required)) {
    current.required = [];
  }

  const nextRequired = new Set((current.required as unknown[]).filter((entry): entry is string => typeof entry === "string"));
  if (required) {
    nextRequired.add(leaf);
  } else {
    nextRequired.delete(leaf);
  }
  current.required = Array.from(nextRequired).sort();
}

function deleteSchemaNode(schema: JsonObject, fieldPath: string) {
  const segments = fieldPath.split(".").filter(Boolean);
  const leaf = segments.pop();

  if (!leaf) {
    return;
  }

  let current = schema;
  for (const segment of segments) {
    const next = getSchemaNode(current, segment);
    if (!next) {
      return;
    }
    current = next;
  }

  if (isRecord(current.properties)) {
    delete current.properties[leaf];
  }

  if (Array.isArray(current.required)) {
    current.required = (current.required as unknown[])
      .filter((entry): entry is string => typeof entry === "string" && entry !== leaf)
      .sort();
  }
}

function buildPlan(prompt: string, options: { name?: string; description?: string; baseTemplateId?: string }, existing?: TemplateMetadata): AuthoringPlan {
  const { directives, body } = parsePrompt(prompt);
  const directiveRecord = Object.fromEntries(Array.from(directives.entries()));

  const name = options.name ?? getDirective(directives, "name") ?? existing?.name;
  const baseTemplateId = options.baseTemplateId ?? getDirective(directives, "base") ?? existing?.authoring?.baseTemplateId ?? defaultTemplateId;

  return {
    prompt,
    baseTemplateId,
    theme: {
      accent: normalizeHexColor(getDirective(directives, "accent"), existing?.authoring?.directives?.accent as string | undefined ?? defaultTheme.accent),
      accentStrong: normalizeHexColor(
        getDirective(directives, "accent-strong"),
        existing?.authoring?.directives?.["accent-strong"] as string | undefined ?? defaultTheme.accentStrong,
      ),
      surface: normalizeHexColor(getDirective(directives, "surface"), existing?.authoring?.directives?.surface as string | undefined ?? defaultTheme.surface),
      shell: normalizeHexColor(getDirective(directives, "shell"), existing?.authoring?.directives?.shell as string | undefined ?? defaultTheme.shell),
      ink: normalizeHexColor(getDirective(directives, "ink"), existing?.authoring?.directives?.ink as string | undefined ?? defaultTheme.ink),
      layout: normalizeLayout(getDirective(directives, "layout"), (existing?.authoring?.directives?.layout as ThemeLayout | undefined) ?? defaultTheme.layout),
      toneLabel:
        getDirective(directives, "tone") ??
        (existing?.authoring?.directives?.tone as string | undefined) ??
        defaultTheme.toneLabel,
    },
    copy: {
      docTitle: getDirective(directives, "doc-title") ?? (existing?.authoring?.directives?.["doc-title"] as string | undefined) ?? `${name ?? "QGen"} Dokument`,
      headline: getDirective(directives, "headline") ?? (existing?.authoring?.directives?.headline as string | undefined) ?? defaultCopy.headline,
      intro: getDirective(directives, "intro") ?? (existing?.authoring?.directives?.intro as string | undefined) ?? (body || defaultCopy.intro),
      calloutTitle:
        getDirective(directives, "callout-title") ??
        (existing?.authoring?.directives?.["callout-title"] as string | undefined) ??
        defaultCopy.calloutTitle,
      calloutBody:
        getDirective(directives, "callout-body") ??
        (existing?.authoring?.directives?.["callout-body"] as string | undefined) ??
        defaultCopy.calloutBody,
      notesTitle:
        getDirective(directives, "notes-title") ??
        (existing?.authoring?.directives?.["notes-title"] as string | undefined) ??
        defaultCopy.notesTitle,
      notesBody:
        getDirective(directives, "notes-body") ??
        (existing?.authoring?.directives?.["notes-body"] as string | undefined) ??
        defaultCopy.notesBody,
      closing: getDirective(directives, "closing") ?? (existing?.authoring?.directives?.closing as string | undefined) ?? defaultCopy.closing,
    },
    fields: {
      add: getDirectiveList(directives, "add-field").map(parseFieldSpec),
      remove: getDirectiveList(directives, "remove-field").flatMap(splitCsvValues),
      require: getDirectiveList(directives, "require-field").flatMap(splitCsvValues),
      optional: getDirectiveList(directives, "optional-field").flatMap(splitCsvValues),
    },
    directives: directiveRecord,
  };
}

function applyPlanToSchema(baseSchema: JsonObject, plan: AuthoringPlan, templateId: string, templateName: string) {
  const schema = deepClone(baseSchema);
  schema.$id = `qgen://templates/${templateId}/schema.json`;
  schema.title = `${templateName} Input`;

  for (const fieldPath of plan.fields.remove) {
    if (coreFieldPaths.has(fieldPath)) {
      throw new Error(`remove-field cannot delete required quote field "${fieldPath}".`);
    }
    deleteSchemaNode(schema, fieldPath);
  }

  for (const field of plan.fields.add) {
    if (coreFieldPaths.has(field.path)) {
      continue;
    }
    setSchemaNode(schema, field.path, toJsonSchemaLeaf(field.type), field.required);
  }

  for (const fieldPath of plan.fields.require) {
    updateRequiredFlag(schema, fieldPath, true);
  }

  for (const fieldPath of plan.fields.optional) {
    if (coreFieldPaths.has(fieldPath)) {
      throw new Error(`optional-field cannot relax required quote field "${fieldPath}".`);
    }
    updateRequiredFlag(schema, fieldPath, false);
  }

  return schema;
}

function extraDisplayFields(plan: AuthoringPlan) {
  return plan.fields.add
    .filter((field) => !coreFieldPaths.has(field.path))
    .map((field) => {
      const segments = field.path.split(".");
      const last = segments.at(-1) ?? field.path;
      return {
        path: field.path,
        label: titleCaseFromSlug(last.replace(/_/g, "-")),
      };
    });
}

function renderCustomFieldList(plan: AuthoringPlan) {
  const fields = extraDisplayFields(plan);
  if (fields.length === 0) {
    return "";
  }

  return `
      <div class="panel custom-fields">
        <h3>Zusatzfelder</h3>
        <div class="facts">
${fields
  .map(
    (field) => `          <div class="fact"><span>${escapeHtml(field.label)}</span><strong>{{${field.path}}}</strong></div>`,
  )
  .join("\n")}
        </div>
      </div>`;
}

function layoutClass(layout: ThemeLayout) {
  if (layout === "spotlight") {
    return "page spotlight";
  }

  if (layout === "compact") {
    return "page compact";
  }

  return "page split";
}

function buildTemplateHtml(plan: AuthoringPlan) {
  return `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(plan.copy.docTitle)} {{offer_number}}</title>
  <style>
    @page { size: A4; margin: 16mm; }
    :root {
      --accent: ${plan.theme.accent};
      --accent-strong: ${plan.theme.accentStrong};
      --surface: ${plan.theme.surface};
      --shell: ${plan.theme.shell};
      --ink: ${plan.theme.ink};
      --muted: #475569;
      --line: #cbd5e1;
      --paper: #ffffff;
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: var(--ink); background: var(--paper); }
    .page { width: 100%; display: grid; gap: 22px; }
    .hero { display: grid; grid-template-columns: 1.25fr 0.95fr; gap: 22px; align-items: start; }
    .page.spotlight .hero { grid-template-columns: 1fr; }
    .page.compact { gap: 16px; }
    .brand-shell { background: linear-gradient(160deg, var(--accent-strong), var(--accent)); color: white; border-radius: 24px; padding: 24px; }
    .tone { display: inline-flex; padding: 6px 12px; border-radius: 999px; background: rgba(255,255,255,0.16); text-transform: uppercase; font-size: 11px; letter-spacing: 0.16em; font-weight: 700; }
    .brand-shell h1 { margin: 14px 0 10px; font-size: 34px; letter-spacing: 0.05em; }
    .brand-shell p { margin: 0; line-height: 1.6; color: rgba(255,255,255,0.9); }
    .recipient-shell { border: 1px solid var(--line); border-radius: 24px; padding: 22px; background: var(--surface); }
    .recipient-shell strong { display: block; font-size: 20px; margin-bottom: 8px; }
    .recipient-shell div { line-height: 1.7; color: var(--muted); }
    .stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
    .page.compact .stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .stat { border-radius: 18px; padding: 16px; background: var(--shell); border: 1px solid var(--line); min-height: 92px; }
    .stat strong { display: block; margin-top: 10px; font-size: 20px; color: var(--accent-strong); }
    .eyebrow { font-size: 11px; text-transform: uppercase; letter-spacing: 0.16em; color: var(--muted); }
    .content-grid { display: grid; grid-template-columns: 1.3fr 0.7fr; gap: 22px; }
    .page.spotlight .content-grid { grid-template-columns: 1fr; }
    .lead h2 { margin: 0 0 12px; font-size: 30px; }
    .lead p { margin: 0; line-height: 1.75; color: var(--muted); }
    .panel { border: 1px solid var(--line); border-radius: 22px; padding: 18px; background: var(--paper); }
    .panel h3 { margin: 0 0 10px; font-size: 13px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--accent-strong); }
    .panel p { margin: 0; line-height: 1.7; color: var(--muted); }
    .facts { display: grid; gap: 10px; }
    .fact { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; border-top: 1px solid var(--line); padding-top: 10px; }
    .fact:first-child { border-top: 0; padding-top: 0; }
    .fact strong { color: var(--accent-strong); text-align: right; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.14em; color: var(--muted); padding: 0 0 10px; border-bottom: 1px solid var(--line); }
    td { padding: 14px 0; border-bottom: 1px solid var(--line); vertical-align: top; }
    .num { text-align: right; white-space: nowrap; }
    .totals { width: min(100%, 360px); margin-left: auto; border-radius: 22px; overflow: hidden; border: 1px solid var(--line); break-inside: avoid; page-break-inside: avoid; }
    .totals-row { display: flex; justify-content: space-between; gap: 12px; padding: 14px 18px; border-bottom: 1px solid var(--line); background: var(--paper); }
    .totals-row.highlight { background: var(--accent-strong); color: white; font-size: 18px; font-weight: 700; }
    .totals-row.strong { font-weight: 700; }
    .tail { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; break-inside: avoid; page-break-inside: avoid; }
    .page.spotlight .tail { grid-template-columns: 1fr; }
    .closing { margin-top: 4px; }
    .footer { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; font-size: 13px; color: var(--muted); break-inside: avoid; page-break-inside: avoid; }
  </style>
</head>
<body>
  <div class="${layoutClass(plan.theme.layout)}">
    <section class="hero">
      <div class="brand-shell">
        <div class="tone">${escapeHtml(plan.theme.toneLabel)}</div>
        <h1>{{sender.company}}</h1>
        <p>
          {{sender.address_line1}}<br />
          {{sender.address_line2}}<br />
          {{sender.country}}<br />
          USt-IdNr. {{sender.ust_id}}
        </p>
      </div>
      <div class="recipient-shell">
        <strong>{{recipient.company}}</strong>
        <div>
          {{recipient.contact_person}}<br />
          {{recipient.street}}<br />
          {{recipient.zip_city}}
        </div>
      </div>
    </section>

    <section class="stats">
      <div class="stat"><div class="eyebrow">Dokument</div><strong>{{offer_number}}</strong></div>
      <div class="stat"><div class="eyebrow">Erstellt am</div><strong>{{dateLabel}}</strong></div>
      <div class="stat"><div class="eyebrow">Gültig bis</div><strong>{{validUntilLabel}}</strong></div>
      <div class="stat"><div class="eyebrow">Wiederkehrend</div><strong>{{totalRecurring_money}}</strong></div>
    </section>

    <section class="content-grid">
      <div class="lead">
        <h2>${plan.copy.headline}</h2>
        <p>${plan.copy.intro}</p>
      </div>
      <div class="panel">
        <h3>${escapeHtml(plan.copy.calloutTitle)}</h3>
        <p>${plan.copy.calloutBody}</p>
      </div>
    </section>

    ${renderCustomFieldList(plan)}

    <section>
      <table>
        <thead>
          <tr>
            <th>Leistung</th>
            <th>Beschreibung</th>
            <th class="num">Menge</th>
            <th class="num">Preis</th>
            <th class="num">Betrag</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Lizenz</td>
            <td>DAZE {{license.name}}<br /><span style="color: var(--muted)">monatliche Nutzung und Betrieb</span></td>
            <td class="num">1</td>
            <td class="num">{{license.price_monthly_money}}</td>
            <td class="num">{{licenseTotal_money}}</td>
          </tr>
          {{{discount_row_html}}}
          <tr>
            <td>Einrichtung</td>
            <td>{{setup.description}}</td>
            <td class="num">1</td>
            <td class="num">{{setupTotal_money}}</td>
            <td class="num">{{setupTotal_money}}</td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="totals">
      <div class="totals-row"><span>Netto {{firstMonthLabel}}</span><span>{{sumNetFirstMonth_money}}</span></div>
      <div class="totals-row"><span>USt 19%</span><span>{{vatFirstMonth_money}}</span></div>
      <div class="totals-row highlight"><span>Gesamt Startmonat</span><span>{{totalFirstMonth_money}}</span></div>
      <div class="totals-row strong"><span>Netto ab {{secondMonthLabel}}</span><span>{{sumNetRecurring_money}}</span></div>
      <div class="totals-row"><span>USt 19%</span><span>{{vatRecurring_money}}</span></div>
      <div class="totals-row strong"><span>Gesamt wiederkehrend</span><span>{{totalRecurring_money}}</span></div>
    </section>

    <section class="tail">
      <div class="panel">
        <h3>${escapeHtml(plan.copy.notesTitle)}</h3>
        <p>${plan.copy.notesBody}</p>
      </div>
      <div class="panel">
        <h3>Nächster Schritt</h3>
        <p class="closing">${plan.copy.closing}</p>
      </div>
    </section>

    <section class="footer">
      <div>
        <strong>{{sender.company}}</strong><br />
        {{sender.address_line1}}<br />
        {{sender.address_line2}}<br />
        {{sender.country}}
      </div>
      <div>
        Ansprechpartner: {{sender.signee}}<br />
        Telefon: {{sender.phone}}<br />
        E-Mail: {{sender.email}}<br />
        Web: {{sender.web}}
      </div>
    </section>
  </div>
</body>
</html>`;
}

function schemaAllowsNull(schemaNode: JsonObject) {
  const type = schemaNode.type;
  if (Array.isArray(type)) {
    return type.includes("null");
  }
  return type === "null";
}

function schemaPrimaryType(schemaNode: JsonObject) {
  const type = schemaNode.type;
  if (Array.isArray(type)) {
    return type.find((entry) => entry !== "null");
  }
  return type;
}

function sampleValueForPath(fieldPath: string, schemaNode: JsonObject): unknown {
  const leaf = fieldPath.split(".").at(-1) ?? fieldPath;
  const type = schemaPrimaryType(schemaNode);

  if (type === "boolean") {
    return true;
  }

  if (type === "number" || type === "integer") {
    if (leaf.includes("percent")) {
      return 15;
    }
    if (leaf.includes("price") || leaf.includes("amount")) {
      return 199;
    }
    return 1;
  }

  if (type === "string") {
    if (schemaNode.format === "date") {
      return "2026-04-21";
    }
    if (leaf.includes("email")) {
      return "ops@beispiel.de";
    }
    if (leaf.includes("phone")) {
      return "+49 30 555 1234";
    }
    if (leaf.includes("web") || leaf.includes("url")) {
      return "https://example.com";
    }
    if (leaf.includes("city")) {
      return "10115 Berlin";
    }
    if (leaf.includes("street")) {
      return "Beispielstraße 1";
    }
    if (leaf.includes("company")) {
      return "Beispiel GmbH";
    }
    if (leaf.includes("person") || leaf.includes("contact") || leaf.includes("signee")) {
      return "Alex Beispiel";
    }
    if (leaf.includes("country")) {
      return "Deutschland";
    }
    if (leaf.includes("department")) {
      return "Operations";
    }
    if (leaf.includes("title") || leaf.includes("name")) {
      return "Beispielwert";
    }
    return "Beispielwert";
  }

  if (schemaAllowsNull(schemaNode)) {
    return null;
  }

  return "Beispielwert";
}

function buildSampleFromSchema(schemaNode: JsonObject, seed: unknown, fieldPath = ""): unknown {
  const type = schemaPrimaryType(schemaNode);

  if (type === "object") {
    const source = isRecord(seed) ? seed : {};
    const output: JsonObject = {};
    const properties = isRecord(schemaNode.properties) ? schemaNode.properties : {};

    for (const [propertyName, propertySchema] of Object.entries(properties)) {
      if (!isRecord(propertySchema)) {
        continue;
      }

      const nextPath = fieldPath ? `${fieldPath}.${propertyName}` : propertyName;
      output[propertyName] = buildSampleFromSchema(propertySchema, source[propertyName], nextPath);
    }

    return output;
  }

  if (seed != null) {
    return seed;
  }

  return sampleValueForPath(fieldPath, schemaNode);
}

function validateSchemaShape(schemaNode: JsonObject, fieldPath = "root", errors: string[] = []) {
  const type = schemaPrimaryType(schemaNode);
  if (!type) {
    errors.push(`${fieldPath}: missing type`);
    return errors;
  }

  if (type === "object") {
    if (!isRecord(schemaNode.properties)) {
      errors.push(`${fieldPath}: object schema requires properties`);
      return errors;
    }

    for (const [key, value] of Object.entries(schemaNode.properties)) {
      if (!isRecord(value)) {
        errors.push(`${fieldPath}.${key}: property schema must be an object`);
        continue;
      }
      validateSchemaShape(value, `${fieldPath}.${key}`, errors);
    }
  }

  return errors;
}

function validateSampleAgainstSchema(schemaNode: JsonObject, data: unknown, fieldPath = "root", errors: string[] = []) {
  const type = schemaPrimaryType(schemaNode);

  if (data === null) {
    if (!schemaAllowsNull(schemaNode)) {
      errors.push(`${fieldPath}: null is not allowed`);
    }
    return errors;
  }

  if (type === "object") {
    if (!isRecord(data)) {
      errors.push(`${fieldPath}: expected object`);
      return errors;
    }

    const required = new Set(
      Array.isArray(schemaNode.required)
        ? (schemaNode.required as unknown[]).filter((entry): entry is string => typeof entry === "string")
        : [],
    );
    const properties = isRecord(schemaNode.properties) ? schemaNode.properties : {};

    for (const requiredKey of required) {
      if (!(requiredKey in data)) {
        errors.push(`${fieldPath}.${requiredKey}: missing required value`);
      }
    }

    if (schemaNode.additionalProperties === false) {
      for (const key of Object.keys(data)) {
        if (!(key in properties)) {
          errors.push(`${fieldPath}.${key}: additional property is not allowed`);
        }
      }
    }

    for (const [key, propertySchema] of Object.entries(properties)) {
      if (!isRecord(propertySchema) || !(key in data)) {
        continue;
      }
      validateSampleAgainstSchema(propertySchema, data[key], `${fieldPath}.${key}`, errors);
    }

    return errors;
  }

  if (type === "string" && typeof data !== "string") {
    errors.push(`${fieldPath}: expected string`);
  } else if (type === "number" && typeof data !== "number") {
    errors.push(`${fieldPath}: expected number`);
  } else if (type === "integer" && (!Number.isInteger(data) || typeof data !== "number")) {
    errors.push(`${fieldPath}: expected integer`);
  } else if (type === "boolean" && typeof data !== "boolean") {
    errors.push(`${fieldPath}: expected boolean`);
  }

  if (schemaNode.format === "date" && typeof data === "string" && !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    errors.push(`${fieldPath}: expected ISO date`);
  }

  return errors;
}

function extractPlaceholderKeys(templateHtml: string) {
  const keys = new Set<string>();
  const pattern = /\{\{\{?\s*([\w.-]+)\s*\}?\}\}/g;
  let match: RegExpExecArray | null;
  do {
    match = pattern.exec(templateHtml);
    if (match?.[1]) {
      keys.add(match[1]);
    }
  } while (match);
  return Array.from(keys).sort();
}

function validateTemplateRender(templateHtml: string, sampleData: QuoteInput) {
  const context = buildTemplateContextFromInput(sampleData);
  const placeholderKeys = extractPlaceholderKeys(templateHtml);
  const unknownKeys = placeholderKeys.filter((key) => !(key in context));

  if (unknownKeys.length > 0) {
    throw new Error(`Template references unknown placeholders: ${unknownKeys.join(", ")}`);
  }

  const rendered = templateHtml
    .replace(/\{\{\{\s*([\w.-]+)\s*\}\}\}/g, (_match, key) => context[key] ?? "")
    .replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_match, key) => context[key] ?? "");

  const unresolved = rendered.match(/\{\{\{?\s*([\w.-]+)\s*\}?\}\}/g);
  if (unresolved) {
    throw new Error(`Template render left unresolved placeholders: ${unresolved.join(", ")}`);
  }

  return placeholderKeys;
}

function nextPatchVersion(version: string) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    return version;
  }
  const [, major, minor, patch] = match;
  return `${major}.${minor}.${Number(patch) + 1}`;
}

async function createPreviewArtifacts(templateId: string, sampleData: JsonObject, previewOutDir?: string): Promise<TemplatePreviewPaths> {
  const outDir = previewOutDir ?? path.join(projectRoot, "generated", templateId, "authoring-preview");
  await fs.mkdir(outDir, { recursive: true });
  const sampleDataPath = path.join(outDir, "sample-data.json");
  await fs.writeFile(sampleDataPath, `${JSON.stringify(sampleData, null, 2)}\n`, "utf8");

  const renderInput = sampleData as QuoteInput;
  const generated = await generateAllFormats(renderInput, outDir, `preview-${templateId}`, templateId);
  return {
    outDir,
    sampleDataPath,
    ...generated,
  };
}

async function validateCandidateTemplate({
  metadata,
  schema,
  templateHtml,
}: {
  metadata: TemplateMetadata;
  schema: JsonObject;
  templateHtml: string;
}) {
  const shapeErrors = validateSchemaShape(schema);
  if (shapeErrors.length > 0) {
    throw new Error(`Invalid schema for template "${metadata.id}": ${shapeErrors.join("; ")}`);
  }

  const sampleData = buildSampleFromSchema(schema, deepClone(sampleQuote)) as JsonObject;
  const sampleErrors = validateSampleAgainstSchema(schema, sampleData);
  if (sampleErrors.length > 0) {
    throw new Error(`Sample data does not satisfy schema for "${metadata.id}": ${sampleErrors.join("; ")}`);
  }

  const placeholderKeys = validateTemplateRender(templateHtml, sampleData as QuoteInput);
  return { sampleData, placeholderKeys, sampleErrors };
}

function buildAuthoringMetadata(plan: AuthoringPlan): TemplateAuthoringMetadata {
  return {
    mode: "agent-first",
    prompt: plan.prompt,
    baseTemplateId: plan.baseTemplateId,
    directives: {
      accent: plan.theme.accent,
      "accent-strong": plan.theme.accentStrong,
      surface: plan.theme.surface,
      shell: plan.theme.shell,
      ink: plan.theme.ink,
      layout: plan.theme.layout,
      tone: plan.theme.toneLabel,
      "doc-title": plan.copy.docTitle,
      headline: plan.copy.headline,
      intro: plan.copy.intro,
      "callout-title": plan.copy.calloutTitle,
      "callout-body": plan.copy.calloutBody,
      "notes-title": plan.copy.notesTitle,
      "notes-body": plan.copy.notesBody,
      closing: plan.copy.closing,
      "add-field": plan.fields.add.map((field) => `${field.path}:${field.type}${field.required ? "!" : ""}`),
      "remove-field": plan.fields.remove,
      "require-field": plan.fields.require,
      "optional-field": plan.fields.optional,
    },
  };
}

export async function createTemplateFromPrompt(input: CreateTemplateFromPromptInput): Promise<AuthoredTemplateResult> {
  const plan = buildPlan(input.prompt, { name: input.name, description: input.description, baseTemplateId: input.baseTemplateId });
  const templateId = deriveId(input.id ?? getDirective(parsePrompt(input.prompt).directives, "id"), input.name ?? getDirective(parsePrompt(input.prompt).directives, "name"), parsePrompt(input.prompt).body);
  const templateName = input.name ?? getDirective(parsePrompt(input.prompt).directives, "name") ?? titleCaseFromSlug(templateId);
  const description = deriveDescription(input.description ?? getDirective(parsePrompt(input.prompt).directives, "description"), parsePrompt(input.prompt).body, templateName);
  const version = input.version ?? getDirective(parsePrompt(input.prompt).directives, "version") ?? "0.1.0";

  const baseTemplate = await loadTemplate(plan.baseTemplateId);
  const schema = applyPlanToSchema(baseTemplate.schema, plan, templateId, templateName);
  const templateHtml = buildTemplateHtml(plan);
  const metadata: TemplateMetadata = {
    id: templateId,
    name: templateName,
    description,
    version,
    authoring: buildAuthoringMetadata(plan),
  };

  const validation = await validateCandidateTemplate({ metadata, schema, templateHtml });
  const template = await createTemplate({
    id: templateId,
    name: templateName,
    description,
    version,
    schema,
    templateHtml,
    baseTemplateId: plan.baseTemplateId,
    authoring: metadata.authoring,
  });
  const preview = await createPreviewArtifacts(templateId, validation.sampleData, input.previewOutDir);
  return {
    template,
    preview,
    sampleData: validation.sampleData,
    validation: {
      placeholderKeys: validation.placeholderKeys,
      sampleErrors: validation.sampleErrors,
    },
  };
}

export async function patchTemplateFromPrompt(input: PatchTemplateFromPromptInput): Promise<AuthoredTemplateResult> {
  const template = await loadTemplate(input.id);
  const plan = buildPlan(input.prompt, { name: input.name, description: input.description, baseTemplateId: template.authoring?.baseTemplateId }, template);
  const templateName = input.name ?? getDirective(parsePrompt(input.prompt).directives, "name") ?? template.name;
  const description = deriveDescription(input.description ?? getDirective(parsePrompt(input.prompt).directives, "description"), parsePrompt(input.prompt).body, templateName);
  const version = input.version ?? getDirective(parsePrompt(input.prompt).directives, "version") ?? nextPatchVersion(template.version);
  const schema = applyPlanToSchema(template.schema, plan, template.id, templateName);
  const templateHtml = buildTemplateHtml(plan);
  const metadata: TemplateMetadata = {
    id: template.id,
    name: templateName,
    description,
    version,
    authoring: buildAuthoringMetadata(plan),
  };

  const validation = await validateCandidateTemplate({ metadata, schema, templateHtml });
  const patched = await patchTemplate({
    id: input.id,
    name: templateName,
    description,
    version,
    schema,
    templateHtml,
    authoring: metadata.authoring,
  });
  const preview = await createPreviewArtifacts(input.id, validation.sampleData, input.previewOutDir);
  return {
    template: patched,
    preview,
    sampleData: validation.sampleData,
    validation: {
      placeholderKeys: validation.placeholderKeys,
      sampleErrors: validation.sampleErrors,
    },
  };
}
