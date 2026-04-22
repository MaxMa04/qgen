import { computeQuote, money, type QuoteInput } from "@/lib/quote-shared";

export function QuotePreview({ input }: { input: QuoteInput }) {
  const q = computeQuote(input);

  return (
    <div className="bg-white text-slate-800 shadow-xl ring-1 ring-slate-200 rounded-3xl p-8 md:p-10">
      <div className="flex flex-col gap-8">
        <div className="flex items-start justify-between gap-6">
          <div>
            <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-blue-700">
              {q.modeLabel}
            </span>
            <h1 className="mt-3 text-4xl font-bold tracking-[0.18em] text-slate-900">DAZE</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              {q.sender.address_line1}
              <br />
              {q.sender.address_line2}
              <br />
              {q.sender.country}
              <br />
              USt-IdNr.: {q.sender.ust_id}
            </p>
          </div>
          <div className="text-right text-sm leading-6 text-slate-500">
            <p className="font-semibold text-slate-800">{q.recipient.company}</p>
            <p>{q.recipient.contact_person}</p>
            <p>{q.recipient.street}</p>
            <p>{q.recipient.zip_city}</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {[
            ["Angebotsnummer", q.offer_number],
            ["Datum", q.dateLabel],
            ["Gültig bis", q.validUntilLabel],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <div className="text-xs uppercase tracking-[0.14em] text-slate-500">{label}</div>
              <div className="mt-2 text-lg font-bold text-slate-900">{value}</div>
            </div>
          ))}
        </div>

        <div>
          <h2 className="text-3xl font-bold text-slate-900">Angebot für {q.recipient.company}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Vielen Dank für Ihr Interesse an DAZE. Nachfolgend finden Sie unser Angebot für Lizenz,
            Einrichtung und den produktiven Start Ihres Teams.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl ring-1 ring-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Pos</th>
                <th className="px-4 py-3">Bezeichnung</th>
                <th className="px-4 py-3 text-right">Menge</th>
                <th className="px-4 py-3 text-right">Einzel</th>
                <th className="px-4 py-3 text-right">Gesamt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              <tr>
                <td className="px-4 py-4">1</td>
                <td className="px-4 py-4">
                  Lizenz DAZE {q.license.name}
                  <div className="text-xs text-slate-500">monatlich zu zahlen</div>
                </td>
                <td className="px-4 py-4 text-right">1</td>
                <td className="px-4 py-4 text-right">{money(q.license.price_monthly)}</td>
                <td className="px-4 py-4 text-right">{money(q.licenseTotal)}</td>
              </tr>
              {q.discountAmount > 0 ? (
                <tr>
                  <td className="px-4 py-4"></td>
                  <td className="px-4 py-4">{q.license.discount_label ?? "Kundenrabatt"}</td>
                  <td className="px-4 py-4 text-right">1</td>
                  <td className="px-4 py-4 text-right">-{money(q.discountAmount)}</td>
                  <td className="px-4 py-4 text-right">-{money(q.discountAmount)}</td>
                </tr>
              ) : null}
              <tr>
                <td className="px-4 py-4">2</td>
                <td className="px-4 py-4">
                  Einrichtungskosten*
                  <div className="text-xs text-slate-500">{q.setup.description}</div>
                </td>
                <td className="px-4 py-4 text-right">1</td>
                <td className="px-4 py-4 text-right">{money(q.setupTotal)}</td>
                <td className="px-4 py-4 text-right">{money(q.setupTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="ml-auto w-full max-w-sm rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200">
          <div className="flex justify-between border-b border-slate-200 py-2 text-sm"><span>Netto {q.firstMonthLabel}</span><span>{money(q.sumNetFirstMonth)}</span></div>
          <div className="flex justify-between border-b border-slate-200 py-2 text-sm"><span>USt 19%</span><span>{money(q.vatFirstMonth)}</span></div>
          <div className="flex justify-between border-b border-slate-200 py-2 text-lg font-bold"><span>Erster Monat</span><span>{money(q.totalFirstMonth)}</span></div>
          <div className="flex justify-between border-b border-slate-200 py-2 pt-5 text-sm"><span>Netto ab {q.secondMonthLabel}</span><span>{money(q.sumNetRecurring)}</span></div>
          <div className="flex justify-between border-b border-slate-200 py-2 text-sm"><span>USt 19%</span><span>{money(q.vatRecurring)}</span></div>
          <div className="flex justify-between py-2 text-lg font-bold"><span>Wiederkehrend</span><span>{money(q.totalRecurring)}</span></div>
        </div>
      </div>
    </div>
  );
}
