import { format } from "date-fns";
import { de } from "date-fns/locale";

export type QuoteInput = {
  offer_number: string;
  date: string;
  valid_until: string;
  recipient: {
    company: string;
    contact_person: string;
    street: string;
    zip_city: string;
  };
  license: {
    name: string;
    price_monthly: number;
    discount_percent?: number | null;
    discount_label?: string | null;
  };
  setup: {
    enabled: boolean;
    price: number;
    description: string;
  };
  sender: {
    company: string;
    address_line1: string;
    address_line2: string;
    country: string;
    ust_id: string;
    phone: string;
    email: string;
    web: string;
    signee: string;
  };
};

export type QuoteComputed = QuoteInput & {
  discountAmount: number;
  licenseTotal: number;
  setupTotal: number;
  sumNetFirstMonth: number;
  vatFirstMonth: number;
  totalFirstMonth: number;
  sumNetRecurring: number;
  vatRecurring: number;
  totalRecurring: number;
  dateLabel: string;
  validUntilLabel: string;
  firstMonthLabel: string;
  secondMonthLabel: string;
  modeLabel: string;
};

export const sampleQuote: QuoteInput = {
  offer_number: "42011",
  date: "2026-04-21",
  valid_until: "2026-05-05",
  recipient: {
    company: "belafarm Beetzer Landwirtschaftsgesellschaft mbH",
    contact_person: "Frau Gansewig",
    street: "Beetzer Dorfstr. 166 a",
    zip_city: "16766 Kremmen",
  },
  license: {
    name: "DAZE Professional",
    price_monthly: 129.0,
    discount_percent: 15,
    discount_label: "Einführungsrabatt",
  },
  setup: {
    enabled: true,
    price: 249,
    description:
      "Enthält Einrichtung, Stammdatenimport und Konfiguration für den operativen Start direkt nach der Testphase.",
  },
  sender: {
    company: "DAZE",
    address_line1: "Emil-Junghannß-Str. 5",
    address_line2: "09376 Oelsnitz/Erzgeb.",
    country: "Deutschland",
    ust_id: "DE 141316905",
    phone: "(+49) 17640418251",
    email: "support@dazeapp.de",
    web: "www.dazeapp.de",
    signee: "Max Mannstein",
  },
};

const euro = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

function monthLabel(dateIso: string, offset = 0) {
  const d = new Date(dateIso);
  d.setMonth(d.getMonth() + offset);
  return format(d, "MMMM yyyy", { locale: de });
}

export function money(value: number) {
  return euro.format(value);
}

export function computeQuote(input: QuoteInput): QuoteComputed {
  const discountPercent = input.license.discount_percent ?? 0;
  const discountAmount = input.license.price_monthly * (discountPercent / 100);
  const licenseTotal = +(input.license.price_monthly - discountAmount).toFixed(2);
  const setupTotal = input.setup.enabled ? input.setup.price : 0;
  const sumNetFirstMonth = +(licenseTotal + setupTotal).toFixed(2);
  const vatFirstMonth = +(sumNetFirstMonth * 0.19).toFixed(2);
  const totalFirstMonth = +(sumNetFirstMonth + vatFirstMonth).toFixed(2);
  const sumNetRecurring = +licenseTotal.toFixed(2);
  const vatRecurring = +(sumNetRecurring * 0.19).toFixed(2);
  const totalRecurring = +(sumNetRecurring + vatRecurring).toFixed(2);

  return {
    ...input,
    discountAmount: +discountAmount.toFixed(2),
    licenseTotal,
    setupTotal,
    sumNetFirstMonth,
    vatFirstMonth,
    totalFirstMonth,
    sumNetRecurring,
    vatRecurring,
    totalRecurring,
    dateLabel: format(new Date(input.date), "dd.MM.yyyy"),
    validUntilLabel: format(new Date(input.valid_until), "dd.MM.yyyy"),
    firstMonthLabel: monthLabel(input.date, 0),
    secondMonthLabel: monthLabel(input.date, 1),
    modeLabel: discountPercent > 0 ? "Rabatt-Angebot" : "Standard-Angebot",
  };
}
