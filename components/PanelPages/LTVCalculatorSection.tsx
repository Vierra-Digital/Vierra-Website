import React, { useState } from "react"
import { Inter } from "next/font/google"

const inter = Inter({ subsets: ["latin"] })

const LTVCalculatorSection = () => {
    const [activeTab, setActiveTab] = useState<"ltv">("ltv");
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
        <div className={`w-full h-full bg-[#F8F0FF] p-4 ${inter.className}`}>
            <div className="max-w-2xl">
                {/* Tabs */}
                <div className="flex mb-4">
                    <button
                        className={`px-0 py-3 text-lg font-medium mr-8 border-b-2 ${
                            activeTab === "ltv" 
                                ? "text-[#4F46E5] border-[#4F46E5]" 
                                : "text-[#9CA3AF] border-transparent hover:text-[#6B7280]"
                        } focus:outline-none transition-colors`}
                        onClick={() => setActiveTab("ltv")}
                    >
                        LTV Calculator
                    </button>
                </div>
                
                {/* Form Container */}
                <div className="bg-white rounded-2xl shadow-sm border border-[#E5E7EB] p-5">
                    {activeTab === "ltv" && (
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-[#374151] mb-2">
                                    Average Purchase Value
                                </label>
                                <input
                                    type="number"
                                    className="w-full border border-[#D1D5DB] rounded-lg px-4 py-3 text-base text-[#111827] placeholder-[#9CA3AF] focus:ring-2 focus:ring-[#4F46E5] focus:border-[#4F46E5] outline-none transition-colors"
                                    value={averagePurchaseValue || ""}
                                    onChange={e => setAveragePurchaseValue(Number(e.target.value) || 0)}
                                    min={0}
                                    placeholder="0"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[#374151] mb-2">
                                    Cost Of Goods/Services Sold (As A Percentage)
                                </label>
                                <input
                                    type="number"
                                    className="w-full border border-[#D1D5DB] rounded-lg px-4 py-3 text-base text-[#111827] placeholder-[#9CA3AF] focus:ring-2 focus:ring-[#4F46E5] focus:border-[#4F46E5] outline-none transition-colors"
                                    value={costOfGoods || ""}
                                    onChange={e => setCostOfGoods(Number(e.target.value) || 0)}
                                    min={0}
                                    max={100}
                                    placeholder="0"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[#374151] mb-2">
                                    Number Of Referrals
                                </label>
                                <input
                                    type="number"
                                    className="w-full border border-[#D1D5DB] rounded-lg px-4 py-3 text-base text-[#111827] placeholder-[#9CA3AF] focus:ring-2 focus:ring-[#4F46E5] focus:border-[#4F46E5] outline-none transition-colors"
                                    value={numReferrals || ""}
                                    onChange={e => setNumReferrals(Number(e.target.value) || 0)}
                                    min={0}
                                    placeholder="0"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[#374151] mb-2">
                                    Returns Per Year
                                </label>
                                <input
                                    type="number"
                                    className="w-full border border-[#D1D5DB] rounded-lg px-4 py-3 text-base text-[#111827] placeholder-[#9CA3AF] focus:ring-2 focus:ring-[#4F46E5] focus:border-[#4F46E5] outline-none transition-colors"
                                    value={returnsPerYear || ""}
                                    onChange={e => setReturnsPerYear(Number(e.target.value) || 0)}
                                    min={0}
                                    placeholder="0"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[#374151] mb-2">
                                    Customer Term In Years
                                </label>
                                <input
                                    type="number"
                                    className="w-full border border-[#D1D5DB] rounded-lg px-4 py-3 text-base text-[#111827] placeholder-[#9CA3AF] focus:ring-2 focus:ring-[#4F46E5] focus:border-[#4F46E5] outline-none transition-colors"
                                    value={customerTerm || ""}
                                    onChange={e => setCustomerTerm(Number(e.target.value) || 0)}
                                    min={0}
                                    placeholder="0"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-[#374151] mb-2">
                                    Number Of Clients Brought In
                                </label>
                                <input
                                    type="number"
                                    className="w-full border border-[#D1D5DB] rounded-lg px-4 py-3 text-base text-[#111827] placeholder-[#9CA3AF] focus:ring-2 focus:ring-[#4F46E5] focus:border-[#4F46E5] outline-none transition-colors"
                                    value={numClientsBroughtIn || ""}
                                    onChange={e => setNumClientsBroughtIn(Number(e.target.value) || 0)}
                                    min={0}
                                    placeholder="0"
                                />
                            </div>
                            
                            {/* Results Section */}
                            <div className="pt-4 border-t border-[#E5E7EB] space-y-2">
                                <div className="text-xl font-semibold text-[#111827]">
                                    Lifetime Value = <span className="font-normal">{isNaN(LTV) ? 0 : Math.round(LTV)}</span>
                                </div>
                                <div className="text-xl font-semibold text-[#111827]">
                                    Retainer Pricing = <span className="font-normal">{isNaN(retainer) ? 0 : Math.round(retainer)}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
export default LTVCalculatorSection;