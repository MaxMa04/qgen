"use client";

import { useMemo, useState } from "react";
import { QuotePreview } from "@/components/QuotePreview";
import { sampleQuote, type QuoteInput } from "@/lib/quote-shared";

export function QuoteGeneratorClient() {
  const [json, setJson] = useState(JSON.stringify(sampleQuote, null, 2));
  const parsed = useMemo(() => {
    try {
      return JSON.parse(json) as QuoteInput;
    } catch {
      return null;
    }
  }, [json]);

  const download = async (format: "html" | "pdf" | "docx") => {
    const response = await fetch(`/api/generate?format=${format}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: json,
    });

    if (!response.ok) {
      const text = await response.text();
      alert(`Export fehlgeschlagen: ${text}`);
      return;
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `angebot.${format}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid gap-8 xl:grid-cols-[520px_minmax(0,1fr)]">
      <section className="rounded-3xl bg-slate-950 p-6 text-white shadow-2xl ring-1 ring-white/10">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Quote JSON</h2>
            <p className="mt-1 text-sm text-slate-300">Schema-first Input, direkt editierbar.</p>
          </div>
        </div>
        <textarea
          value={json}
          onChange={(e) => setJson(e.target.value)}
          spellCheck={false}
          className="min-h-[680px] w-full rounded-2xl border border-white/10 bg-slate-900 p-4 font-mono text-sm outline-none ring-0"
        />
        <div className="mt-5 flex flex-wrap gap-3">
          <button onClick={() => download("pdf")} className="rounded-full bg-blue-500 px-4 py-2 font-semibold text-white hover:bg-blue-400">PDF exportieren</button>
          <button onClick={() => download("docx")} className="rounded-full bg-white px-4 py-2 font-semibold text-slate-900 hover:bg-slate-100">DOCX exportieren</button>
          <button onClick={() => download("html")} className="rounded-full border border-white/20 px-4 py-2 font-semibold text-white hover:bg-white/5">HTML exportieren</button>
        </div>
        {!parsed ? <p className="mt-4 text-sm text-amber-300">JSON ist gerade invalid.</p> : null}
      </section>
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-950">Live Preview</h2>
            <p className="text-sm text-slate-500">Browser-Preview des eingebauten Templates.</p>
          </div>
        </div>
        {parsed ? (
          <QuotePreview input={parsed} />
        ) : (
          <div className="rounded-3xl bg-white p-8 text-slate-500 shadow ring-1 ring-slate-200">Bitte gültiges JSON eingeben.</div>
        )}
      </section>
    </div>
  );
}
