#!/usr/bin/env node
import { Command } from "commander";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const libUrl = pathToFileURL(path.join(root, "src/lib/qgen.ts")).href;
const authoringUrl = pathToFileURL(path.join(root, "src/lib/template-authoring.ts")).href;
const qgen = await import(libUrl);
const authoring = await import(authoringUrl);

const program = new Command();
program.name("qgen").description("DAZE Quote Generator CLI");

async function readJson(filePath) {
  const raw = await fs.readFile(path.resolve(filePath), "utf8");
  return JSON.parse(raw);
}

async function readText(filePath) {
  return fs.readFile(path.resolve(filePath), "utf8");
}

async function resolvePrompt(options) {
  if (options.prompt) {
    return options.prompt;
  }

  if (options.promptFile) {
    return readText(options.promptFile);
  }

  throw new Error("Provide either --prompt or --prompt-file.");
}

async function runGenerate(options) {
  const input = await qgen.loadQuoteFromFile(path.resolve(options.data));
  const result = await qgen.generateFromTemplate(
    options.template,
    input,
    path.resolve(options.out),
    options.baseName ?? `angebot-${input.offer_number}`,
  );
  console.log(JSON.stringify(result, null, 2));
}

program
  .command("list-templates")
  .action(async () => {
    const templates = await qgen.listTemplates();
    console.log(JSON.stringify(templates, null, 2));
  });

program
  .command("create-template")
  .requiredOption("--id <id>")
  .requiredOption("--name <name>")
  .requiredOption("--description <text>")
  .option("--version <version>", "template version", "0.1.0")
  .option("--from <id>", "copy schema/template from an existing template", qgen.DEFAULT_TEMPLATE_ID)
  .option("--schema-file <file>", "override schema with a JSON file")
  .option("--html-file <file>", "override html with a template file")
  .action(async (options) => {
    const created = await qgen.createTemplate({
      id: options.id,
      name: options.name,
      description: options.description,
      version: options.version,
      baseTemplateId: options.from,
      schema: options.schemaFile ? await readJson(options.schemaFile) : undefined,
      templateHtml: options.htmlFile ? await readText(options.htmlFile) : undefined,
    });
    console.log(JSON.stringify(created, null, 2));
  });

program
  .command("patch-template")
  .requiredOption("--template <id>")
  .option("--name <name>")
  .option("--description <text>")
  .option("--version <version>")
  .option("--schema-file <file>", "replace schema from a JSON file")
  .option("--html-file <file>", "replace html from a template file")
  .action(async (options) => {
    if (!options.name && !options.description && !options.version && !options.schemaFile && !options.htmlFile) {
      throw new Error("patch-template requires at least one change.");
    }

    const patched = await qgen.patchTemplate({
      id: options.template,
      name: options.name,
      description: options.description,
      version: options.version,
      schema: options.schemaFile ? await readJson(options.schemaFile) : undefined,
      templateHtml: options.htmlFile ? await readText(options.htmlFile) : undefined,
    });
    console.log(JSON.stringify(patched, null, 2));
  });

program
  .command("create-template-from-prompt")
  .requiredOption("--id <id>")
  .option("--name <name>")
  .option("--description <text>")
  .option("--version <version>")
  .option("--from <id>", "base template", qgen.DEFAULT_TEMPLATE_ID)
  .option("--prompt <text>", "inline authoring prompt")
  .option("--prompt-file <file>", "authoring prompt from file")
  .option("--out <dir>", "preview output directory")
  .action(async (options) => {
    const prompt = await resolvePrompt(options);
    const result = await authoring.createTemplateFromPrompt({
      id: options.id,
      name: options.name,
      description: options.description,
      version: options.version,
      prompt,
      baseTemplateId: options.from,
      previewOutDir: options.out ? path.resolve(options.out) : undefined,
    });
    console.log(JSON.stringify(result, null, 2));
  });

program
  .command("patch-template-from-prompt")
  .requiredOption("--template <id>")
  .option("--name <name>")
  .option("--description <text>")
  .option("--version <version>")
  .option("--prompt <text>", "inline authoring prompt")
  .option("--prompt-file <file>", "authoring prompt from file")
  .option("--out <dir>", "preview output directory")
  .action(async (options) => {
    const prompt = await resolvePrompt(options);
    const result = await authoring.patchTemplateFromPrompt({
      id: options.template,
      name: options.name,
      description: options.description,
      version: options.version,
      prompt,
      previewOutDir: options.out ? path.resolve(options.out) : undefined,
    });
    console.log(JSON.stringify(result, null, 2));
  });

program
  .command("generate-from-template")
  .alias("generate")
  .requiredOption("--template <id>")
  .requiredOption("--data <file>")
  .option("--out <dir>", "output directory", path.join(root, "generated"))
  .option("--base-name <name>", "override output filename base")
  .action(runGenerate);

program.parseAsync(process.argv);
