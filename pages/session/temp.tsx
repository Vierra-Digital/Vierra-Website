import React, { useEffect, useRef, useState, useCallback } from "react";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import type { GetServerSideProps } from "next"; import { prisma } from "@/lib/prisma";
import { serialize as serializeCookie } from "cookie";


const bricolage = Bricolage_Grotesque({ subsets: ["latin"] });
const inter = Inter({ subsets: ["latin"] });

interface ClientSessionData {
  clientName: string;
  clientEmail: string;
  businessName: string;
  token: string;            // we’ll set this from the URL
  createdAt: number;        // epoch ms (we’ll convert server Date->ms)
  answers?: Record<string, string>;
  status?: "pending" | "in_progress" | "completed" | "expired" | "canceled";
  submittedAt?: number | null;
}

type Question =
  | { label: string; name: "Video1" | "Video2" | "Video3" | "Video4" | "Video5"; type: "video"; videoUrl: string; duration: number }
  | { label: string; name: "Social"; type: "social"; duration: number }
  | { label: string; name: "AboutYou"; placeholder: string; type: "text"; duration: number };

const questions: Question[] = [
  { label: "Introduction To Vierra", name: "Video1", type: "video", videoUrl: "/assets/onboarding/module1-intro.mp4", duration: 2 },
  { label: "Expectations, Communication, And How We Work", name: "Video2", type: "video", videoUrl: "/assets/onboarding/module2-expectations.mp4", duration: 2 },
  { label: "Signing Contracts And Paying Invoices", name: "Video3", type: "video", videoUrl: "/assets/onboarding/module3-contracts.mp4", duration: 2 },
  { label: "Connect Your Social Media Accounts", name: "Social", type: "social", duration: 2 },
  { label: "Tell us about yourself and your business", name: "AboutYou", placeholder: "Share details about your background, business goals, and what you hope to achieve with Vierra...", type: "text", duration: 2 },
  { label: "Strategy Meeting", name: "Video4", type: "video", videoUrl: "/assets/onboarding/module6-strategy.mp4", duration: 2 },
  { label: "Final Words", name: "Video5", type: "video", videoUrl: "/assets/onboarding/module7-final.mp4", duration: 2 },
];


