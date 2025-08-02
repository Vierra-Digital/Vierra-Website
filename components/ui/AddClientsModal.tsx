import React, { useState} from "react";
import { Bricolage_Grotesque as BricolageGrotesqueFont, Inter as InterFont } from "next/font/google";
import { X } from "lucide-react";
import Image from "next/image";


const Bricolage_Grotesque = BricolageGrotesqueFont({ subsets: ["latin"] });
const inter = InterFont({ subsets: ["latin"] });

interface AddClientsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AddClientsModal: React.FC<AddClientsModalProps> = ({ isOpen, onClose }) => {
    const [step, setStep] = useState<number>(1);
    const [clientData, setClientData] = useState<{ [key: string]: any }>({});

    const nextStep = () => {
        setStep(prevStep => prevStep + 1);
    };

    const prevStep = () => {
        setStep(prevStep => prevStep - 1);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setClientData(prevData => ({
            ...prevData,
            [name]: value
        }));
    };

     if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] p-4 backdrop-blur-sm">
            <div className="relative bg-[#18042A]/90 border border-[#701CC0]/50 backdrop-blur-md rounded-lg p-6 w-full max-w-4xl max-h-[90vh] shadow-lg text-white flex flex-col overflow-hidden">
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
                    Add New Client
                </h2>

                <div className="flex-grow overflow-y-auto px-2 pb-4">
                    {step === 1 && (
                        <div>
                            <h3 className="text-lg font-semibold mb-3">Client Information - Step 1</h3>
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="clientName" className="block text-sm font-medium">Client Name</label>
                                    <input
                                        type="text"
                                        id="clientName"
                                        name="clientName"
                                        onChange={handleChange}
                                        className="mt-1 p-2 w-full bg-[#18042A]/50 border border-[#701CC0]/50 rounded text-white"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="clientEmail" className="block text-sm font-medium">Client Email</label>
                                    <input
                                        type="email"
                                        id="clientEmail"
                                        name="clientEmail"
                                        onChange={handleChange}
                                        className="mt-1 p-2 w-full bg-[#18042A]/50 border border-[#701CC0]/50 rounded text-white"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end mt-6">
                                <button
                                    className="px-4 py-2 bg-[#701CC0] text-white rounded-md shadow-[0px_4px_15.9px_0px_#701CC061] transform transition-transform duration-300 hover:scale-105"
                                    onClick={nextStep}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div>
                            <h3 className="text-lg font-semibold mb-3">Client Information - Step 2</h3>
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="clientPhone" className="block text-sm font-medium">Client Phone</label>
                                    <input
                                        type="tel"
                                        id="clientPhone"
                                        name="clientPhone"
                                        onChange={handleChange}
                                        className="mt-1 p-2 w-full bg-[#18042A]/50 border border-[#701CC0]/50 rounded text-white"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="clientAddress" className="block text-sm font-medium">Client Address</label>
                                    <input
                                        type="text"
                                        id="clientAddress"
                                        name="clientAddress"
                                        onChange={handleChange}
                                        className="mt-1 p-2 w-full bg-[#18042A]/50 border border-[#701CC0]/50 rounded text-white"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-between mt-6">
                                <button
                                    className="px-4 py-2 bg-gray-300 text-black rounded-md shadow-[0px_4px_15.9px_0px_#701CC061] transform transition-transform duration-300 hover:scale-105"
                                    onClick={prevStep}
                                >
                                    Previous
                                </button>
                                <button
                                    className="px-4 py-2 bg-[#701CC0] text-white rounded-md shadow-[0px_4px_15.9px_0px_#701CC061] transform transition-transform duration-300 hover:scale-105"
                                    onClick={nextStep}
                                >
                                    Next
                                </button>
                            </div>
                        </div>
                    )}

                    {step === 3 && (
                        <div>
                            <h3 className="text-lg font-semibold mb-3">Generate Session Link</h3>
                            <p>Client Name: {clientData.clientName}</p>
                            <p>Client Email: {clientData.clientEmail}</p>
                            <p>Client Phone: {clientData.clientPhone}</p>
                            <p>Client Address: {clientData.clientAddress}</p>
                            <div className="mt-6">
                                {/* Generates a dummy link*/}
                                <p>Session Link: <a href="#" className="text-blue-500">https://vierra.com/session/12345</a></p>
                            </div>
                            <div className="flex justify-between mt-6">
                                <button
                                    className="px-4 py-2 bg-gray-300 text-black rounded-md shadow-[0px_4px_15.9px_0px_#701CC061] transform transition-transform duration-300 hover:scale-105"
                                    onClick={prevStep}
                                >
                                    Previous
                                </button>
                                <button
                                    className="px-4 py-2 bg-green-500 text-white rounded-md shadow-[0px_4px_15.9px_0px_#701CC061] transform transition-transform duration-300 hover:scale-105"
                                    onClick={onClose}
                                >
                                    Finish
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AddClientsModal;