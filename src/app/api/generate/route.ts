import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";
import { sampleQuote, writeDocxFile, writeHtmlFile, writePdfFile, type QuoteInput } from "@/lib/qgen";
import { loadTemplate } from "@/lib/template-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "pdf";
  const templateId = url.searchParams.get("template") ?? "daze-standard";
  const input = ((await request.json().catch(() => sampleQuote)) ?? sampleQuote) as QuoteInput;
  const safeName = `angebot-${input.offer_number}`;
  const tempDir = path.join(process.cwd(), ".tmp-exports");

  try {
    await loadTemplate(templateId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return new Response(message, { status: 400 });
  }

  if (format === "html") {
    const filePath = path.join(tempDir, `${safeName}.html`);
    await writeHtmlFile(input, filePath, templateId);
    const buffer = await fs.readFile(filePath);
    return new Response(buffer, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename=${safeName}.html`,
      },
    });
  }

  if (format === "docx") {
    const filePath = path.join(tempDir, `${safeName}.docx`);
    await writeDocxFile(input, filePath, templateId);
    const buffer = await fs.readFile(filePath);
    return new Response(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename=${safeName}.docx`,
      },
    });
  }

  const filePath = path.join(tempDir, `${safeName}.pdf`);
  await writePdfFile(input, filePath, templateId);
  const buffer = await fs.readFile(filePath);
  return new Response(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=${safeName}.pdf`,
    },
  });
}
