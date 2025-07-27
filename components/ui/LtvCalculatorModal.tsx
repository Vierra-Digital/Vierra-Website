import React, { useState, useRef} from "react"
import { Bricolage_Grotesque as BricolageGrotesqueFont, Inter as InterFont } from "next/font/google"
import Image from "next/image"
import { X } from "lucide-react"

const Bricolage_Grotesque = BricolageGrotesqueFont({ subsets: ["latin"] });
const inter = InterFont({ subsets: ["latin"] });

const defValues = {
    avgPurchaseValue: 0,
    costOfGoodsPct: 0,
    returnsPerYear: 0,
    customerTermYears: 0,
    numReferrals: 0,
    numClients: 0,
};

function calculateLTV({
    avgPurchaseValue,
    costOfGoodsPct,
    returnsPerYear,
    customerTermYears,
    numReferrals,
    numClients
}: typeof defValues) {
    const grossProfitPerPurchase = avgPurchaseValue * (1 - costOfGoodsPct / 100);
    const clientsTotal = numReferrals + numClients;
    const LTV = grossProfitPerPurchase * returnsPerYear * customerTermYears * clientsTotal;
    const retainer = LTV / 2;
    return { LTV, retainer};
}
interface LtvCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function LtvCalculatorModal({ isOpen, onClose }: LtvCalculatorModalProps) {
    const [values, setValues] = useState(defValues);
    const { LTV, retainer } = calculateLTV(values);
    const modalRef = useRef<HTMLDivElement>(null);
    const handleOutsideClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
          onClose();
        }
    };
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setValues(prevValues => ({
            ...prevValues,
            [name]: parseFloat(value)
        }));
    };

    return (
      <div
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] p-4 backdrop-blur-sm"
            onClick={handleOutsideClick}
        >
            <div
                ref={modalRef}
                className={`relative bg-[#18042A]/90 border border-[#701CC0]/50 backdrop-blur-md rounded-lg p-6 w-full max-w-4xl max-h-[90vh] shadow-lg text-white flex flex-col overflow-hidden ${inter.className}`}
            >
                <button
                    className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition-colors z-10"
                    onClick={onClose}
                    aria-label="Close modal"
                >
                    <X size={24} />
                </button>

                <div className="flex justify-center mb-4 pt-2">
                    <Image
                        src="/assets/vierra-logo.png"
                        alt="Vierra Logo"
                        width={120}
                        height={40}
                        className="w-auto h-10"
                    />
                </div>
                <h2
                    className={`text-2xl font-bold mb-5 text-center ${Bricolage_Grotesque.className}`}
                >
                    LTV Calculator
                </h2>

                <div className="flex-grow overflow-y-auto px-2 pb-4">
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="avgPurchaseValue" className="block text-lg font-medium">Average Purchase Value</label>
                            <input
                                type="number"
                                id="avgPurchaseValue"
                                name="avgPurchaseValue"
                                value={values.avgPurchaseValue}
                                onChange={handleInputChange}
                                className="mt-1 p-2 w-full bg-[#18042A]/50 border border-[#701CC0]/50 rounded text-white"
                            />
                        </div>
                        <div>
                            <label htmlFor="costOfGoodsPct" className="block text-lg font-medium">Cost Of Goods/Services Sold (As A Percentage)</label>
                            <input
                                type="number"
                                id="costOfGoodsPct"
                                name="costOfGoodsPct"
                                value={values.costOfGoodsPct}
                                onChange={handleInputChange}
                                className="mt-1 p-2 w-full bg-[#18042A]/50 border border-[#701CC0]/50 rounded text-white"
                            />
                        </div>
                        <div>
                            <label htmlFor="returnsPerYear" className="block text-lg font-medium">Returns Per Year</label>
                            <input
                                type="number"
                                id="returnsPerYear"
                                name="returnsPerYear"
                                value={values.returnsPerYear}
                                onChange={handleInputChange}
                                className="mt-1 p-2 w-full bg-[#18042A]/50 border border-[#701CC0]/50 rounded text-white"
                            />
                        </div>
                        <div>
                            <label htmlFor="customerTermYears" className="block text-lg font-medium">Customer Term In Years</label>
                            <input
                                type="number"
                                id="customerTermYears"
                                name="customerTermYears"
                                value={values.customerTermYears}
                                onChange={handleInputChange}
                                className="mt-1 p-2 w-full bg-[#18042A]/50 border border-[#701CC0]/50 rounded text-white"
                            />
                        </div>
                        <div>
                            <label htmlFor="numReferrals" className="block text-lg font-medium">Number Of Referrals</label>
                            <input
                                type="number"
                                id="numReferrals"
                                name="numReferrals"
                                value={values.numReferrals}
                                onChange={handleInputChange}
                                className="mt-1 p-2 w-full bg-[#18042A]/50 border border-[#701CC0]/50 rounded text-white"
                            />
                        </div>
                        <div>
                            <label htmlFor="numClients" className="block text-lg font-medium">Number Of Clients Brought In</label>
                            <input
                                type="number"
                                id="numClients"
                                name="numClients"
                                value={values.numClients}
                                onChange={handleInputChange}
                                className="mt-1 p-2 w-full bg-[#18042A]/50 border border-[#701CC0]/50 rounded text-white"
                            />
                        </div>
                        <div className="mt-6">
                            <p className="text-lg font-semibold">Lifetime Value: ${LTV.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                            <p className="text-lg font-semibold">Retainer Pricing: ${retainer.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
  );
}