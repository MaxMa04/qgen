import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

type JsonObject = Record<string, unknown>;

export type TemplateAuthoringMetadata = {
  mode: "agent-first";
  prompt: string;
  baseTemplateId: string;
  directives?: Record<string, unknown>;
};

export type TemplateMetadata = {
  id: string;
  name: string;
  description: string;
  version: string;
  authoring?: TemplateAuthoringMetadata;
};

export type TemplateRegistryEntry = TemplateMetadata & {
  directoryPath: string;
  metadataPath: string;
  schemaPath: string;
  templatePath: string;
};

export type TemplateDefinition = TemplateRegistryEntry & {
  schema: JsonObject;
  templateHtml: string;
};

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const templatesRoot = path.join(projectRoot, "templates");
export const defaultTemplateId = "daze-standard";

type CreateTemplateInput = {
  id: string;
  name: string;
  description: string;
  version?: string;
  schema?: JsonObject;
  templateHtml?: string;
  baseTemplateId?: string;
  authoring?: TemplateAuthoringMetadata;
};

type PatchTemplateInput = {
  id: string;
  name?: string;
  description?: string;
  version?: string;
  schema?: JsonObject;
  templateHtml?: string;
  authoring?: TemplateAuthoringMetadata;
};

async function readJsonFile<T>(filePath: string) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

function buildTemplateEntry(templateId: string, metadata: TemplateMetadata): TemplateRegistryEntry {
  const directoryPath = path.join(templatesRoot, templateId);
  return {
    ...metadata,
    directoryPath,
    metadataPath: path.join(directoryPath, "metadata.json"),
    schemaPath: path.join(directoryPath, "schema.json"),
    templatePath: path.join(directoryPath, "template.html"),
  };
}

function getTemplateDirectoryPath(templateId: string) {
  return path.join(templatesRoot, templateId);
}

function validateTemplateId(templateId: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(templateId)) {
    throw new Error(`Invalid template id "${templateId}". Use lowercase kebab-case.`);
  }
}

async function writeJsonFile(filePath: string, value: JsonObject) {
  await fs.writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function normalizeCopiedSchema(schema: JsonObject, templateId: string, templateName: string) {
  return {
    ...schema,
    $id: `qgen://templates/${templateId}/schema.json`,
    title: `${templateName} Input`,
  } satisfies JsonObject;
}

export async function listTemplates() {
  const entries = await fs.readdir(templatesRoot, { withFileTypes: true });
  const directories = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();

  return Promise.all(
    directories.map(async (templateId) => {
      const metadataPath = path.join(templatesRoot, templateId, "metadata.json");
      const metadata = await readJsonFile<TemplateMetadata>(metadataPath);
      return buildTemplateEntry(templateId, metadata);
    }),
  );
}

export async function loadTemplate(templateId: string) {
  const directoryPath = getTemplateDirectoryPath(templateId);
  const metadataPath = path.join(directoryPath, "metadata.json");
  const schemaPath = path.join(directoryPath, "schema.json");
  const templateFilePath = path.join(directoryPath, "template.html");

  try {
    const [metadata, schema, templateHtml] = await Promise.all([
      readJsonFile<TemplateMetadata>(metadataPath),
      readJsonFile<JsonObject>(schemaPath),
      fs.readFile(templateFilePath, "utf8"),
    ]);

    return {
      ...buildTemplateEntry(templateId, metadata),
      schema,
      templateHtml,
    } satisfies TemplateDefinition;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Unable to load template "${templateId}": ${message}`);
  }
}

export async function createTemplate({
  id,
  name,
  description,
  version = "0.1.0",
  schema,
  templateHtml,
  baseTemplateId = defaultTemplateId,
  authoring,
}: CreateTemplateInput) {
  validateTemplateId(id);
  const directoryPath = getTemplateDirectoryPath(id);

  try {
    await fs.access(directoryPath);
    throw new Error(`Template "${id}" already exists.`);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  let resolvedSchema = schema;
  let resolvedTemplateHtml = templateHtml;

  if (!resolvedSchema || !resolvedTemplateHtml) {
    const baseTemplate = await loadTemplate(baseTemplateId);
    resolvedSchema ??= normalizeCopiedSchema(baseTemplate.schema, id, name);
    resolvedTemplateHtml ??= baseTemplate.templateHtml;
  }

  await fs.mkdir(directoryPath, { recursive: true });
  await Promise.all([
    writeJsonFile(path.join(directoryPath, "metadata.json"), {
      id,
      name,
      description,
      version,
      ...(authoring ? { authoring } : {}),
    }),
    writeJsonFile(path.join(directoryPath, "schema.json"), resolvedSchema),
    fs.writeFile(path.join(directoryPath, "template.html"), resolvedTemplateHtml, "utf8"),
  ]);

  return loadTemplate(id);
}

export async function patchTemplate({ id, name, description, version, schema, templateHtml, authoring }: PatchTemplateInput) {
  validateTemplateId(id);
  const template = await loadTemplate(id);

  const nextMetadata = {
    id,
    name: name ?? template.name,
    description: description ?? template.description,
    version: version ?? template.version,
    authoring: authoring ?? template.authoring,
  } satisfies TemplateMetadata;

  await Promise.all([
    writeJsonFile(template.metadataPath, nextMetadata),
    schema ? writeJsonFile(template.schemaPath, schema) : Promise.resolve(),
    templateHtml != null ? fs.writeFile(template.templatePath, templateHtml, "utf8") : Promise.resolve(),
  ]);

  return loadTemplate(id);
}
