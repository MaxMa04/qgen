import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <div className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-16">
        <section className="rounded-[2rem] bg-slate-950 px-8 py-12 text-white shadow-2xl">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-300">DAZE Quote Generator</p>
            <h1 className="mt-4 text-5xl font-bold leading-tight">Self-hosted Angebotsgenerator für DAZE.</h1>
            <p className="mt-5 text-lg leading-8 text-slate-300">
              Browser-Preview, PDF/DOCX/HTML-Export und CLI-Workflow für schnelle Test- und Live-Angebote.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/generate" className="rounded-full bg-blue-500 px-5 py-3 font-semibold text-white hover:bg-blue-400">
                Angebot generieren
              </Link>
              <Link href="/templates" className="rounded-full border border-white/15 px-5 py-3 font-semibold text-white hover:bg-white/5">
                Templates ansehen
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          {[
            ["Live Preview", "JSON links, echtes Angebots-Rendering rechts."],
            ["Exports", "PDF, DOCX und HTML direkt aus demselben Datenmodell."],
            ["CLI", "qgen generate für Automationen und später MCP."],
          ].map(([title, text]) => (
            <div key={title} className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
              <h2 className="text-xl font-bold">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
