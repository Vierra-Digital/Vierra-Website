import React, { useState, useRef} from "react";
import { Bricolage_Grotesque as BricolageGrotesqueFont, Inter as InterFont } from "next/font/google";
import { X } from "lucide-react"

const Bricolage_Grotesque = BricolageGrotesqueFont({ subsets: ["latin"] });
const inter = InterFont({ subsets: ["latin"] });

interface AddClientModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AddClientModal: React.FC<AddClientModalProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(1);
  const [clientData, setClientData] = useState({
    clientName: "",
    clientEmail: "",
    businessName: "",
  });
  const modalRef = useRef<HTMLDivElement>(null);
  const [sessionLink, setSessionLink] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setClientData({ ...clientData, [e.target.name]: e.target.value });
  };

  const handleOutsideClick = (e: React.MouseEvent<HTMLDivElement>) => {
          if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
            onClose();
          }
      };

  const nextStep = () => setStep((prev) => prev + 1);
  const prevStep = () => setStep((prev) => prev - 1);

  const handleSubmit = async () => {
    try {
      const response = await fetch('/api/generateClientSession', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(clientData),
      });

      if (response.ok) {
        const data = await response.json();
        setSessionLink(data.link);
        nextStep();
      } else {
        console.error('Failed to generate session');
      }
    } catch (error) {
      console.error('Error generating session:', error);
    }
  };

  

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60"
      onClick={handleOutsideClick}>
      <div ref={modalRef} className="bg-[#2E0A4F] rounded-lg p-8 w-full max-w-md relative">
        <button
          className="absolute top-4 right-4 text-gray-400 hover:text-red-500 transition-colors z-10"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={24} />
        </button>
        <h2 className={`text-2xl font-bold mb-5 text-center ${Bricolage_Grotesque.className}`}>Add New Client</h2>
        {step === 1 && (
          <>
            <h3 className={`text-lg font-semibold mb-3 ${Bricolage_Grotesque.className}`}>Client Information</h3>
            <div className="mb-4">
              <label htmlFor="clientName" className={`block text-sm font-medium ${inter.className}`}>Client Name</label>
              <input
                type="text"
                id="clientName"
                name="clientName"
                value={clientData.clientName}
                onChange={handleChange}
                className={`mt-1 p-2 w-full bg-[#18042A]/50 border border-[#701CC0]/50 rounded text-white ${inter.className}`}
              />
            </div>
            <div className="mb-4">
              <label htmlFor="clientEmail" className={`block text-sm font-medium ${inter.className}`}>Client Email</label>
              <input
                type="text"
                id="clientEmail"
                name="clientEmail"
                value={clientData.clientEmail}
                onChange={handleChange}
                className={`mt-1 p-2 w-full bg-[#18042A]/50 border border-[#701CC0]/50 rounded text-white ${inter.className}`}
              />
            </div>
            <div className="mb-4">
              <label htmlFor="businessName" className={`block text-sm font-medium ${inter.className}`}>Business Name</label>
              <input
                type="text"
                id="businessName"
                name="businessName"
                value={clientData.businessName}
                onChange={handleChange}
                className={`mt-1 p-2 w-full bg-[#18042A]/50 border border-[#701CC0]/50 rounded text-white ${inter.className}`}
              />
            </div>
            <div className="flex justify-end mt-6">
              <button
                className={`px-4 py-2 bg-purple-500 text-white rounded-md shadow hover:scale-105 transition-transform ${Bricolage_Grotesque.className}`}
                onClick={nextStep}
                disabled={
                  !clientData.clientName ||
                  !clientData.clientEmail ||
                  !clientData.businessName
                }
              >
                Next
              </button>
            </div>
          </>
        )}
        {step === 2 && (
          <>
            <h3 className={`text-lg font-semibold mb-3 ${Bricolage_Grotesque.className}`}>Confirm Details</h3>
            <p className={`mb-2 ${inter.className}`}>Client Name: {clientData.clientName}</p>
            <p className={`mb-2 ${inter.className}`}>Client Email: {clientData.clientEmail}</p>
            <p className={`mb-2 ${inter.className}`}>Business Name: {clientData.businessName}</p>
            <div className="flex justify-between mt-6">
              <button
                className={`px-4 py-2 bg-gray-300 text-black rounded-md shadow hover:scale-105 transition-transform ${inter.className}`}
                onClick={prevStep}
              >
                Previous
              </button>
              <button
                className={`px-4 py-2 bg-green-500 text-white rounded-md shadow hover:scale-105 transition-transform ${Bricolage_Grotesque.className}`}
                onClick={handleSubmit}
              >
                Generate Session Link
              </button>
            </div>
          </>
        )}
        {step === 3 && (
          <>
            <h3 className={`text-lg font-semibold mb-3 ${Bricolage_Grotesque.className}`}>Session Link Generated</h3>
            <div className="mt-6">
              <p className={`mb-2 text-sm ${inter.className}`}>
                Share this link with {clientData.clientName}:
              </p>
              <div className="bg-[#18042A]/50 border border-[#701CC0]/50 rounded p-3 mb-4">
                <p className={`text-sm text-blue-300 break-all ${inter.className}`}>
                  {sessionLink ? `${window.location.origin}${sessionLink}` : "Generating..."}
                </p>
              </div>
              <button
                className={`w-full mb-4 px-4 py-2 bg-blue-500 text-white rounded-md shadow hover:scale-105 transition-transform ${inter.className}`}
                onClick={() => {
                  if (sessionLink) {
                    navigator.clipboard.writeText(`${window.location.origin}${sessionLink}`);
                    alert("Link copied to clipboard!");
                  }
                }}
                disabled={!sessionLink}
              >
                Copy Link
              </button>
            </div>
            <div className="flex justify-end mt-6">
              <button
                className={`px-4 py-2 bg-green-500 text-white rounded-md shadow hover:scale-105 transition-transform ${Bricolage_Grotesque.className}`}
                onClick={onClose}
              >
                Finish
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AddClientModal;