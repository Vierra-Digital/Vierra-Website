import { useState } from "react"
import { inter } from "@/lib/fonts";


const LTVCalculatorSection = () => {
    const [averagePurchaseValue, setAveragePurchaseValue] = useState(0);
    const [costOfGoods, setCostOfGoods] = useState(0);
    const [numReferrals, setNumReferrals] = useState(0);
    const [returnsPerYear, setReturnsPerYear] = useState(0);
    const [customerTerm, setCustomerTerm] = useState(0);
    const [numClientsBroughtIn, setNumClientsBroughtIn] = useState(0);
    
    function calculateLTV({
        avgPurchaseValue,
        costOfGoodsPct,
        returnsPerYear,
        customerTermYears,
        numReferrals,
        numClients
    }: {
        avgPurchaseValue: number,
        costOfGoodsPct: number,
        returnsPerYear: number,
        customerTermYears: number,
        numReferrals: number,
        numClients: number
    }) {
        const grossProfitPerPurchase = avgPurchaseValue * (1 - costOfGoodsPct / 100);
        const LTV = grossProfitPerPurchase * returnsPerYear * customerTermYears * (numReferrals + 1);
        const retainer = LTV * numClients / 2;
        return { LTV, retainer };
    }

    const { LTV, retainer } = calculateLTV({
        avgPurchaseValue: averagePurchaseValue,
        costOfGoodsPct: costOfGoods,
        returnsPerYear,
        customerTermYears: customerTerm,
        numReferrals,
        numClients: numClientsBroughtIn
    });

    return (
        <div className={`w-full h-full bg-white text-[#111014] flex flex-col ${inter.className}`}>
            <div className="flex-1 px-8 lg:px-14 pt-1 overflow-x-hidden">
                <div className="mx-auto w-full max-w-[1680px] flex flex-col h-full">
                    <div className="w-full flex justify-between items-center">
                        <div>
                            <h1 className="text-[30px] leading-[1.15] font-semibold tracking-[-0.025em] text-[#111827] mt-8 mb-6">LTV Calculator</h1>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
                        
                        <div className="lg:col-span-2">
                            <div className="bg-[#F1EFF6] rounded-xl p-5">
                                <h2 className="text-lg font-semibold text-[#111827] mb-4">Input Values</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8B8598] mb-1.5">Average Purchase Value</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#6B7280]">$</span>
                                            <input
                                                type="number"
                                                className="w-full bg-white rounded-lg pl-9 pr-4 py-2 text-[13px] text-[#111827] placeholder:text-[#9CA3AF] focus:ring-2 focus:ring-[#701CC0] focus:border-[#701CC0] outline-none transition-colors"
                                                value={averagePurchaseValue || ""}
                                                onChange={e => setAveragePurchaseValue(Number(e.target.value) || 0)}
                                                min={0}
                                                placeholder="0"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8B8598] mb-1.5">Cost of Goods/Services Sold (%)</label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                className="w-full bg-white rounded-lg px-3.5 pr-10 py-2 text-[13px] text-[#111827] placeholder:text-[#9CA3AF] focus:ring-2 focus:ring-[#701CC0] focus:border-[#701CC0] outline-none transition-colors"
                                                value={costOfGoods || ""}
                                                onChange={e => setCostOfGoods(Number(e.target.value) || 0)}
                                                min={0}
                                                max={100}
                                                placeholder="0"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#6B7280]">%</span>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8B8598] mb-1.5">Number of Referrals</label>
                                        <input
                                            type="number"
                                            className="w-full bg-white rounded-lg px-3.5 py-2 text-[13px] text-[#111827] placeholder:text-[#9CA3AF] focus:ring-2 focus:ring-[#701CC0] focus:border-[#701CC0] outline-none transition-colors"
                                            value={numReferrals || ""}
                                            onChange={e => setNumReferrals(Number(e.target.value) || 0)}
                                            min={0}
                                            placeholder="0"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8B8598] mb-1.5">Returns per Year</label>
                                        <input
                                            type="number"
                                            className="w-full bg-white rounded-lg px-3.5 py-2 text-[13px] text-[#111827] placeholder:text-[#9CA3AF] focus:ring-2 focus:ring-[#701CC0] focus:border-[#701CC0] outline-none transition-colors"
                                            value={returnsPerYear || ""}
                                            onChange={e => setReturnsPerYear(Number(e.target.value) || 0)}
                                            min={0}
                                            placeholder="0"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8B8598] mb-1.5">Customer Term (Years)</label>
                                        <input
                                            type="number"
                                            className="w-full bg-white rounded-lg px-3.5 py-2 text-[13px] text-[#111827] placeholder:text-[#9CA3AF] focus:ring-2 focus:ring-[#701CC0] focus:border-[#701CC0] outline-none transition-colors"
                                            value={customerTerm || ""}
                                            onChange={e => setCustomerTerm(Number(e.target.value) || 0)}
                                            min={0}
                                            placeholder="0"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8B8598] mb-1.5">Number of Clients Brought In</label>
                                        <input
                                            type="number"
                                            className="w-full bg-white rounded-lg px-3.5 py-2 text-[13px] text-[#111827] placeholder:text-[#9CA3AF] focus:ring-2 focus:ring-[#701CC0] focus:border-[#701CC0] outline-none transition-colors"
                                            value={numClientsBroughtIn || ""}
                                            onChange={e => setNumClientsBroughtIn(Number(e.target.value) || 0)}
                                            min={0}
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        
                        <div className="lg:col-span-1">
                            <div className="bg-[#F1EFF6] rounded-xl p-5 sticky top-6">
                                <h2 className="text-lg font-semibold text-[#111827] mb-4">Calculated Results</h2>
                                <div className="space-y-4">
                                    <div>
                                        <div className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8B8598] mb-1.5">Lifetime Value</div>
                                        <div className="text-[28px] font-semibold leading-none tracking-[-0.02em] text-[#701CC0]">${isNaN(LTV) ? (0).toLocaleString() : Math.round(LTV).toLocaleString()}</div>
                                    </div>
                                    <div className="pt-4 border-t border-[#E2DEEC]">
                                        <div className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8B8598] mb-1.5">Retainer Pricing</div>
                                        <div className="text-[28px] font-semibold leading-none tracking-[-0.02em] text-[#701CC0]">${isNaN(retainer) ? (0).toLocaleString() : Math.round(retainer).toLocaleString()}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
export default LTVCalculatorSection;