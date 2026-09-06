import { useState } from "react"
import { inter } from "@/lib/fonts";
import { calculateLtv, sanitizeNonNegative, sanitizePercent } from "@/lib/ltv/calculate";

const money = (n: number) => n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });

const FIELDS = [
    { key: "averagePurchaseValue", label: "Average Purchase Value", unit: "$", percent: false },
    { key: "costOfGoods", label: "Cost of Goods/Services Sold", unit: "%", percent: true },
    { key: "numReferrals", label: "Number of Referrals", unit: "per customer", percent: false },
    { key: "returnsPerYear", label: "Returns per Year", unit: "purchases/year", percent: false },
    { key: "customerTerm", label: "Customer Term", unit: "years", percent: false },
    { key: "numClientsBroughtIn", label: "Number of Clients Brought In", unit: "clients", percent: false },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"];

const EMPTY: Record<FieldKey, string> = {
    averagePurchaseValue: "",
    costOfGoods: "",
    numReferrals: "",
    returnsPerYear: "",
    customerTerm: "",
    numClientsBroughtIn: "",
};

// A fixed worked example next to the live formula, so the assumptions read the same regardless
// of whatever values are currently in the form.
const EXAMPLE = { averagePurchaseValue: 500, costOfGoods: 20, numReferrals: 1, returnsPerYear: 2, customerTerm: 3, numClientsBroughtIn: 4 };
const exampleResult = calculateLtv({
    averagePurchaseValue: EXAMPLE.averagePurchaseValue,
    costOfGoodsPercent: EXAMPLE.costOfGoods,
    numReferrals: EXAMPLE.numReferrals,
    returnsPerYear: EXAMPLE.returnsPerYear,
    customerTermYears: EXAMPLE.customerTerm,
    numClientsBroughtIn: EXAMPLE.numClientsBroughtIn,
});

const LTVCalculatorSection = () => {
    const [values, setValues] = useState<Record<FieldKey, string>>(EMPTY);
    const [copyStatus, setCopyStatus] = useState("");

    const setField = (key: FieldKey, raw: string) => {
        setCopyStatus("");
        setValues((prev) => ({ ...prev, [key]: raw }));
    };

    const costOfGoodsPercent = sanitizePercent(values.costOfGoods);
    const costOfGoodsOutOfRange = values.costOfGoods.trim() !== "" && (Number(values.costOfGoods) < 0 || Number(values.costOfGoods) > 100);

    const { ltv, retainer } = calculateLtv({
        averagePurchaseValue: sanitizeNonNegative(values.averagePurchaseValue),
        costOfGoodsPercent,
        numReferrals: sanitizeNonNegative(values.numReferrals),
        returnsPerYear: sanitizeNonNegative(values.returnsPerYear),
        customerTermYears: sanitizeNonNegative(values.customerTerm),
        numClientsBroughtIn: sanitizeNonNegative(values.numClientsBroughtIn),
    });

    const reset = () => {
        setValues(EMPTY);
        setCopyStatus("");
    };

    const copySummary = async () => {
        const lines = [
            "LTV Calculator summary",
            ...FIELDS.map((f) => `${f.label}: ${values[f.key].trim() || "0"} ${f.unit}`),
            `Lifetime Value: ${money(ltv)}`,
            `Retainer Pricing: ${money(retainer)}`,
            "Formula: LTV = Average Purchase Value x (1 - Cost of Goods %) x Returns per Year x Customer Term (years) x (Referrals + 1). Retainer = LTV x Clients Brought In / 2.",
            "Retainer Pricing is a suggested starting point based on these assumptions, not a guaranteed outcome.",
        ];
        try {
            await navigator.clipboard.writeText(lines.join("\n"));
            setCopyStatus("Copied summary, including inputs and assumptions.");
        } catch {
            setCopyStatus("Could not copy the summary. Try selecting and copying manually.");
        }
    };

    return (
        <div className={`w-full h-full bg-white text-[#111014] flex flex-col overflow-y-auto ${inter.className}`}>
            <div className="flex-1 flex justify-center px-6 pt-2">
                <div className="mx-auto w-full max-w-[1680px] flex flex-col h-full pb-10">
                    <div className="w-full flex justify-between items-center mb-2 flex-wrap gap-2">
                        <h1 className="text-2xl font-semibold text-[#111827] mt-6 mb-6">LTV Calculator</h1>
                        <button type="button" onClick={reset} className="mt-6 mb-6 rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm font-medium text-[#374151] hover:bg-gray-50">
                            Reset
                        </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">

                        <div className="lg:col-span-2 space-y-6">
                            <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] p-6">
                                <h2 className="text-lg font-semibold text-[#111827] mb-6">Input Values</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    {FIELDS.map((field) => (
                                        <div key={field.key}>
                                            <label htmlFor={`ltv-${field.key}`} className="block text-sm font-medium text-[#374151] mb-2">
                                                {field.label} <span className="font-normal text-[#9CA3AF]">({field.unit})</span>
                                            </label>
                                            <div className="relative">
                                                {field.unit === "$" && (
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#6B7280]">$</span>
                                                )}
                                                <input
                                                    id={`ltv-${field.key}`}
                                                    type="number"
                                                    inputMode="decimal"
                                                    className={`w-full bg-white border rounded-lg py-2.5 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:ring-2 focus:ring-[#701CC0] focus:border-[#701CC0] outline-none transition-colors ${field.unit === "$" ? "pl-9 pr-4" : field.percent ? "px-4 pr-10" : "px-4"} ${field.percent && costOfGoodsOutOfRange ? "border-amber-400" : "border-[#E5E7EB]"}`}
                                                    value={values[field.key]}
                                                    onChange={(e) => setField(field.key, e.target.value)}
                                                    min={0}
                                                    max={field.percent ? 100 : undefined}
                                                    placeholder="0"
                                                    aria-describedby={field.percent ? `ltv-${field.key}-hint` : undefined}
                                                />
                                                {field.percent && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#6B7280]">%</span>}
                                            </div>
                                            {field.percent && (
                                                <p id={`ltv-${field.key}-hint`} className={`mt-1 text-xs ${costOfGoodsOutOfRange ? "text-amber-600" : "text-[#9CA3AF]"}`}>
                                                    {costOfGoodsOutOfRange ? `Used as ${costOfGoodsPercent}% — values are kept within 0-100%.` : "Must be between 0 and 100."}
                                                </p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-[#F9FAFB] rounded-xl border border-[#E5E7EB] p-6 text-sm text-[#374151]">
                                <h2 className="text-base font-semibold text-[#111827] mb-3">How this is calculated</h2>
                                <p className="mb-1"><span className="font-medium">Lifetime Value</span> = Average Purchase Value x (1 - Cost of Goods %) x Returns per Year x Customer Term (years) x (Referrals + 1)</p>
                                <p className="mb-4"><span className="font-medium">Retainer Pricing</span> = Lifetime Value x Number of Clients Brought In / 2</p>
                                <p className="text-xs text-[#6B7280]">
                                    Worked example — {money(EXAMPLE.averagePurchaseValue)} purchase, {EXAMPLE.costOfGoods}% cost of goods, {EXAMPLE.numReferrals} referral, {EXAMPLE.returnsPerYear} returns/year, {EXAMPLE.customerTerm}-year term, {EXAMPLE.numClientsBroughtIn} clients brought in
                                    → Lifetime Value {money(exampleResult.ltv)}, Retainer Pricing {money(exampleResult.retainer)}.
                                </p>
                                <p className="mt-3 text-xs text-[#9CA3AF]">
                                    Retainer Pricing is a suggested starting point based on these assumptions, not a guaranteed outcome.
                                </p>
                            </div>
                        </div>


                        <div className="lg:col-span-1">
                            <div className="bg-gradient-to-br from-[#701CC0] to-[#8F42FF] rounded-xl shadow-lg p-6 text-white sticky top-6">
                                <h2 className="text-lg font-semibold mb-6">Calculated Results</h2>
                                <div className="space-y-6">
                                    <div>
                                        <div className="text-sm font-medium text-white/80 mb-2">Lifetime Value</div>
                                        <div className="text-3xl font-bold">{money(ltv)}</div>
                                    </div>
                                    <div className="pt-4 border-t border-white/20">
                                        <div className="text-sm font-medium text-white/80 mb-2">Retainer Pricing</div>
                                        <div className="text-3xl font-bold">{money(retainer)}</div>
                                        <p className="mt-1 text-xs text-white/70">A suggested starting point, not a guaranteed outcome.</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => void copySummary()}
                                    className="mt-6 w-full rounded-lg bg-white/15 px-3 py-2.5 text-sm font-medium text-white hover:bg-white/25 transition-colors"
                                >
                                    Copy summary
                                </button>
                                {copyStatus && <p role="status" className="mt-2 text-xs text-white/90">{copyStatus}</p>}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
export default LTVCalculatorSection;
