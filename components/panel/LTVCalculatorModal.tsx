import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { inter } from "@/lib/fonts";

/**
 * Lifetime-value calculator, presented as a dashboard modal rather than its own nav page.
 *
 * It is a scratchpad — open it, try some numbers, close it — so nothing is persisted and the
 * sheet leads with the figure you came for rather than the form you have to fill in.
 */

type FieldKey =
  | "averagePurchaseValue"
  | "costOfGoods"
  | "returnsPerYear"
  | "customerTerm"
  | "numReferrals"
  | "numClients";

type FieldDef = {
  key: FieldKey;
  label: string;
  prefix?: string;
  suffix?: string;
  max?: number;
};

/**
 * Ordered so the form reads as a sentence: what a purchase is worth, what it costs, how often it
 * repeats, for how long, and how far it multiplies. Grouped rather than a flat six-up grid,
 * because the first two describe one purchase and the rest describe the relationship.
 */
const GROUPS: Array<{ title: string; fields: FieldDef[] }> = [
  {
    title: "Per purchase",
    fields: [
      { key: "averagePurchaseValue", label: "Average Purchase Value", prefix: "$" },
      { key: "costOfGoods", label: "Cost of Goods Sold", suffix: "%", max: 100 },
    ],
  },
  {
    title: "Over the relationship",
    fields: [
      { key: "returnsPerYear", label: "Purchases per Year" },
      { key: "customerTerm", label: "Customer Term", suffix: "Years" },
    ],
  },
  {
    title: "Multipliers",
    fields: [
      { key: "numReferrals", label: "Referrals per Customer" },
      { key: "numClients", label: "Clients Brought In" },
    ],
  },
];

const EMPTY: Record<FieldKey, number> = {
  averagePurchaseValue: 0,
  costOfGoods: 0,
  returnsPerYear: 0,
  customerTerm: 0,
  numReferrals: 0,
  numClients: 0,
};

const money = (n: number) =>
  `$${Number.isFinite(n) ? Math.round(n).toLocaleString() : (0).toLocaleString()}`;

type Props = { open: boolean; onClose: () => void };

const LTVCalculatorModal: React.FC<Props> = ({ open, onClose }) => {
  const [values, setValues] = useState<Record<FieldKey, number>>(EMPTY);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  const { ltv, retainer, grossMargin } = useMemo(() => {
    const grossPerPurchase = values.averagePurchaseValue * (1 - values.costOfGoods / 100);
    const value =
      grossPerPurchase * values.returnsPerYear * values.customerTerm * (values.numReferrals + 1);
    return {
      ltv: value,
      retainer: (value * values.numClients) / 2,
      grossMargin: grossPerPurchase,
    };
  }, [values]);

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 z-[120] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 ${inter.className}`}
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-[0_24px_60px_-18px_rgba(16,24,40,0.45)]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="LTV calculator"
      >
        {/* No divider under the header: the tinted input card already separates it from the
            body, and the rule on top of that read as a seam. */}
        <header className="flex items-center justify-between gap-4 px-6 pt-5 pb-1">
          <h2 className="text-[22px] font-semibold tracking-[-0.02em] text-[#111827]">LTV Calculator</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-2 rounded-lg text-[#6B7280] hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* items-stretch, so the results panel ends level with the inputs instead of running past
            them to the sheet's edge. */}
        <div className="grid grid-cols-1 items-stretch gap-5 p-6 lg:grid-cols-[minmax(0,1fr)_248px]">
          <div className="space-y-5">
            {GROUPS.map((group) => (
              <fieldset key={group.title}>
                <legend className="mb-2.5 text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[#8B8598]">
                  {group.title}
                </legend>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {group.fields.map((field) => (
                    <label key={field.key} className="block">
                      <span className="mb-1 block text-[12.5px] font-medium text-[#374151]">{field.label}</span>
                      <span className="relative block">
                        {field.prefix ? (
                          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-[#9CA3AF]">
                            {field.prefix}
                          </span>
                        ) : null}
                        <input
                          type="number"
                          min={0}
                          max={field.max}
                          placeholder="0"
                          value={values[field.key] || ""}
                          onChange={(event) =>
                            setValues((prev) => ({ ...prev, [field.key]: Number(event.target.value) || 0 }))
                          }
                          className={`h-9 w-full rounded-lg border border-[#E5E7EB] bg-white text-[13px] text-[#111827] placeholder:text-[#C7C4D2] transition-shadow focus:border-[#701CC0] focus:ring-2 focus:ring-[#701CC0]/25 focus:outline-none ${
                            field.prefix ? "pl-7" : "pl-3"
                          } ${field.suffix ? (field.suffix.length > 1 ? "pr-16" : "pr-8") : "pr-3"}`}
                        />
                        {field.suffix ? (
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-[#9CA3AF]">
                            {field.suffix}
                          </span>
                        ) : null}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>

          {/* Lifetime value is what you opened this for, so it leads; retainer and margin are
              supporting numbers and are sized as such. */}
          <aside className="flex flex-col rounded-xl bg-gradient-to-br from-[#701CC0] to-[#8F42FF] p-5 text-white">
            <div className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-white/70">
              Lifetime Value
            </div>
            <div className="mt-1.5 text-[34px] font-semibold leading-none tracking-[-0.03em] tabular-nums">
              {money(ltv)}
            </div>

            <div className="mt-5 border-t border-white/20 pt-4">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-white/70">
                Retainer Pricing
              </div>
              <div className="mt-1 text-[20px] font-semibold leading-none tracking-[-0.02em] tabular-nums">
                {money(retainer)}
              </div>
            </div>

            <div className="mt-4 border-t border-white/20 pt-4">
              <div className="text-[10.5px] font-semibold uppercase tracking-[0.07em] text-white/70">
                Gross per Purchase
              </div>
              <div className="mt-1 text-[20px] font-semibold leading-none tracking-[-0.02em] tabular-nums">
                {money(grossMargin)}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default LTVCalculatorModal;
