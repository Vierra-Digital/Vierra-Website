import React, { useState } from "react";
import Head from "next/head";
import Image from "next/image";
import { Bricolage_Grotesque, Inter } from "next/font/google";

const bricolage = Bricolage_Grotesque({ subsets: ["latin"] });
const inter = Inter({ subsets: ["latin"] });

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
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<{ [key: string]: string }>({});

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAnswers({ ...answers, [e.target.name]: e.target.value });
  };

  const nextStep = () => {
    if (step < questions.length - 1) setStep(step + 1);
  };

  const prevStep = () => {
    if (step > 0) setStep(step - 1);
  };

  const isLastStep = step === questions.length - 1;

  return (
    <>
      <Head>
        <title>Vierra | Client Onboarding </title>
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
        <div className="relative bg-[#2E0A4F]/90 backdrop-blur-md rounded-lg p-8 w-[90%] max-w-md shadow-lg z-10 flex flex-col items-center">
          <h2 className={`text-2xl font-bold mb-6 text-center text-white ${bricolage.className}`}>
            Client Onboarding
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
                  // Only require input for text questions
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
                  onClick={(e) => {
                    e.preventDefault();
                    // Submit logic here
                  }}
                >
                  Submit
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