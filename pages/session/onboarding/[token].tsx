import React, { useState } from "react";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import { Inter } from "next/font/google";
import type { GetServerSideProps } from "next";
import { prisma } from "@/lib/prisma";
import OnboardingSuccessModal from "@/components/ui/OnboardingSuccessModal";

const inter = Inter({ subsets: ["latin"] });

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  iconPath: string;
  iconCompletedPath: string;
  fields?: Array<{
    name: string;
    label: string;
    type: "text" | "textarea" | "select" | "date";
    placeholder?: string;
    options?: string[];
    required?: boolean;
  }>;
}

const onboardingSteps: OnboardingStep[] = [
  {
    id: "brand",
    title: "Brand",
    description: "Company Brand & Identity",
    iconPath: "/assets/Onboarding/brand1.png",
    iconCompletedPath: "/assets/Onboarding/brand2.png",
    fields: [
      {
        name: "website",
        label: "What's your company website or main online presence?",
        type: "text",
        placeholder: "Ex. Instagram",
        required: true,
      },
      {
        name: "brandTone",
        label: "Do you have a preferred brand tone/voice (professional, playful, luxury, etc)?",
        type: "text",
        placeholder: "Ex. Professional",
        required: true,
      },
      {
        name: "productService",
        label: "Briefly describe your product or service in one sentence",
        type: "textarea",
        placeholder: "Enter answer here",
        required: true,
      },
      {
        name: "valueProposition",
        label: "What's your main value proposition or unique selling point (why customers choose you)?",
        type: "textarea",
        placeholder: "Enter answer here",
        required: true,
      },
    ],
  },
  {
    id: "audience",
    title: "Audience",
    description: "Target Audience & Marketing Goals",
    iconPath: "/assets/Onboarding/audience1.png",
    iconCompletedPath: "/assets/Onboarding/audience2.png",
    fields: [
      {
        name: "targetAudience",
        label: "Who is your target audience (age, location, interests, demographics)?",
        type: "textarea",
        placeholder: "Enter answer here",
        required: true,
      },
      {
        name: "socialMediaGoals",
        label: "What's your primary desire for social media growth (leads, awareness, event signups, etc)?",
        type: "textarea",
        placeholder: "Enter answer here",
        required: true,
      },
      {
        name: "leadGeneration",
        label: "Describe your current lead generation funnel and primary offer.",
        type: "textarea",
        placeholder: "Enter answer here",
        required: true,
      },
    ],
  },
  {
    id: "operations",
    title: "Operations",
    description: "Operations & Additional Details",
    iconPath: "/assets/Onboarding/operations1.png",
    iconCompletedPath: "/assets/Onboarding/operations2.png",
    fields: [
      {
        name: "avoidMentions",
        label: "Is there anything we should avoid mentioning (competitors, sensitive terms, compliance restrictions)?",
        type: "textarea",
        placeholder: "Enter answer here",
      },
      {
        name: "meetingTime1",
        label: "Please list several days/times of the week that work for weekly update meetings.",
        type: "date",
        placeholder: "Select date & time",
      },
      {
        name: "meetingTime2",
        label: "",
        type: "date",
        placeholder: "Select date & time",
      },
      {
        name: "meetingTime3",
        label: "",
        type: "date",
        placeholder: "Select date & time",
      },
      {
        name: "meetingTime4",
        label: "",
        type: "date",
        placeholder: "Select date & time",
      },
      {
        name: "meetingLink",
        label: "Please provide a google meet link for future meetings",
        type: "text",
        placeholder: "Enter meeting link",
      },
      {
        name: "additionalInfo",
        label: "Do you have anything else to add about your company, clients, needs, or questions?",
        type: "textarea",
        placeholder: "Enter answer here",
      },
    ],
  },
  {
    id: "contracts",
    title: "Contracts",
    description: "Contracts & Agreements",
    iconPath: "/assets/Onboarding/contracts1.png",
    iconCompletedPath: "/assets/Onboarding/contracts2.png",
  },
  {
    id: "payments",
    title: "Payments",
    description: "Payments & Subscriptions",
    iconPath: "/assets/Onboarding/payments1.png",
    iconCompletedPath: "/assets/Onboarding/payments2.png",
  },
];

interface ClientSessionData {
  clientName: string;
  clientEmail: string;
  businessName: string;
  token: string;
}

