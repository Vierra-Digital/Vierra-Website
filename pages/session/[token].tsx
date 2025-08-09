import React, { useState, useEffect } from "react";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import { Bricolage_Grotesque, Inter } from "next/font/google";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] });
const inter = Inter({ subsets: ["latin"] });

interface ClientSessionData {
  clientName: string;
  clientEmail: string;
  businessName: string;
  token: string;
  createdAt: number;
}

const questions = [
  {
    label: "How are you doing?",
    name: "Q1",
    placeholder: "Answer",
    type: "text",
  },
  {
    label: "Watch this short introduction video before continuing.",
    name: "Video",
    type: "video",
    videoUrl: "/assets/onboarding-intro.mp4", // replace with vid
  },
  {
    label: "What is your Major?",
    name: "Q2",
    placeholder: "Answer",
    type: "text",
  },
  {
    label: "What is the name of your Business?",
    name: "Q3",
    placeholder: "Answer",
    type: "text",
  },
];

const SessionQuestionnaire = () => {
  const router = useRouter();
  const { token } = router.query;
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});
  const [sessionData, setSessionData] = useState<ClientSessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  useEffect(() => {
    if (token && typeof token === "string") {
      fetchSessionData(token);
    }
  }, [token]);
  useEffect(() => {
    if (token && Object.keys(answers).length > 0) {
      const saveAnswers = async () => {
        setIsSaving(true);
        try {
          await fetch('/api/submitClientAnswers', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ token, answers }),
          });
        } catch (error) {
          console.error('Error auto-saving answers:', error);
        } finally {
          setIsSaving(false);
        }
      };
      const timeoutId = setTimeout(saveAnswers, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [answers, token]);

  const fetchSessionData = async (sessionToken: string) => {
    try {
      const response = await fetch(`/api/getClientSession?token=${sessionToken}`);
      if (response.ok) {
        const data = await response.json();
        setSessionData(data);
        if (data.answers) {
          setAnswers(data.answers);
        }
      } else {
        setError("Session not found or expired");
      }
    } catch (err) {
      setError("Failed to load session data");
    } finally {
      setLoading(false);
    }
  };
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newAnswers = { ...answers, [e.target.name]: e.target.value };
    setAnswers(newAnswers);
  };
  const nextStep = () => {
    if (step < questions.length - 1) setStep(step + 1);
  };
  const prevStep = () => {
    if (step > 0) setStep(step - 1);
  };
  const isLastStep = step === questions.length - 1;
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#4F1488] via-[#2E0A4F] to-[#18042A] flex items-center justify-center">
        <div className="text-white text-xl">Loading session...</div>
      </div>
    );
  }

  if (error || !sessionData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#4F1488] via-[#2E0A4F] to-[#18042A] flex items-center justify-center">
        <div className="text-white text-xl">{error || "Session not found"}</div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Vierra | Client Onboarding - {sessionData.clientName}</title>
      </Head>
      <div className="relative min-h-screen bg-gradient-to-br from-[#4F1488] via-[#2E0A4F] to-[#18042A] animate-gradient-move flex items-center justify-center overflow-hidden">
        <div className="absolute top-8 left-8 z-10">
          <Image
            src="/assets/vierra-logo.png"
            alt="Vierra Logo"
            width={120}
            height={40}
            className="w-auto h-10"
          />
        </div>

        <div className="absolute top-8 right-8 z-10 bg-[#2E0A4F]/90 backdrop-blur-md rounded-lg p-4">
          <div className={`text-white text-sm ${inter.className}`}>
            <div><strong>Client:</strong> {sessionData.clientName}</div>
            <div><strong>Email:</strong> {sessionData.clientEmail}</div>
            <div><strong>Business:</strong> {sessionData.businessName}</div>
            {isSaving && (
              <div className="mt-2 text-xs text-green-300 flex items-center">
                <span className="animate-pulse mr-2">●</span>
                Saving...
              </div>
            )}
          </div>
        </div>

        <div className="relative bg-[#2E0A4F]/90 backdrop-blur-md rounded-lg p-8 w-[90%] max-w-md shadow-lg z-10 flex flex-col items-center">
          <h2 className={`text-2xl font-bold mb-6 text-center text-white ${bricolage.className}`}>
            Welcome {sessionData.clientName}!
          </h2>
          <form className="w-full">
            <div className="mb-6">
              <label
                className={`block text-sm font-medium text-white mb-2 ${inter.className}`}
              >
                {questions[step].label}
              </label>
              {questions[step].type === "video" ? (
                <video
                  src={questions[step].videoUrl}
                  controls
                  className="w-full rounded shadow mb-2"
                />
              ) : (
                <input
                  type="text"
                  id={questions[step].name}
                  name={questions[step].name}
                  value={answers[questions[step].name] || ""}
                  onChange={handleChange}
                  placeholder={questions[step].placeholder}
                  className={`w-full border border-[#701CC0]/50 rounded-md p-2 bg-[#18042A] text-white placeholder-gray-400 ${inter.className}`}
                  autoComplete="off"
                />
              )}
            </div>
            <div className="flex justify-between">
              <button
                type="button"
                onClick={prevStep}
                disabled={step === 0}
                className={`px-4 py-2 rounded-md bg-gray-300 text-black shadow hover:scale-105 transition-transform ${inter.className} ${step === 0 ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                Previous
              </button>
              {!isLastStep ? (
                <button
                  type="button"
                  onClick={nextStep}
                  disabled={
                    questions[step].type === "text" && !answers[questions[step].name]
                  }
                  className={`px-4 py-2 rounded-md bg-purple-500 text-white shadow hover:scale-105 transition-transform ${bricolage.className} ${
                    questions[step].type === "text" && !answers[questions[step].name]
                      ? "opacity-50 cursor-not-allowed"
                      : ""
                  }`}
                >
                  Next
                </button>
              ) : (
                <button
                  type="submit"
                  className={`px-4 py-2 rounded-md bg-green-500 text-white shadow hover:scale-105 transition-transform ${bricolage.className}`}
                  disabled={questions[step].type === "text" && !answers[questions[step].name]}
                  onClick={async (e) => {
                    e.preventDefault();
                    try {
                      const response = await fetch('/api/submitClientAnswers', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ token, answers, completed: true }),
                      });

                      if (response.ok) {
                        alert("Submission Completed");
                      } else {
                        alert("There was an issue finalizing your submission, but your answers have been saved.");
                      }
                    } catch (error) {
                      console.error('Error completing questionnaire:', error);
                      alert("Your answers have been saved automatically. Thank you for your time!");
                    }
                  }}
                >
                  Complete
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default SessionQuestionnaire;
