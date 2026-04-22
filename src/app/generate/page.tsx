import { loadTemplate } from "@/lib/template-registry";
import { QuoteGeneratorClient } from "@/components/QuoteGeneratorClient";

export default async function GeneratePage() {
  const template = await loadTemplate("daze-standard");

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10 text-slate-950">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-700">{template.id}</p>
          <h1 className="mt-3 text-4xl font-bold">Angebot generieren</h1>
          <p className="mt-2 text-slate-600">{template.description}</p>
        </div>
        <QuoteGeneratorClient />
      </div>
    </main>
  );
}
