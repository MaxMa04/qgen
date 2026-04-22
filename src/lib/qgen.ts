import fs from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import puppeteer from "puppeteer";
import { computeQuote, money, sampleQuote, type QuoteComputed, type QuoteInput } from "./quote-shared.ts";
import {
  createTemplate,
  defaultTemplateId,
  listTemplates,
  loadTemplate,
  patchTemplate,
  projectRoot,
  type TemplateDefinition,
} from "./template-registry.ts";

export const DEFAULT_TEMPLATE_ID = defaultTemplateId;

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function paragraph(text: string) {
  return `<w:p><w:r><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r></w:p>`;
}

function flattenContext(prefix: string, value: unknown, output: Record<string, string>) {
  if (value == null) {
    output[prefix] = "";
    return;
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    for (const [key, nestedValue] of Object.entries(value)) {
      const nestedPrefix = prefix ? `${prefix}.${key}` : key;
      flattenContext(nestedPrefix, nestedValue, output);
    }
    return;
  }

  output[prefix] = String(value);
}

function buildDiscountRowHtml(q: QuoteComputed) {
  if (q.discountAmount <= 0) {
    return "";
  }

  return `<tr>
        <td></td>
        <td>${escapeHtml(q.license.discount_label ?? "Kundenrabatt")} (${escapeHtml(String(q.license.discount_percent ?? 0))}%)</td>
        <td class="num">1</td>
        <td class="num">-${escapeHtml(money(q.discountAmount))}</td>
        <td class="num">-${escapeHtml(money(q.discountAmount))}</td>
      </tr>`;
}

function buildTemplateContext(q: QuoteComputed) {
  const context: Record<string, string> = {};
  flattenContext("", q, context);

  context["license.price_monthly_money"] = money(q.license.price_monthly);
  context["discountAmount_money"] = money(q.discountAmount);
  context["licenseTotal_money"] = money(q.licenseTotal);
  context["setupTotal_money"] = money(q.setupTotal);
  context["sumNetFirstMonth_money"] = money(q.sumNetFirstMonth);
  context["vatFirstMonth_money"] = money(q.vatFirstMonth);
  context["totalFirstMonth_money"] = money(q.totalFirstMonth);
  context["sumNetRecurring_money"] = money(q.sumNetRecurring);
  context["vatRecurring_money"] = money(q.vatRecurring);
  context["totalRecurring_money"] = money(q.totalRecurring);
  context["discount_row_html"] = buildDiscountRowHtml(q);

  return context;
}

function renderTemplateHtml(templateHtml: string, context: Record<string, string>) {
  const renderedRaw = templateHtml.replace(/\{\{\{\s*([\w.-]+)\s*\}\}\}/g, (_match, key) => context[key] ?? "");
  return renderedRaw.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (_match, key) => escapeHtml(context[key] ?? ""));
}

export function buildTemplateContextFromInput(input: QuoteInput) {
  return buildTemplateContext(computeQuote(input));
}

export function renderTemplateHtmlFromInput(templateHtml: string, input: QuoteInput) {
  return renderTemplateHtml(templateHtml, buildTemplateContextFromInput(input));
}

async function resolveTemplate(templateId = DEFAULT_TEMPLATE_ID) {
  return loadTemplate(templateId);
}

function buildDocxLines(q: QuoteComputed, template: TemplateDefinition) {
  return [
    `${template.name} - Angebot ${q.offer_number}`,
    `${q.recipient.company}`,
    `${q.recipient.contact_person}`,
    `${q.recipient.street}`,
    `${q.recipient.zip_city}`,
    "",
    `Lizenz ${q.license.name}: ${money(q.licenseTotal)} monatlich`,
    `Einrichtung: ${money(q.setupTotal)} einmalig`,
    `Gesamt erster Monat: ${money(q.totalFirstMonth)}`,
    `Wiederkehrend ab ${q.secondMonthLabel}: ${money(q.totalRecurring)}`,
    "",
    `Gültig bis ${q.validUntilLabel}`,
    `Freundliche Grüße, ${q.sender.signee}`,
  ];
}

