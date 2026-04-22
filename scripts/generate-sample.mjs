import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const qgen = await import(pathToFileURL(path.join(root, "src/lib/qgen.ts")).href);

const outDir = path.join(root, "generated");
const dataPath = await qgen.saveSampleData(outDir);
const result = await qgen.generateAllFormats(
  qgen.sampleQuote,
  outDir,
  `angebot-${qgen.sampleQuote.offer_number}`,
  "daze-standard",
);
console.log(JSON.stringify({ dataPath, ...result }, null, 2));