export default function SessionQuestionnaire({ initialSession }: { initialSession: ClientSessionData }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(initialSession?.answers ?? {});
  const [sessionData, setSessionData] = useState<ClientSessionData | null>(initialSession ?? null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [fbConnected, setFb] = useState(false);
  const [liConnected, setLi] = useState(false);
  const [gaConnected, setGa] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  const [feedback, setFeedback] = useState<string>(initialSession?.answers?.feedback || "");

  // read token safely
  const token =
    router.query.token
      ? Array.isArray(router.query.token)
        ? router.query.token[0]
        : router.query.token
      : undefined;


  const sessionIdForOauth = sessionData?.token;

  function startOauth(provider: "facebook" | "linkedin" | "googleads") {
    if (!sessionIdForOauth) return;
    // onboarding flow uses the onboarding session id in `state`
    window.open(`/api/${provider}/initiate?session=${encodeURIComponent(sessionIdForOauth)}`, '_blank');
  }

  const refreshSocial = useCallback(async () => {
    if (!sessionIdForOauth) return;
    setSocialLoading(true);
    try {
      const [fb, li, ga] = await Promise.all([
        fetch(`/api/facebook/status?session=${encodeURIComponent(sessionIdForOauth)}`).then(r => r.ok ? r.json() : { connected: false }).catch(() => ({ connected: false })),
        fetch(`/api/linkedin/status?session=${encodeURIComponent(sessionIdForOauth)}`).then(r => r.ok ? r.json() : { connected: false }).catch(() => ({ connected: false })),
        fetch(`/api/googleads/status?session=${encodeURIComponent(sessionIdForOauth)}`).then(r => r.ok ? r.json() : { connected: false }).catch(() => ({ connected: false })),
      ]);
      setFb(!!fb.connected); setLi(!!li.connected); setGa(!!ga.connected);
    } finally {
      setSocialLoading(false);
    }
  }, [sessionIdForOauth]);


  // Debounce handle
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const cur = questions[step];
    if (cur?.type === "social") refreshSocial();
  }, [step, sessionIdForOauth, refreshSocial]);

  useEffect(() => {
    if (!router.isReady) return;
    if (router.query.linked) refreshSocial();
  }, [router.isReady, router.query.linked, sessionIdForOauth, refreshSocial]);


  // Fetch session once router is ready and token is a string
  useEffect(() => {
    (async () => {
      setLoading(true); setError(null);
      try {
        if (typeof token === "string") {
          // First hit with email link
          const resp = await fetch(`/api/session/${token}`);
          if (!resp.ok) throw new Error("Session not found or expired");
          const data = await resp.json();

          // Set cookie to resume later
          await fetch("/api/session/claim", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token }),
          });

          setSessionData({
            clientName: data.client.name,
            clientEmail: data.client.email,
            businessName: data.client.businessName,
            token: data.id,
            createdAt: new Date(data.createdAt).getTime(),
            answers: data.answers || {},
            status: data.status,
            submittedAt: data.submittedAt ? new Date(data.submittedAt).getTime() : null,
          });
          setAnswers(data.answers || {});
        } else {
          // Resume without token (after OAuth redirect)
          const resp = await fetch("/api/session/current");
          if (!resp.ok) throw new Error("No active onboarding session");
          const data = await resp.json();

          setSessionData({
            clientName: data.client.name,
            clientEmail: data.client.email,
            businessName: data.client.businessName,
            token: data.id,
            createdAt: new Date(data.createdAt).getTime(),
            answers: data.answers || {},
            status: data.status,
            submittedAt: data.submittedAt ? new Date(data.submittedAt).getTime() : null,
          });
          setAnswers(data.answers || {});
        }
      } catch (e: any) {
        setError(e.message || "Failed to load session");
      } finally {
        setLoading(false);
      }
    })();
  }, [router.isReady, token]);

  // Auto-save (debounced 500ms) whenever answers change
  useEffect(() => {
    if (typeof token !== "string") return;
    if (!sessionData) return;

    // Don’t autosave if nothing to save
    if (Object.keys(answers).length === 0) return;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      setIsSaving(true);
      try {
        await fetch("/api/session/submitClientAnswers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, answers }),
        });
      } catch (err) {
        console.error("Error auto-saving answers:", err);
      } finally {
        setIsSaving(false);
      }
    }, 500);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [answers, token, sessionData]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAnswers((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleFeedbackChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setFeedback(e.target.value);
    setAnswers((prev) => ({ ...prev, feedback: e.target.value }));
  };

  const nextStep = () => setStep((s) => Math.min(s + 1, questions.length - 1));
  const prevStep = () => setStep((s) => Math.max(s - 1, 0));
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

  const q = questions[step];
  const disableNext = q.type === "text" ? !answers[q.name] : false;

  return (
    <>
      <Head>
        <title>Vierra | Welcome To Vierra</title>
      </Head>
      <div className="min-h-screen bg-white">
        {/* Header */}
        <div className="bg-[#7A13D0] px-4 py-5 flex justify-center">
          <Image
            src={"/assets/vierra-logo-black-3.png"}
            alt={"Vierra Logo"}
            width={120}
            height={70}
            className="w-30 bg-white rounded-sm pt-2 px-3"
          />
        </div>

        {/* Main Content */}
        <div className="flex">
          {/* Left Content Area */}
          <div className="flex-1 p-8 flex flex-col items-center">
            <div className="w-full max-w-4xl">
              <h1 className={`text-3xl font-bold text-gray-900 mb-8 ${bricolage.className}`}>
                {q.label}
              </h1>

              {/* Content Container - Different layouts per question type */}
              {q.type === "video" ? (
                /* Video Player Container */
                <div className="bg-black rounded-lg overflow-hidden mb-6 relative max-w-5xl" style={{ aspectRatio: '16/9' }}>
                  <video 
                    src={q.videoUrl} 
                    controls 
                    className="w-full h-full object-cover"
                    poster="/assets/video-poster.jpg"
                  />

                  {/* Video Controls Bar */}
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
                    <div className="flex items-center gap-4 text-white">
                      {/* Play Controls */}
                      <button 
                        className="w-8 h-8 flex items-center justify-center hover:bg-white/20 rounded"
                        onClick={prevStep}
                        disabled={step === 0}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
                        </svg>
                      </button>
                      
                      <button className="w-8 h-8 flex items-center justify-center hover:bg-white/20 rounded">
                        <div className="w-0 h-0 border-l-[8px] border-l-white border-y-[6px] border-y-transparent"></div>
                      </button>
                      
                      <button 
                        className="w-8 h-8 flex items-center justify-center hover:bg-white/20 rounded"
                        onClick={nextStep}
                        disabled={isLastStep}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
                        </svg>
                      </button>

                      {/* Progress Bar */}
                      <div className="flex-1 mx-4">
                        <div className="relative h-1 bg-white/30 rounded-full">
                          <div 
                            className="absolute top-0 left-0 h-full bg-[#7A13D0] rounded-full transition-all duration-300"
                            style={{ width: `${((step + 1) / questions.length) * 100}%` }}
                          ></div>
                        </div>
                      </div>

                      {/* Time Display */}
                      <span className="text-sm font-mono">
                        {String(step + 1).padStart(2, '0')}:{String(questions.length).padStart(2, '0')}
                      </span>

                      {/* Volume and Settings */}
                      <button className="w-8 h-8 flex items-center justify-center hover:bg-white/20 rounded">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                        </svg>
                      </button>

                      <button className="w-8 h-8 flex items-center justify-center hover:bg-white/20 rounded">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ) : q.type === "social" ? (
                /* Social Connect Card */
                <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-8 mb-6 border border-purple-200">
                  <h3 className={`text-2xl font-bold text-gray-900 mb-6 ${bricolage.className}`}>Connect Your Accounts</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <button
                      type="button"
                      onClick={() => startOauth("facebook")}
                      className="flex flex-col items-center p-6 bg-white rounded-lg hover:bg-gray-50 transition border border-gray-200 shadow-sm"
                    >
                      <div className="w-12 h-12 bg-blue-600 rounded-lg mb-3 flex items-center justify-center">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                        </svg>
                      </div>
                      <span className="font-medium text-gray-900">Facebook</span>
                      <span className="text-xs text-green-600 mt-1">
                        {fbConnected ? "✓ Connected" : "Not Connected"}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => startOauth("linkedin")}
                      className="flex flex-col items-center p-6 bg-white rounded-lg hover:bg-gray-50 transition border border-gray-200 shadow-sm"
                    >
                      <div className="w-12 h-12 bg-blue-700 rounded-lg mb-3 flex items-center justify-center">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                        </svg>
                      </div>
                      <span className="font-medium text-gray-900">LinkedIn</span>
                      <span className="text-xs text-green-600 mt-1">
                        {liConnected ? "✓ Connected" : "Not Connected"}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => startOauth("googleads")}
                      className="flex flex-col items-center p-6 bg-white rounded-lg hover:bg-gray-50 transition border border-gray-200 shadow-sm"
                    >
                      <div className="w-12 h-12 bg-red-600 rounded-lg mb-3 flex items-center justify-center">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                        </svg>
                      </div>
                      <span className="font-medium text-gray-900">Google Ads</span>
                      <span className="text-xs text-green-600 mt-1">
                        {gaConnected ? "✓ Connected" : "Not Connected"}
                      </span>
                    </button>
                  </div>
                  
                  <button
                    type="button"
                    onClick={refreshSocial}
                    className="mt-6 px-4 py-2 bg-[#7A13D0] text-white rounded-lg hover:bg-[#6B11B8] transition text-sm font-medium"
                    disabled={socialLoading}
                  >
                    {socialLoading ? "Refreshing..." : "Refresh Status"}
                  </button>
                </div>
              ) : (
                /* Text Question Card */
                <div className="bg-gray-50 rounded-lg p-8 mb-6 border border-gray-200">
                  <h3 className={`text-2xl font-bold text-gray-900 mb-6 ${bricolage.className}`}>{q.label}</h3>
                  <input
                    type="text"
                    id={q.name}
                    name={q.name}
                    value={answers[q.name] || ""}
                    onChange={handleChange}
                    placeholder={q.type === "text" ? q.placeholder : ""}
                    className={`w-full p-4 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-[#7A13D0] focus:border-transparent ${inter.className}`}
                    autoComplete="off"
                  />
                </div>
              )}

              {/* Feedback Section */}
              <div className="mb-6">
                <h3 className={`text-lg font-semibold text-gray-900 mb-3 ${bricolage.className}`}>
                  Feedback
                </h3>
                <textarea
                  placeholder="Type your thoughts..."
                  rows={4}
                  value={feedback}
                  onChange={handleFeedbackChange}
                  className={`w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-[#7A13D0] focus:border-transparent text-black ${inter.className}`}
                />
              </div>

              {/* Navigation */}
              <div className="flex justify-between">
                {/* Previous Button */}
                <button
                  type="button"
                  onClick={prevStep}
                  disabled={step === 0}
                  className={`px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition ${bricolage.className} ${step === 0 ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  Previous
                </button>

                {/* Next/Complete Button */}
                {!isLastStep ? (
                  <button
                    type="button"
                    onClick={nextStep}
                    disabled={disableNext}
                    className={`px-6 py-3 bg-[#7A13D0] text-white rounded-lg font-semibold hover:bg-[#6B11B8] transition ${bricolage.className} ${disableNext ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    Next
                  </button>
                ) : (
                  <button
                    type="button"
                    className={`px-6 py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition ${bricolage.className}`}
                    disabled={q.type === "text" && !answers[q.name]}
                    onClick={async () => {
                      const sessionId =
                        sessionData?.token ??
                        (typeof token === "string" ? token : undefined);

                      if (!sessionId) {
                        alert("Session not ready yet. Please wait a moment and try again.");
                        return;
                      }

                      try {
                        const resp = await fetch("/api/session/submitClientAnswers", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ token: sessionId, answers, completed: true }),
                        });

                        if (resp.ok) {
                          alert("Submission Completed");
                          router.push("/");
                        } else {
                          const { message } = await resp.json().catch(() => ({ message: "" }));
                          alert(message || "There was an issue finalizing your submission, but your answers have been saved.");
                        }
                      } catch (err) {
                        console.error("Error completing questionnaire:", err);
                        alert("Your answers have been saved automatically. Thank you!");
                      }
                    }}
                  >
                    Complete
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Right Sidebar - Modules */}
          <div className="w-80 bg-white p-6 ">
            <h3 className={`text-lg font-semibold text-gray-900 mb-4 ${bricolage.className}`}>
              Modules
            </h3>
            
            <div className="space-y-3">
              {questions.map((question, index) => {
                const isCompleted = index < step || (index === step && q.type === "text" && answers[q.name]);
                const isCurrent = index === step;

                return (
                  <div
                    key={index}
                    className={`p-3 rounded-lg transition-all ${
                      isCurrent 
                        ? "bg-purple-100" 
                        : isCompleted
                        ? "bg-green-50"
                        : "bg-white"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        isCompleted
                          ? "bg-green-500 text-white"
                          : isCurrent
                          ? "bg-purple-500 text-white" 
                          : "bg-gray-300 text-gray-600"
                      }`}>
                        {isCompleted ? "✓" : index + 1}
                      </div>
                      
                      <div className="flex-1">
                        <div className={`font-medium text-sm ${inter.className} ${
                          isCurrent ? "text-purple-900" : isCompleted ? "text-green-900" : "text-gray-600"
                        }`}>
                          Module {index + 1}:
                        </div>
                        <div className={`text-xs ${inter.className} ${
                          isCurrent ? "text-purple-700" : isCompleted ? "text-green-700" : "text-gray-500"
                        }`}>
                          {question.label}
                        </div>
                        <div className={`text-xs ${inter.className} ${
                          isCurrent ? "text-purple-600" : isCompleted ? "text-green-600" : "text-gray-400"
                        }`}>
                        </div>
                        <div className={`text-xs ${inter.className} ${
                          isCurrent ? "text-purple-600" : isCompleted ? "text-green-600" : "text-gray-400"
                        }`}>
                          {question.duration} min{question.duration !== 1 ? 's' : ''}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Auto-save indicator */}
            {isSaving && (
              <div className="mt-6 flex items-center gap-2 text-sm text-gray-600">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className={inter.className}>Auto-saving...</span>
              </div>
            )}

            {/* Session Info */}
            <div className="mt-6 p-4 bg-white rounded-lg border border-gray-200">
              <div className={`text-sm ${inter.className}`}>
                <div className="font-medium text-gray-900 mb-2">Session Info</div>
                <div className="text-gray-600 space-y-1">
                  <div><strong>Client:</strong> {sessionData.clientName}</div>
                  <div><strong>Business:</strong> {sessionData.businessName}</div>
                  <div><strong>Progress:</strong> {step + 1}/{questions.length}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
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

  // set resume cookie so OAuth redirects can come back without token
  ctx.res.setHeader(
    "Set-Cookie",
    serializeCookie("ob_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24,
    })
  );

  return {
    props: {
      initialSession: {
        clientName: sess.client.name,
        clientEmail: sess.client.email,
        businessName: sess.client.businessName,
        token: sess.id,
        createdAt: new Date(sess.createdAt).getTime(),
        answers: (sess.answers as any) || {},
        status: sess.status,
        submittedAt: sess.submittedAt ? new Date(sess.submittedAt).getTime() : null,
      },
    },
  };
};
