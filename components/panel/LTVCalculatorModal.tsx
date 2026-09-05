import { useEffect, useState } from "react";
import { FiX } from "react-icons/fi";
import { inter } from "@/lib/fonts";

/**
 * Lifetime-value calculator, presented as a dashboard modal rather than its own nav page.
 *
 * It is a scratchpad — you open it, try some numbers, and close it — so it never justified a
 * permanent rail entry beside Clients and Email. Nothing here is persisted.
 */

function calculateLTV(input: {
  avgPurchaseValue: number;
  costOfGoodsPct: number;
  returnsPerYear: number;
  customerTermYears: number;
  numReferrals: number;
  numClients: number;
}) {
  const grossProfitPerPurchase = input.avgPurchaseValue * (1 - input.costOfGoodsPct / 100);
  const LTV =
    grossProfitPerPurchase * input.returnsPerYear * input.customerTermYears * (input.numReferrals + 1);
  const retainer = (LTV * input.numClients) / 2;
  return { LTV, retainer };
}

const LABEL = "block text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8B8598] mb-1.5";
const FIELD =
  "w-full bg-white rounded-lg px-3.5 py-2 text-[13px] text-[#111827] placeholder:text-[#9CA3AF] focus:ring-2 focus:ring-[#701CC0] outline-none transition-shadow";

const money = (n: number) => `$${Number.isFinite(n) ? Math.round(n).toLocaleString() : (0).toLocaleString()}`;

type Props = { open: boolean; onClose: () => void };

const LTVCalculatorModal: React.FC<Props> = ({ open, onClose }) => {
  const [averagePurchaseValue, setAveragePurchaseValue] = useState(0);
  const [costOfGoods, setCostOfGoods] = useState(0);
  const [numReferrals, setNumReferrals] = useState(0);
  const [returnsPerYear, setReturnsPerYear] = useState(0);
  const [customerTerm, setCustomerTerm] = useState(0);
  const [numClientsBroughtIn, setNumClientsBroughtIn] = useState(0);

  // Escape closes, and the page behind must not scroll while the sheet is up.
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

  if (!open) return null;

  const { LTV, retainer } = calculateLTV({
    avgPurchaseValue: averagePurchaseValue,
    costOfGoodsPct: costOfGoods,
    returnsPerYear,
    customerTermYears: customerTerm,
    numReferrals,
    numClients: numClientsBroughtIn,
  });

  const fields: Array<{
    label: string;
    value: number;
    set: (n: number) => void;
    prefix?: string;
    suffix?: string;
    max?: number;
  }> = [
    { label: "Average Purchase Value", value: averagePurchaseValue, set: setAveragePurchaseValue, prefix: "$" },
    { label: "Cost of Goods Sold", value: costOfGoods, set: setCostOfGoods, suffix: "%", max: 100 },
    { label: "Number of Referrals", value: numReferrals, set: setNumReferrals },
    { label: "Returns per Year", value: returnsPerYear, set: setReturnsPerYear },
    { label: "Customer Term (Years)", value: customerTerm, set: setCustomerTerm },
    { label: "Clients Brought In", value: numClientsBroughtIn, set: setNumClientsBroughtIn },
  ];

  return (
    <div
      className={`fixed inset-0 z-[120] flex items-center justify-center bg-black/45 backdrop-blur-sm p-4 ${inter.className}`}
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
        <div className="flex items-center justify-between border-b border-[#ECEAF1] px-5 py-3.5">
          <h2 className="text-lg font-semibold tracking-[-0.01em] text-[#111827]">LTV Calculator</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-[#6B7280] transition-colors hover:bg-black/5 hover:text-[#111827]"
          >
            <FiX className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 p-5 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div className="rounded-xl bg-[#F1EFF6] p-5">
            <h3 className="mb-4 text-[15px] font-semibold text-[#111827]">Input Values</h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {fields.map((field) => (
                <div key={field.label}>
                  <label className={LABEL}>{field.label}</label>
                  <div className="relative">
                    {field.prefix ? (
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] text-[#6B7280]">
                        {field.prefix}
                      </span>
                    ) : null}
                    <input
                      type="number"
                      min={0}
                      max={field.max}
                      placeholder="0"
                      value={field.value || ""}
                      onChange={(event) => field.set(Number(event.target.value) || 0)}
                      className={`${FIELD} ${field.prefix ? "pl-8" : ""} ${field.suffix ? "pr-9" : ""}`}
                    />
                    {field.suffix ? (
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-[#6B7280]">
                        {field.suffix}
                      </span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Results keep the brand gradient as their surface; the figures are white on it,
              because a #701CC0 number on a #701CC0 ground is invisible. */}
          <div className="rounded-xl bg-gradient-to-br from-[#701CC0] to-[#8F42FF] p-5 text-white">
            <h3 className="mb-4 text-[15px] font-semibold text-white">Results</h3>
            <div>
              <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-white/70">
                Lifetime Value
              </div>
              <div className="text-[28px] font-semibold leading-none tracking-[-0.02em] text-white">{money(LTV)}</div>
            </div>
            <div className="mt-4 border-t border-white/25 pt-4">
              <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-white/70">
                Retainer Pricing
              </div>
              <div className="text-[28px] font-semibold leading-none tracking-[-0.02em] text-white">
                {money(retainer)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LTVCalculatorModal;
