import { listTemplates } from "@/lib/template-registry";

export default async function TemplatesPage() {
  const templates = await listTemplates();

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-16 text-slate-950">
      <div className="mx-auto max-w-5xl">
        <h1 className="text-4xl font-bold">Templates</h1>
        <p className="mt-3 text-slate-600">Filesystem-Templates mit `metadata.json`, `schema.json` und `template.html` als gemeinsame Registry für App und CLI.</p>

        <div className="mt-10 grid gap-6">
          {templates.map((template) => (
            <article key={template.id} className="rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">{template.id}</p>
                  <h2 className="mt-2 text-2xl font-bold">{template.name}</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{template.description}</p>
                </div>
                <div className="rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">v{template.version}</div>
              </div>
              <div className="mt-5 grid gap-2 text-sm text-slate-500 md:grid-cols-3">
                <div>metadata: <span className="font-mono text-slate-700">metadata.json</span></div>
                <div>schema: <span className="font-mono text-slate-700">schema.json</span></div>
                <div>html: <span className="font-mono text-slate-700">template.html</span></div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