export default function OnboardingQuestionnaire({ initialSession }: { initialSession: ClientSessionData }) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const token = router.query.token as string;
  const step = onboardingSteps[currentStep];

  const handleInputChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleNext = () => {
    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleFinish = async () => {
    setLoading(true);
    // For now, just show success modal
    setLoading(false);
    setShowSuccessModal(true);
  };

  const isStepComplete = () => {
    if (!step.fields) return true;
    return step.fields
      .filter(field => field.required)
      .every(field => formData[field.name]?.trim());
  };

  const canProceed = currentStep === onboardingSteps.length - 1 || isStepComplete();

  return (
    <>
      <Head>
        <title>Vierra | Onboarding</title>
      </Head>
      <div className="min-h-screen bg-white flex flex-col lg:flex-row">
        {/* Sidebar */}
        <div className="w-full lg:w-[24rem] bg-[#701CC0] text-white p-4 lg:p-6 flex flex-col">
          <div className="mb-8 lg:mb-16">
            <Image
              src="/assets/vierra-logo-black-3.png"
              alt="Vierra Logo"
              width={120}
              height={70}
              className="w-30 bg-white rounded-sm pt-2 px-3"
            />
          </div>

          <div className="flex-1 relative">
            <div className="space-y-4 lg:space-y-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2 lg:gap-0">
              {onboardingSteps.map((stepItem, index) => (
                <div key={stepItem.id}>
                  <div
                    className={`flex items-center p-2 lg:p-3 rounded-lg transition-all ${
                      index === currentStep ? 'bg-white/20' : 'bg-transparent'
                    }`}
                  >
                    <div className="w-8 h-8 lg:w-11 lg:h-11 mr-2 lg:mr-4 flex items-center justify-center flex-shrink-0">
                      <Image
                        src={index < currentStep || index === currentStep ? stepItem.iconCompletedPath : stepItem.iconPath}
                        alt={stepItem.title}
                        width={32}
                        height={32}
                        className="w-8 h-8 lg:w-11 lg:h-11"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`font-semibold text-sm lg:text-base ${inter.className} truncate lg:whitespace-normal`}>
                        {stepItem.title}
                      </div>
                      <div className={`text-xs lg:text-sm opacity-80 ${inter.className} truncate lg:whitespace-normal`}>
                        {stepItem.description}
                      </div>
                    </div>
                  </div>
                  
                  {/* Line divider*/}
                  {index < onboardingSteps.length - 1 && (
                    <div className="hidden lg:block ml-8 my-2">
                      <Image
                        src="/assets/Onboarding/line.png"
                        alt="Step divider"
                        width={.6}
                        height={16}
                        className="opacity-50"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="text-xs lg:text-sm opacity-60 mt-4 lg:mt-0">
            All Right Reserved © Vierra Digital
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-4 lg:p-8">
          <div className="max-w-2xl mx-auto lg:mx-0">
            <div className="mb-6">
              <h1 className={`text-2xl lg:text-3xl font-bold text-gray-900 mb-2 ${inter.className}`}>
                Onboarding
              </h1>
              <p className="text-gray-600 text-sm lg:text-base">
                Step {currentStep + 1} of {onboardingSteps.length}
              </p>
            </div>

            <div className="bg-white">
              <h2 className={`text-2xl font-bold text-gray-900 mb-4 ${inter.className}`}>
                {step.title}
              </h2>
              
              {step.id === 'brand' && (
                <p className="text-gray-600 mb-8">
                  This allows us understand your business, brand and unique characteristics
                </p>
              )}

              {step.id === 'audience' && (
                <p className="text-gray-600 mb-8">
                  This allows us understand your target audience and marketing goals
                </p>
              )}

              {step.id === 'operations' && (
                <p className="text-gray-600 mb-8">
                  This allows us understand logistical preferences and any sensitive or additional details.
                </p>
              )}

              {step.id === 'contracts' && (
                <p className="text-gray-600 mb-8">
                  This allows us understand logistical preferences and any sensitive or additional details.
                </p>
              )}

              {step.id === 'payments' && (
                <p className="text-gray-600 mb-8">
                  This would help streamline the automated payments
                </p>
              )}

              {step.id === 'contracts' && (
                <div className="space-y-6">
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between p-4 border border-gray-200 rounded-lg gap-4">
                    <div className="flex items-center flex-1 min-w-0">
                      <div className="w-12 h-12 lg:w-16 lg:h-16 rounded-lg mr-4 lg:mr-6 flex items-center justify-center overflow-hidden flex-shrink-0">
                        <Image
                          src="/assets/Onboarding/document-text.png"
                          alt="Document"
                          width={64}
                          height={64}
                          className="w-12 h-12 lg:w-16 lg:h-16"
                          priority
                          unoptimized
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-black text-sm lg:text-base">Agreement</div>
                        <div className="text-xs lg:text-sm text-gray-500 line-clamp-2 lg:line-clamp-none">
                          Vierra Digital LLC Non-Disclosure Agreement This nondisclosure agreement (hereinafter referred to as the &quot;Agreement&quot;) is entered by and...
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-row items-center gap-4 lg:gap-8 w-full lg:w-auto justify-between lg:justify-end">
                      <div className="text-center lg:text-left">
                        <div className="text-xs lg:text-sm font-bold text-black">Signed by</div>
                        <div className="text-xs lg:text-sm text-gray-500">{initialSession.clientName}</div>
                      </div>
                      <button className="px-3 py-2 lg:px-4 lg:py-2 bg-[#7A13D0] text-white rounded-lg text-xs lg:text-sm font-medium whitespace-nowrap">
                        Sign
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {step.id === 'payments' && (
                <div className="space-y-11">
                  <p className="text-gray-600">
                    Link your Stripe account to securely automate payments for our services, ensuring seamless billing and real-time financial tracking
                  </p>
                  
                  <div className="text-center">
                    <div className="text-[#6772E5] text-4xl font-bold mb-4">stripe</div>
                    <p className="text-gray-500 mb-4">Stripe not connected</p>
                    <button className="px-6 py-2 bg-[#7A13D0] text-white rounded-lg font-medium">
                      Connect to Stripe
                    </button>
                  </div>
                </div>
              )}

              {step.fields && (
                <div className="space-y-11">
                  {step.fields.map((field) => (
                    <div key={field.name}>
                      {field.label && (
                        <label className="block text-sm font-medium text-gray-900 mb-2">
                          {field.label}
                        </label>
                      )}
                      {field.type === 'textarea' ? (
                        <textarea
                          value={formData[field.name] || ''}
                          onChange={(e) => handleInputChange(field.name, e.target.value)}
                          placeholder={field.placeholder}
                          rows={field.name === 'additionalInfo' ? 6 : 4}
                          className={`w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7A13D0] focus:border-transparent text-black ${inter.className}`}
                        />
                      ) : field.type === 'date' ? (
                        <div className="relative">
                          <input
                            type="text"
                            value={formData[field.name] || ''}
                            onChange={(e) => handleInputChange(field.name, e.target.value)}
                            placeholder={field.placeholder}
                            className={`w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7A13D0] focus:border-transparent pl-10 text-black ${inter.className}`}
                          />
                          <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-400">
                              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                              <line x1="16" y1="2" x2="16" y2="6"></line>
                              <line x1="8" y1="2" x2="8" y2="6"></line>
                              <line x1="3" y1="10" x2="21" y2="10"></line>
                            </svg>
                          </div>
                        </div>
                      ) : (
                        <input
                          type={field.type}
                          value={formData[field.name] || ''}
                          onChange={(e) => handleInputChange(field.name, e.target.value)}
                          placeholder={field.placeholder}
                          className={`w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7A13D0] focus:border-transparent text-black ${inter.className}`}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex flex-col sm:flex-row justify-between gap-4 mt-8">
                <button
                  onClick={handlePrevious}
                  disabled={currentStep === 0}
                  className={`px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition ${
                    currentStep === 0 ? 'opacity-50 cursor-not-allowed' : ''
                  } ${inter.className}`}
                >
                  Previous
                </button>

                {currentStep === onboardingSteps.length - 1 ? (
                  <button
                    onClick={handleFinish}
                    disabled={loading}
                    className={`px-6 py-3 bg-[#7A13D0] text-white rounded-lg font-medium hover:bg-[#6B11B8] transition ${inter.className}`}
                  >
                    {loading ? 'Processing...' : 'Done'}
                  </button>
                ) : (
                  <button
                    onClick={handleNext}
                    disabled={!canProceed}
                    className={`px-6 py-3 bg-[#7A13D0] text-white rounded-lg font-medium hover:bg-[#6B11B8] transition ${
                      !canProceed ? 'opacity-50 cursor-not-allowed' : ''
                    } ${inter.className}`}
                  >
                    Next
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <OnboardingSuccessModal
        isOpen={showSuccessModal}
        onClose={() => setShowSuccessModal(false)}
        token={token}
      />
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const token = String(ctx.params?.token || "");
  const sess = await prisma.onboardingSession.findUnique({
    where: { id: token },
    include: { client: true },
  });
  
  if (!sess) return { notFound: true };

  return {
    props: {
      initialSession: {
        clientName: sess.client.name,
        clientEmail: sess.client.email,
        businessName: sess.client.businessName,
        token: sess.id,
      },
    },
  };
};