export async function renderQuoteHtml(input: QuoteInput, templateId = DEFAULT_TEMPLATE_ID) {
  const [template, q] = await Promise.all([resolveTemplate(templateId), Promise.resolve(computeQuote(input))]);
  return renderTemplateHtml(template.templateHtml, buildTemplateContext(q));
}

export async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export async function writeHtmlFile(input: QuoteInput, outPath: string, templateId = DEFAULT_TEMPLATE_ID) {
  await ensureDir(path.dirname(outPath));
  const html = await renderQuoteHtml(input, templateId);
  await fs.writeFile(outPath, html, "utf8");
  return outPath;
}

export async function writePdfFile(input: QuoteInput, outPath: string, templateId = DEFAULT_TEMPLATE_ID) {
  await ensureDir(path.dirname(outPath));
  const html = await renderQuoteHtml(input, templateId);
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0" });
    await page.pdf({
      path: outPath,
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", right: "10mm", bottom: "12mm", left: "10mm" },
    });
  } finally {
    await browser.close();
  }
  return outPath;
}

export async function writeDocxFile(input: QuoteInput, outPath: string, templateId = DEFAULT_TEMPLATE_ID) {
  await ensureDir(path.dirname(outPath));
  const [template, q] = await Promise.all([resolveTemplate(templateId), Promise.resolve(computeQuote(input))]);
  const lines = buildDocxLines(q, template);

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" mc:Ignorable="w14 wp14">
    <w:body>
      ${lines.map(paragraph).join("\n")}
      <w:sectPr>
        <w:pgSz w:w="11906" w:h="16838"/>
        <w:pgMar w:top="1134" w:right="850" w:bottom="1134" w:left="850" w:header="708" w:footer="708" w:gutter="0"/>
      </w:sectPr>
    </w:body>
  </w:document>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
    <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
    <Default Extension="xml" ContentType="application/xml"/>
    <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  </Types>`;

  const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
  <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
    <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  </Relationships>`;

  const zip = new JSZip();
  zip.file("[Content_Types].xml", contentTypes);
  zip.file("_rels/.rels", rels);
  zip.file("word/document.xml", documentXml);
  const buffer = await zip.generateAsync({ type: "nodebuffer" });
  await fs.writeFile(outPath, buffer);
  return outPath;
}

export async function generateAllFormats(
  input: QuoteInput,
  outDir: string,
  baseName = `angebot-${input.offer_number}`,
  templateId = DEFAULT_TEMPLATE_ID,
) {
  await ensureDir(outDir);
  const htmlPath = path.join(outDir, `${baseName}.html`);
  const pdfPath = path.join(outDir, `${baseName}.pdf`);
  const docxPath = path.join(outDir, `${baseName}.docx`);

  await writeHtmlFile(input, htmlPath, templateId);
  await writePdfFile(input, pdfPath, templateId);
  await writeDocxFile(input, docxPath, templateId);
  return { htmlPath, pdfPath, docxPath };
}

export async function generateFromTemplate(
  templateId: string,
  input: QuoteInput,
  outDir: string,
  baseName = `angebot-${input.offer_number}`,
) {
  await loadTemplate(templateId);
  return generateAllFormats(input, outDir, baseName, templateId);
}

export async function loadQuoteFromFile(filePath: string) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as QuoteInput;
}

export async function saveSampleData(outDir: string) {
  await ensureDir(outDir);
  const dataPath = path.join(outDir, "sample-quote.json");
  await fs.writeFile(dataPath, JSON.stringify(sampleQuote, null, 2), "utf8");
  return dataPath;
}

export { computeQuote, createTemplate, listTemplates, loadTemplate, money, patchTemplate, projectRoot, renderTemplateHtml, sampleQuote };
export type { QuoteInput };
