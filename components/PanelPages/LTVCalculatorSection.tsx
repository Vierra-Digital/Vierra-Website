import React, { useState } from "react"
import { Inter } from "next/font/google"

const inter = Inter({ subsets: ["latin"] })

const LTVCalculatorSection = () => {
    // no tabs required for LTV; single focused calculator
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
        <div className={`w-full h-full bg-white p-8 ${inter.className}`}>
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-semibold text-[#111827]">LTV Calculator</h1>
                    <div className="flex items-center gap-3">
                        <button className="px-4 py-2 rounded-lg font-semibold text-white bg-[#701CC0] hover:bg-[#8F42FF]">Calculate</button>
                    </div>
                </div>

                <div className="bg-[#F8F0FF] rounded-2xl shadow-sm border border-[#EDE6FB] p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-[#374151] mb-2">Average Purchase Value</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#6B7280]">$</span>
                                <input
                                    type="number"
                                    className="w-full bg-white border border-[#D1D5DB] rounded-lg pl-9 pr-4 py-3 text-base text-[#111827] placeholder-[#9CA3AF] focus:ring-2 focus:ring-[#4F46E5] focus:border-[#4F46E5] outline-none transition-colors"
                                    value={averagePurchaseValue || ""}
                                    onChange={e => setAveragePurchaseValue(Number(e.target.value) || 0)}
                                    min={0}
                                    placeholder="0"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-[#374151] mb-2">Cost Of Goods/Services Sold (%)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    className="w-full bg-white border border-[#D1D5DB] rounded-lg pl-4 pr-10 py-3 text-base text-[#111827] placeholder-[#9CA3AF] focus:ring-2 focus:ring-[#4F46E5] focus:border-[#4F46E5] outline-none transition-colors"
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
                            <label className="block text-sm font-medium text-[#374151] mb-2">Number Of Referrals</label>
                            <input
                                type="number"
                                className="w-full bg-white border border-[#D1D5DB] rounded-lg px-4 py-3 text-base text-[#111827] placeholder-[#9CA3AF] focus:ring-2 focus:ring-[#4F46E5] focus:border-[#4F46E5] outline-none transition-colors"
                                value={numReferrals || ""}
                                onChange={e => setNumReferrals(Number(e.target.value) || 0)}
                                min={0}
                                placeholder="0"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-[#374151] mb-2">Returns Per Year</label>
                            <input
                                type="number"
                                className="w-full bg-white border border-[#D1D5DB] rounded-lg px-4 py-3 text-base text-[#111827] placeholder-[#9CA3AF] focus:ring-2 focus:ring-[#4F46E5] focus:border-[#4F46E5] outline-none transition-colors"
                                value={returnsPerYear || ""}
                                onChange={e => setReturnsPerYear(Number(e.target.value) || 0)}
                                min={0}
                                placeholder="0"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-[#374151] mb-2">Customer Term (Years)</label>
                            <input
                                type="number"
                                className="w-full bg-white border border-[#D1D5DB] rounded-lg px-4 py-3 text-base text-[#111827] placeholder-[#9CA3AF] focus:ring-2 focus:ring-[#4F46E5] focus:border-[#4F46E5] outline-none transition-colors"
                                value={customerTerm || ""}
                                onChange={e => setCustomerTerm(Number(e.target.value) || 0)}
                                min={0}
                                placeholder="0"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-[#374151] mb-2">Number Of Clients Brought In</label>
                            <input
                                type="number"
                                className="w-full bg-white border border-[#D1D5DB] rounded-lg px-4 py-3 text-base text-[#111827] placeholder-[#9CA3AF] focus:ring-2 focus:ring-[#4F46E5] focus:border-[#4F46E5] outline-none transition-colors"
                                value={numClientsBroughtIn || ""}
                                onChange={e => setNumClientsBroughtIn(Number(e.target.value) || 0)}
                                min={0}
                                placeholder="0"
                            />
                        </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-[#E5E7EB] grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <div className="text-sm text-[#6B7280]">Lifetime Value</div>
                            <div className="text-2xl font-semibold text-[#111827]">${isNaN(LTV) ? (0).toLocaleString() : Math.round(LTV).toLocaleString()}</div>
                        </div>
                        <div>
                            <div className="text-sm text-[#6B7280]">Retainer Pricing</div>
                            <div className="text-2xl font-semibold text-[#111827]">${isNaN(retainer) ? (0).toLocaleString() : Math.round(retainer).toLocaleString()}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
export default LTVCalculatorSection;