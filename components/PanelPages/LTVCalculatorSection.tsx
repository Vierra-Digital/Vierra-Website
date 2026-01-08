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
        <div className={`w-full h-full bg-white text-[#111014] flex flex-col ${inter.className}`}>
            <div className="flex-1 flex justify-center px-6 pt-2">
                <div className="w-full max-w-6xl flex flex-col h-full">
                    <div className="w-full flex justify-between items-center mb-2">
                        <div>
                            <h1 className="text-2xl font-semibold text-[#111827] mt-6 mb-6">LTV Calculator</h1>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                        {/* Input Section */}
                        <div className="lg:col-span-2">
                            <div className="bg-white rounded-xl shadow-sm border border-[#E5E7EB] p-6">
                                <h2 className="text-lg font-semibold text-[#111827] mb-6">Input Values</h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div>
                                        <label className="block text-sm font-medium text-[#374151] mb-2">Average Purchase Value</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#6B7280]">$</span>
                                            <input
                                                type="number"
                                                className="w-full bg-white border border-[#E5E7EB] rounded-lg pl-9 pr-4 py-2.5 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:ring-2 focus:ring-[#701CC0] focus:border-[#701CC0] outline-none transition-colors"
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
                                                className="w-full bg-white border border-[#E5E7EB] rounded-lg px-4 pr-10 py-2.5 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:ring-2 focus:ring-[#701CC0] focus:border-[#701CC0] outline-none transition-colors"
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
                                            className="w-full bg-white border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:ring-2 focus:ring-[#701CC0] focus:border-[#701CC0] outline-none transition-colors"
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
                                            className="w-full bg-white border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:ring-2 focus:ring-[#701CC0] focus:border-[#701CC0] outline-none transition-colors"
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
                                            className="w-full bg-white border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:ring-2 focus:ring-[#701CC0] focus:border-[#701CC0] outline-none transition-colors"
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
                                            className="w-full bg-white border border-[#E5E7EB] rounded-lg px-4 py-2.5 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:ring-2 focus:ring-[#701CC0] focus:border-[#701CC0] outline-none transition-colors"
                                            value={numClientsBroughtIn || ""}
                                            onChange={e => setNumClientsBroughtIn(Number(e.target.value) || 0)}
                                            min={0}
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Results Section */}
                        <div className="lg:col-span-1">
                            <div className="bg-gradient-to-br from-[#701CC0] to-[#8F42FF] rounded-xl shadow-lg p-6 text-white sticky top-6">
                                <h2 className="text-lg font-semibold mb-6">Calculated Results</h2>
                                <div className="space-y-6">
                                    <div>
                                        <div className="text-sm font-medium text-white/80 mb-2">Lifetime Value</div>
                                        <div className="text-3xl font-bold">${isNaN(LTV) ? (0).toLocaleString() : Math.round(LTV).toLocaleString()}</div>
                                    </div>
                                    <div className="pt-4 border-t border-white/20">
                                        <div className="text-sm font-medium text-white/80 mb-2">Retainer Pricing</div>
                                        <div className="text-3xl font-bold">${isNaN(retainer) ? (0).toLocaleString() : Math.round(retainer).toLocaleString()}</div>
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