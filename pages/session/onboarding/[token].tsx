import React, { useEffect, useRef, useState, useCallback } from "react";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import { Inter } from "next/font/google";
import type { GetServerSideProps } from "next"; import { prisma } from "@/lib/prisma";
import { serialize as serializeCookie } from "cookie";

const inter = Inter({ subsets: ["latin"] });

interface ClientSessionData {
  clientName: string;
  clientEmail: string;
  businessName: string;
  monthlyRetainer?: number | null;
  token: string;           
  createdAt: number;        
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
  { label: "Signing Contracts And Paying Invoices", name: "Video3", type: "video", videoUrl: "/assets/onboarding/module3-contracts.mp4", duration: 5 },
  { label: "Connecting Social Media Accounts", name: "Social", type: "social", duration: 2 },
  { label: "About Your Business", name: "AboutYou", placeholder: "", type: "text", duration: 6 },
  { label: "Strategy Meeting", name: "Video4", type: "video", videoUrl: "/assets/onboarding/module6-strategy.mp4", duration: 3 },
  { label: "Final Words", name: "Video5", type: "video", videoUrl: "/assets/onboarding/module7-final.mp4", duration: 2 },
];

export default function SessionQuestionnaire({ initialSession }: { initialSession: ClientSessionData }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>(initialSession?.answers ?? {});
  const [sessionData, setSessionData] = useState<ClientSessionData | null>(initialSession ?? null);
  const [loading, setLoading] = useState(true);
  const [error] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [fbConnected, setFb] = useState(false);
  const [liConnected, setLi] = useState(false);
  const [gaConnected, setGa] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [redirectCountdown, setRedirectCountdown] = useState<number>(5);
  const [stripeConnected, setStripeConnected] = useState(false);
  const [stripeLoading, setStripeLoading] = useState(false);
  const [video3SubStep, setVideo3SubStep] = useState<0 | 1 | 2>(() => {
    const saved = initialSession?.answers?.video3SubStep;
    const savedNdaSigned = !!initialSession?.answers?.ndaSigned;
    return String(saved) === "2" || savedNdaSigned ? 2 : 0;
  });
  const [ndaSigned, setNdaSigned] = useState(!!initialSession?.answers?.ndaSigned);
  const [ndaLoading, setNdaLoading] = useState(false);
  const ndaSignWindowRef = useRef<Window | null>(null);
  const ndaPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [aboutYouSubStep, setAboutYouSubStep] = useState<0 | 1>(0);
  const [video4SubStep, setVideo4SubStep] = useState<0 | 1>(0);
  const [maxStepReached, setMaxStepReached] = useState(0);

  const token =
    router.query.token
      ? Array.isArray(router.query.token)
        ? router.query.token[0]
        : router.query.token
      : undefined;

  const sessionIdForOauth = sessionData?.token;

  function startOauth(provider: "facebook" | "linkedin" | "googleads") {
    if (!sessionIdForOauth) return;
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

  const handleNdaSign = useCallback(async () => {
    if (!token || ndaLoading) return;
    setNdaLoading(true);
    try {
      const resp = await fetch("/api/onboarding/generateNdaLink", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboardingToken: token }),
      });
      if (!resp.ok) throw new Error("Failed to generate NDA link");
      const { link, tokenId } = await resp.json();

      const signWindow = window.open(link, "_blank");
      ndaSignWindowRef.current = signWindow;

      if (ndaPollRef.current) clearInterval(ndaPollRef.current);
      ndaPollRef.current = setInterval(async () => {
        try {
          const statusResp = await fetch(`/api/onboarding/ndaStatus?tokenId=${encodeURIComponent(tokenId)}`);
          if (!statusResp.ok) return;
          const { signed } = await statusResp.json();
          if (signed) {
            if (ndaPollRef.current) clearInterval(ndaPollRef.current);
            ndaPollRef.current = null;
            setNdaSigned(true);
            setVideo3SubStep(2);
            setNdaLoading(false);
            try { ndaSignWindowRef.current?.close(); } catch {}
            ndaSignWindowRef.current = null;
          }
        } catch {}
      }, 3000);
    } catch {
      setNdaLoading(false);
    }
  }, [token, ndaLoading]);

  useEffect(() => {
    return () => {
      if (ndaPollRef.current) clearInterval(ndaPollRef.current);
      try { ndaSignWindowRef.current?.close(); } catch {}
      ndaSignWindowRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onNdaSigned = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data !== "nda-signed") return;
      if (ndaPollRef.current) clearInterval(ndaPollRef.current);
      ndaPollRef.current = null;
      setNdaSigned(true);
      setVideo3SubStep(2);
      setNdaLoading(false);
      try {
        const src = event.source as Window | null;
        src?.close();
      } catch {}
      try { ndaSignWindowRef.current?.close(); } catch {}
      ndaSignWindowRef.current = null;
    };

    window.addEventListener("message", onNdaSigned);
    return () => window.removeEventListener("message", onNdaSigned);
  }, []);

  const stripePollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stripeWindowRef = useRef<Window | null>(null);

  const checkStripeStatus = useCallback(async () => {
    if (!sessionIdForOauth) return false;
    try {
      const resp = await fetch(`/api/stripe/status?session=${encodeURIComponent(sessionIdForOauth)}`);
      if (resp.ok) {
        const { connected } = await resp.json();
        setStripeConnected(connected);
        return connected;
      }
    } catch {}
    return false;
  }, [sessionIdForOauth]);

  const handleStripeConnect = useCallback(async () => {
    if (!token || stripeLoading) return;
    setStripeLoading(true);
    try {
      const resp = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ onboardingToken: token }),
      });
      if (!resp.ok) throw new Error("Failed to create checkout session");
      const { url } = await resp.json();
      if (!url) return;

      const stripeWindow = window.open(url, "_blank");
      stripeWindowRef.current = stripeWindow;

      if (stripePollRef.current) clearInterval(stripePollRef.current);
      stripePollRef.current = setInterval(async () => {
        const connected = await checkStripeStatus();
        if (connected) {
          if (stripePollRef.current) clearInterval(stripePollRef.current);
          stripePollRef.current = null;
          setStripeLoading(false);
          try { stripeWindowRef.current?.close(); } catch {}
          stripeWindowRef.current = null;
        }
      }, 3000);
    } catch {
      setStripeLoading(false);
    }
  }, [token, stripeLoading, checkStripeStatus]);

  useEffect(() => {
    if (video3SubStep === 2) checkStripeStatus();
  }, [video3SubStep, checkStripeStatus]);

  useEffect(() => {
    return () => {
      if (stripePollRef.current) clearInterval(stripePollRef.current);
      try { stripeWindowRef.current?.close(); } catch {}
      stripeWindowRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onStripeConnected = (event: MessageEvent) => {
      if (event.data !== "stripe-connected") return;
      if (stripePollRef.current) clearInterval(stripePollRef.current);
      stripePollRef.current = null;
      setStripeConnected(true);
      setStripeLoading(false);
      try {
        const src = event.source as Window | null;
        src?.close();
      } catch {}
      try { stripeWindowRef.current?.close(); } catch {}
      stripeWindowRef.current = null;
    };

    window.addEventListener("message", onStripeConnected);
    return () => window.removeEventListener("message", onStripeConnected);
  }, []);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setMaxStepReached((prev) => Math.max(prev, step));
  }, [step]);

  useEffect(() => {
    const cur = questions[step];
    if (cur?.type === "social") refreshSocial();
  }, [step, refreshSocial]);

  useEffect(() => {
    if (!showSuccessModal) return;

    setRedirectCountdown(5);
    const interval = setInterval(() => {
      setRedirectCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          router.push("/");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [showSuccessModal, router]);

  useEffect(() => {
    if (!router.isReady) return;
    if (router.query.linked) refreshSocial();
  }, [router.isReady, router.query.linked, refreshSocial]);

  useEffect(() => {
    async function fetchSession() {
      if (!token) return;
      setLoading(true);
      try {
        const resp = await fetch(`/api/session/${token}`);
        if (!resp.ok) throw new Error("Session not found or expired");
        const data = await resp.json();
        setSessionData({
          clientName: data.client.name,
          clientEmail: data.client.email,
          businessName: data.client.businessName,
          monthlyRetainer: typeof data.client.monthlyRetainerCents === "number" ? data.client.monthlyRetainerCents / 100 : null,
          token: data.id,
          createdAt: new Date(data.createdAt).getTime(),
          answers: data.answers || {},
          status: data.status,
          submittedAt: data.submittedAt ? new Date(data.submittedAt).getTime() : null,
        });
        setAnswers(data.answers || {});
        const saved = data.answers?.video3SubStep;
        const savedNdaSigned = !!data.answers?.ndaSigned;
        setNdaSigned(savedNdaSigned);
        setVideo3SubStep(String(saved) === "2" || savedNdaSigned ? 2 : 0);
        setAboutYouSubStep(0);
        setVideo4SubStep(0);
        const ans = data.answers || {};
        const aboutYouFields = ["website", "brandTone", "productService", "valueProposition", "targetAudience", "socialMediaGoals", "leadGeneration"];
        const hasAboutYou = aboutYouFields.some((f: string) => (ans[f] || "").trim());
        const hasOperations = !!(ans.avoidMentions || ans.additionalInfo || ans.meetingAvailability);
        let inferredMax = 0;
        if (String(ans.video4SubStep) === "1" || hasOperations) inferredMax = 5;
        else if (hasAboutYou || String(ans.aboutYouSubStep) === "1") inferredMax = 4;
        else if (String(ans.video3SubStep) === "2" || savedNdaSigned) inferredMax = 3;
        setMaxStepReached((prev) => Math.max(prev, inferredMax));
      } catch {
        setSessionData(initialSession);
        setAnswers(initialSession.answers || {});
      } finally {
        setLoading(false);
      }
    }
    fetchSession();
  }, [token, initialSession]);

  useEffect(() => {
    if (typeof token !== "string") return;
    if (!sessionData) return;

    const extendedAnswers = { ...answers };
    if (step === 2) {
      extendedAnswers.video3SubStep = String(video3SubStep);
      extendedAnswers.ndaSigned = ndaSigned ? "true" : "";
    }
    if (step === 4 && questions[step]?.name === "AboutYou") {
      extendedAnswers.aboutYouSubStep = String(aboutYouSubStep);
    }
    if (step === 5 && questions[step]?.name === "Video4") {
      extendedAnswers.video4SubStep = String(video4SubStep);
    }

    if (Object.keys(extendedAnswers).length === 0 && !extendedAnswers.video3SubStep) return;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(async () => {
      setIsSaving(true);
      try {
        const orderedAnswers = Object.entries(extendedAnswers)
          .filter(([, value]) => value && (typeof value === 'string' ? value.trim() : true))
          .filter(([key]) => !["video3SubStep", "ndaSigned", "aboutYouSubStep", "video4SubStep"].includes(key))
          .map(([key, value]) => ({
            questionKey: key,
            answer: typeof value === 'string' ? value : String(value),
            timestamp: new Date().toISOString(),
            stepIndex: questions.findIndex(q => q.name === key)
          }))
          .sort((a, b) => a.stepIndex - b.stepIndex);

        await fetch("/api/onboarding/saveAnswers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token,
            answers: extendedAnswers,
            orderedAnswers,
            clientAnswers: true,
          }),
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
  }, [answers, token, sessionData, step, video3SubStep, ndaSigned, aboutYouSubStep, video4SubStep]);

  const isVideo3 = step === 2 && questions[step]?.name === "Video3";
  const isVideo4 = step === 5 && questions[step]?.name === "Video4";
  const isAboutYou = step === 4 && questions[step]?.name === "AboutYou";

  const nextStep = () => {
    if (isVideo3) {
      if (video3SubStep === 0) setVideo3SubStep(1);
      else if (video3SubStep === 1) setVideo3SubStep(2);
      else { setVideo3SubStep(0); setStep((s) => Math.min(s + 1, questions.length - 1)); }
    } else if (isAboutYou) {
      if (aboutYouSubStep === 0) setAboutYouSubStep(1);
      else { setAboutYouSubStep(0); setStep((s) => Math.min(s + 1, questions.length - 1)); }
    } else if (isVideo4) {
      if (video4SubStep === 0) setVideo4SubStep(1);
      else { setVideo4SubStep(0); setStep((s) => Math.min(s + 1, questions.length - 1)); }
    } else setStep((s) => Math.min(s + 1, questions.length - 1));
  };

  const prevStep = () => {
    if (isVideo3 && video3SubStep > 0) setVideo3SubStep((s) => (s - 1) as 0 | 1 | 2);
    else if (isAboutYou && aboutYouSubStep === 1) setAboutYouSubStep(0);
    else if (isVideo4 && video4SubStep === 1) setVideo4SubStep(0);
    else setStep((s) => Math.max(s - 1, 0));
  };

  const isLastStep = step === questions.length - 1;

  if (loading) {
    return (
      <div className="relative min-h-screen bg-gradient-to-br from-[#4F1488] via-[#2E0A4F] to-[#18042A] flex flex-col items-center justify-center gap-6">
        <Image
          src="/assets/vierra-logo.png"
          alt="Vierra"
          width={150}
          height={50}
          className="w-auto h-10 opacity-80"
          priority
        />
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2 w-2 rounded-full bg-white/70 animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
        <p className={`text-white/80 text-sm ${inter.className}`}>Loading Your Session...</p>
      </div>
    );
  }

  if (error || !sessionData) {
    return (
      <div className="min-h-screen bg-[#FAFAFA] flex items-center justify-center">
        <div className={`text-[#374151] text-lg ${inter.className}`}>{error || "Session not found"}</div>
      </div>
    );
  }

  if (showSuccessModal) {
    return (
      <>
        <Head>
          <title>Vierra | Modules Completed</title>
          <meta name="robots" content="noindex, nofollow" />
        </Head>
        <div className={`min-h-screen bg-[#FAFAFA] ${inter.className}`}>
          <header className="bg-white border-b border-[#E5E7EB] px-4 lg:px-6 py-2 flex items-center justify-between">
            <div className="h-12 lg:h-14 w-32 lg:w-36 overflow-hidden flex items-center shrink-0">
              <Image
                src="/assets/vierra-logo-black.png"
                alt="Vierra"
                width={320}
                height={96}
                className="h-full w-full object-cover object-center"
                priority
              />
            </div>
            <div className={`hidden sm:flex items-center gap-3 text-sm ${inter.className}`}>
              {isSaving && (
                <span className="flex items-center gap-1.5 text-[#6B7280]">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  Saving...
                </span>
              )}
            </div>
          </header>

          <div className="flex items-center justify-center p-4 lg:p-8 min-h-[calc(100vh-3.5rem)]">
            <div className="rounded-2xl border border-[#E5E7EB] bg-white shadow-sm p-6 lg:p-10 text-center max-w-xl w-full">
              <div className="relative mb-4 inline-flex h-16 w-16 items-center justify-center mx-auto">
                <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-30 animate-ping" />
                <span className="relative inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500 text-white">
                    <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                </span>
              </div>
              <h2 className="text-xl font-semibold text-[#111827] mb-2">Modules Completed Successfully!</h2>
              <p className="text-sm text-[#6B7280]">You&apos;ve completed all modules. Thank you for your time.</p>
              <p className="text-sm text-[#6B7280] mt-4">
                Redirecting in {redirectCountdown} second{redirectCountdown !== 1 ? "s" : ""}...
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  const q = questions[step];
  const aboutYouFields = ["website", "brandTone", "productService", "valueProposition", "targetAudience", "socialMediaGoals", "leadGeneration"];
  const operationsFields = ["avoidMentions", "additionalInfo", "meetingAvailability", "meetingTime1Day", "meetingTime1Time", "meetingTime2Day", "meetingTime2Time", "meetingTime3Day", "meetingTime3Time", "meetingTime4Day", "meetingTime4Time"];
  const brandFields = ["website", "brandTone", "productService", "valueProposition"];
  const audienceFields = ["targetAudience", "socialMediaGoals", "leadGeneration"];
  const aboutYouComplete = aboutYouFields.every((f) => (answers[f] || "").trim());
  const currentSectionComplete = isAboutYou
    ? (aboutYouSubStep === 0 ? brandFields.every((f) => (answers[f] || "").trim()) : audienceFields.every((f) => (answers[f] || "").trim()))
    : aboutYouComplete;
  const disableNext = q.type === "text" ? (questions[step]?.name === "AboutYou" ? !currentSectionComplete : !answers[(q as { name: string }).name]) : false;
  const meetingAvailabilityComplete = (answers.meetingAvailability || "").trim().length > 0;
  const showContinueInNav = !isVideo3 || video3SubStep !== 1 || ndaSigned;
  const isNextDisabled = disableNext || (isVideo3 && video3SubStep === 1 && !ndaSigned) || (isVideo4 && video4SubStep === 1 && !meetingAvailabilityComplete);
  const TOTAL_SLIDES = 11;
  const getCompletedSlides = () => {
    const effectiveStep = step < maxStepReached ? maxStepReached : step;
    let completed = 0;
    for (let i = 0; i < effectiveStep; i++) {
      if (i === 2) completed += 3;
      else if (i === 4) completed += 2;
      else if (i === 5) completed += 2;
      else completed += 1;
    }
    if (effectiveStep === 2) completed += video3SubStep;
    else if (effectiveStep === 4) completed += aboutYouSubStep;
    else if (effectiveStep === 5) completed += video4SubStep;
    return completed;
  };
  const progressPercent = Math.round((getCompletedSlides() / TOTAL_SLIDES) * 100);

  return (
    <>
      <Head>
        <title>Vierra | Welcome To Vierra</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
      <div className="min-h-screen bg-[#FAFAFA] overflow-auto hide-scrollbar">
        
        <header className="bg-white border-b border-[#E5E7EB] px-4 lg:px-6 py-2 flex items-center justify-between">
          <div className="h-12 lg:h-14 w-32 lg:w-36 overflow-hidden flex items-center shrink-0">
            <Image
              src="/assets/vierra-logo-black.png"
              alt="Vierra"
              width={320}
              height={96}
              className="h-full w-full object-cover object-center"
              priority
            />
          </div>
          <div className={`hidden sm:flex items-center gap-3 text-sm ${inter.className}`}>
            {isSaving && (
              <span className="flex items-center gap-1.5 text-[#6B7280]">
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                Saving...
              </span>
            )}
          </div>
        </header>

        
        <div className="flex flex-col lg:flex-row min-h-[calc(100vh-5rem)]">
          
          <div className="flex-1 p-6 lg:p-10 xl:p-14">
            <div className="w-full max-w-4xl mx-auto">

              
              <div className="flex items-center gap-3 mb-2">
                <span className={`text-xs font-semibold tracking-widest uppercase text-[#7A13D0] ${inter.className}`}>
                  Module {step + 1} of {questions.length}
                </span>
                <span className={`text-xs text-[#9CA3AF] ${inter.className}`}>
                  {progressPercent}% Complete
                </span>
              </div>

              
              <div className="w-full h-1 bg-[#E5E7EB] rounded-full mb-8">
                <div
                  className="h-full bg-gradient-to-r from-[#7A13D0] to-[#9D4EDD] rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              
              <h1 className={`text-3xl lg:text-4xl font-semibold text-[#111827] mb-8 leading-tight tracking-tight ${inter.className}`}>
                {q.label}
              </h1>

              
              {q.type === "video" && (!isVideo3 || video3SubStep === 0) && (!isVideo4 || video4SubStep === 0) ? (
                <div className="rounded-2xl overflow-hidden shadow-lg mb-8 bg-black">
                  <video
                    key={q.videoUrl}
                    src={q.videoUrl}
                    controls
                    className="w-full"
                    style={{ aspectRatio: '16/9' }}
                    poster="/assets/video-poster.jpg"
                  />
                </div>
              ) : isVideo3 && video3SubStep === 1 ? (
                <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 lg:p-10 mb-8 shadow-sm">
                  <p className={`text-[#6B7280] mb-6 text-base ${inter.className}`}>
                    Please review and sign the NDA to continue.
                  </p>
                  <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between p-5 lg:p-6 border-2 border-[#E5E7EB] rounded-xl gap-4 bg-[#FAFAFA]">
                    <div className="flex items-center flex-1 min-w-0">
                      <div className="w-12 h-12 lg:w-16 lg:h-16 rounded-xl mr-4 lg:mr-6 flex items-center justify-center overflow-hidden flex-shrink-0 bg-white border border-[#E5E7EB]">
                        <Image
                          src="/assets/Onboarding/document-text.png"
                          alt="Document"
                          width={64}
                          height={64}
                          className="w-10 h-10 lg:w-12 lg:h-12 object-contain"
                          unoptimized
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={`font-semibold text-[#111827] text-sm lg:text-base ${inter.className}`}>Non-Disclosure Agreement</div>
                        <div className={`text-xs lg:text-sm text-[#6B7280] mt-1 line-clamp-2 ${inter.className}`}>
                          Vierra Digital LLC Non-Disclosure Agreement. This agreement is entered by and between...
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-row items-center gap-4 lg:gap-8 w-full lg:w-auto justify-between lg:justify-end">
                      <div className="text-center lg:text-left">
                        <div className={`text-xs lg:text-sm font-semibold text-[#111827] ${inter.className}`}>Signed By</div>
                        <div className={`text-xs lg:text-sm text-[#6B7280] ${inter.className}`}>{sessionData.clientName}</div>
                      </div>
                      {ndaSigned ? (
                        <span className="flex items-center gap-1.5 px-4 py-2.5 bg-green-100 text-green-700 rounded-xl text-sm font-semibold">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          Signed
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={handleNdaSign}
                          disabled={ndaLoading}
                          className="px-5 py-2.5 bg-[#7A13D0] text-white rounded-xl text-sm font-semibold hover:bg-[#6B11B8] transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {ndaLoading ? "Waiting..." : "Sign"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ) : isVideo3 && video3SubStep === 2 ? (
                <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 lg:p-10 mb-8 shadow-sm">
                  <p className={`text-[#6B7280] mb-6 text-base ${inter.className}`}>
                    Connect your payment method to our payment processor to securely automate payments for our services, ensuring seamless billing and real-time financial tracking.
                  </p>
                  <div className="flex flex-col items-center justify-center py-10 px-6 bg-[#FAFAFA] rounded-xl border border-[#E5E7EB]">
                    <div className="text-[#6772E5] text-3xl lg:text-4xl font-bold mb-2" style={{ fontFamily: 'system-ui, sans-serif' }}>stripe</div>
                    {stripeConnected ? (
                      <>
                        <p className={`text-green-600 mb-4 text-sm font-semibold ${inter.className}`}>Payment Method Connected</p>
                        <span className="flex items-center gap-1.5 px-4 py-2.5 bg-green-100 text-green-700 rounded-xl text-sm font-semibold">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          Connected
                        </span>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={handleStripeConnect}
                          disabled={stripeLoading}
                          className="px-6 py-3 bg-[#6772E5] text-white rounded-xl font-semibold hover:bg-[#5a64d4] transition text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {stripeLoading ? "Waiting..." : "Connect to Stripe"}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ) : isVideo4 && video4SubStep === 1 ? (
                <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 lg:p-10 mb-8 shadow-sm">
                  <h2 className={`text-xl font-semibold text-[#111827] mb-2 tracking-tight ${inter.className}`}>Operations</h2>
                  <p className={`text-[#6B7280] mb-6 text-base ${inter.className}`}>
                    This allows us understand logistical preferences and any sensitive or additional details.
                  </p>
                  <div className="space-y-5">
                    <div>
                      <label className={`block text-sm font-medium text-[#374151] mb-2 ${inter.className}`}>
                        Is there anything we should avoid mentioning (competitors, sensitive terms, compliance restrictions)?
                      </label>
                      <textarea
                        name="avoidMentions"
                        value={answers.avoidMentions || ""}
                        onChange={(e) => setAnswers(prev => ({ ...prev, [e.target.name]: e.target.value }))}
                        placeholder=""
                        rows={3}
                        className={`w-full p-3 bg-[#FAFAFA] border border-[#E5E7EB] rounded-xl text-[#111827] placeholder-[#9CA3AF] focus:ring-2 focus:ring-[#7A13D0]/20 focus:border-[#7A13D0] outline-none resize-none ${inter.className}`}
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium text-[#374151] mb-2 ${inter.className}`}>
                        Please list several days/times (with timezone) of the week that work for weekly update meetings.
                      </label>
                      <p className={`text-xs text-[#9CA3AF] mb-3 ${inter.className}`}>
                        A meeting link will be generated once the onboarding is complete.
                      </p>
                      <textarea
                        name="meetingAvailability"
                        value={answers.meetingAvailability || ""}
                        onChange={(e) => setAnswers(prev => ({ ...prev, [e.target.name]: e.target.value }))}
                        placeholder="Example: Tuesdays 2:00 PM EST, Thursdays 11:30 AM EST, Fridays 9:00 AM PST"
                        rows={4}
                        className={`w-full p-3 bg-[#FAFAFA] border border-[#E5E7EB] rounded-xl text-[#111827] placeholder-[#9CA3AF] focus:ring-2 focus:ring-[#7A13D0]/20 focus:border-[#7A13D0] outline-none resize-none ${inter.className}`}
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <label className={`block text-sm font-medium text-[#374151] mb-2 ${inter.className}`}>
                        Do you have anything else to add about your company, clients, needs, or questions?
                      </label>
                      <textarea
                        name="additionalInfo"
                        value={answers.additionalInfo || ""}
                        onChange={(e) => setAnswers(prev => ({ ...prev, [e.target.name]: e.target.value }))}
                        placeholder=""
                        rows={4}
                        className={`w-full p-3 bg-[#FAFAFA] border border-[#E5E7EB] rounded-xl text-[#111827] placeholder-[#9CA3AF] focus:ring-2 focus:ring-[#7A13D0]/20 focus:border-[#7A13D0] outline-none resize-none ${inter.className}`}
                        autoComplete="off"
                      />
                    </div>
                  </div>
                </div>
              ) : q.type === "social" ? (
                <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 lg:p-10 mb-8 shadow-sm">
                  <p className={`text-[#6B7280] mb-8 text-base ${inter.className}`}>
                    Link your accounts so we can hit the ground running with your marketing strategy.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:gap-6">
                    {[
                      { provider: "facebook" as const, label: "Facebook", connected: fbConnected, color: "bg-[#1877F2]", icon: "M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" },
                      { provider: "linkedin" as const, label: "LinkedIn", connected: liConnected, color: "bg-[#0A66C2]", icon: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" },
                      { provider: "googleads" as const, label: "Google Ads", connected: gaConnected, color: "bg-[#EA4335]", icon: "" },
                    ].map(({ provider, label, connected, color, icon }) => (
                      <button
                        key={provider}
                        type="button"
                        onClick={() => startOauth(provider)}
                        className="group flex flex-col items-center p-5 lg:p-6 bg-[#FAFAFA] rounded-xl hover:bg-white hover:shadow-md transition-all border border-[#E5E7EB] hover:border-[#7A13D0]/30"
                      >
                        <div className={`w-12 h-12 ${color} rounded-xl mb-3 flex items-center justify-center shadow-sm`}>
                          {icon ? (
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d={icon}/></svg>
                          ) : (
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="white">
                              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                            </svg>
                          )}
                        </div>
                        <span className={`font-medium text-[#111827] text-sm ${inter.className}`}>{label}</span>
                        <span className={`text-xs mt-1.5 font-medium ${connected ? "text-green-600" : "text-[#9CA3AF]"} ${inter.className}`}>
                          {connected ? "Connected" : "Not Connected"}
                        </span>
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={refreshSocial}
                    className={`mt-6 px-5 py-2.5 text-sm font-medium rounded-lg border border-[#E5E7EB] text-[#374151] hover:bg-[#F3F4F6] transition ${inter.className}`}
                    disabled={socialLoading}
                  >
                    {socialLoading ? "Checking..." : "Refresh Status"}
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 lg:p-10 mb-8 shadow-sm overflow-hidden">
                  <div className="overflow-hidden" style={{ minHeight: 320 }}>
                    {aboutYouSubStep === 0 ? (
                      <div className="space-y-5">
                        <p className={`text-[#6B7280] mb-5 text-base ${inter.className}`}>
                          This allows us understand your business, brand, and unique characteristics. Adding more details to your responses will help us get you better results.
                        </p>
                        {[
                          { name: "website", label: "What's your company website or main online presence?", type: "text" as const },
                          { name: "brandTone", label: "Do you have a preferred brand tone/voice (professional, playful, luxury, etc)?", type: "text" as const },
                          { name: "productService", label: "Briefly describe your product or service in one sentence.", type: "textarea" as const },
                          { name: "valueProposition", label: "What's your main value proposition or unique selling point (why customers choose you)?", type: "textarea" as const },
                        ].map(({ name, label, type }) => (
                          <div key={name}>
                            <label className={`block text-sm font-medium text-[#374151] mb-2 ${inter.className}`}>{label}</label>
                            {type === "text" ? (
                              <input
                                name={name}
                                value={answers[name] || ""}
                                onChange={(e) => setAnswers(prev => ({ ...prev, [e.target.name]: e.target.value }))}
                                placeholder=""
                                className={`w-full p-3 bg-[#FAFAFA] border border-[#E5E7EB] rounded-xl text-[#111827] placeholder-[#9CA3AF] focus:ring-2 focus:ring-[#7A13D0]/20 focus:border-[#7A13D0] outline-none ${inter.className}`}
                                autoComplete="off"
                              />
                            ) : (
                              <textarea
                                name={name}
                                value={answers[name] || ""}
                                onChange={(e) => setAnswers(prev => ({ ...prev, [e.target.name]: e.target.value }))}
                                placeholder=""
                                rows={2}
                                className={`w-full p-3 bg-[#FAFAFA] border border-[#E5E7EB] rounded-xl text-[#111827] placeholder-[#9CA3AF] focus:ring-2 focus:ring-[#7A13D0]/20 focus:border-[#7A13D0] outline-none resize-none ${inter.className}`}
                                autoComplete="off"
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="space-y-5">
                        <p className={`text-[#6B7280] mb-5 text-base ${inter.className}`}>
                          This allows us understand your target audience and marketing goals. Adding more details to your responses will help us get you better results.
                        </p>
                        {[
                          { name: "targetAudience", label: "Who is your target audience (age, location, interests, demographics)?", type: "textarea" as const },
                          { name: "socialMediaGoals", label: "What's your primary desire for social media growth (leads, awareness, event signups, etc)?", type: "textarea" as const },
                          { name: "leadGeneration", label: "Describe your current lead generation funnel and primary offer.", type: "textarea" as const },
                        ].map(({ name, label }) => (
                          <div key={name}>
                            <label className={`block text-sm font-medium text-[#374151] mb-2 ${inter.className}`}>{label}</label>
                            <textarea
                              name={name}
                              value={answers[name] || ""}
                              onChange={(e) => setAnswers(prev => ({ ...prev, [e.target.name]: e.target.value }))}
                              placeholder=""
                              rows={3}
                              className={`w-full p-3 bg-[#FAFAFA] border border-[#E5E7EB] rounded-xl text-[#111827] placeholder-[#9CA3AF] focus:ring-2 focus:ring-[#7A13D0]/20 focus:border-[#7A13D0] outline-none resize-none ${inter.className}`}
                              autoComplete="off"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={prevStep}
                  disabled={step === 0}
                  className={`group flex items-center gap-2 px-5 py-3 rounded-xl text-sm font-semibold transition ${inter.className} ${
                    step === 0
                      ? "text-[#D1D5DB] cursor-not-allowed"
                      : "text-[#374151] hover:bg-[#F3F4F6]"
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Previous
                </button>

                {!isLastStep ? (
                  showContinueInNav && (
                    <button
                      type="button"
                      onClick={nextStep}
                      disabled={isNextDisabled}
                      className={`group flex items-center gap-2 px-7 py-3 rounded-xl text-sm font-semibold transition shadow-sm ${inter.className} ${
                        isNextDisabled
                          ? "bg-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed"
                          : "bg-[#7A13D0] text-white hover:bg-[#6B11B8] shadow-[#7A13D0]/20"
                      }`}
                    >
                      Continue
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    className={`group flex items-center gap-2 px-7 py-3 rounded-xl text-sm font-semibold transition shadow-sm ${inter.className} ${
                      (q.type === "text" && (questions[step]?.name === "AboutYou" ? !aboutYouComplete : !answers[(q as { name: string }).name]))
                        ? "bg-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed"
                        : "bg-[#059669] text-white hover:bg-[#047857]"
                    }`}
                    disabled={q.type === "text" && (questions[step]?.name === "AboutYou" ? !aboutYouComplete : !answers[(q as { name: string }).name])}
                    onClick={async () => {
                      const sessionId = sessionData?.token;
                      if (!sessionId) {
                        alert("Session not ready yet. Please wait a moment and try again.");
                        return;
                      }
                      try {
                        const completeResp = await fetch('/api/session/submitClientAnswers', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            token: sessionId,
                            answers,
                            completed: true
                          }),
                        });
                        if (!completeResp.ok) {
                          const errData = await completeResp.json().catch(() => ({}));
                          throw new Error(errData?.message || "Failed to complete modules");
                        }
                        setShowSuccessModal(true);
                      } catch (err) {
                        console.error("Error completing questionnaire:", err);
                        alert("Failed to complete modules. Please try again.");
                      }
                    }}
                  >
                    Complete Modules
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>

          
          <aside className="w-full lg:w-80 xl:w-[340px] bg-white border-t lg:border-t-0 lg:border-l border-[#E5E7EB] p-6 lg:p-8 flex flex-col">
            <h3 className={`text-sm font-semibold tracking-widest uppercase text-[#9CA3AF] mb-5 ${inter.className}`}>
              Modules
            </h3>

            <div className="space-y-1.5 flex-1">
              {questions.map((question, index) => {
                const isCurrent = index === step;
                const isCompleted = index < maxStepReached && index !== step;
                const isPending = index === maxStepReached && index !== step;
                const isLocked = index > maxStepReached;

                return (
                  <button
                    key={index}
                    type="button"
                    onClick={() => { if (!isLocked) setStep(index); }}
                    disabled={isLocked}
                    className={`w-full text-left p-3 rounded-xl transition-all flex items-start gap-3 ${
                      isLocked
                        ? "opacity-50 cursor-not-allowed"
                        : isCurrent
                        ? "bg-[#7A13D0]/5 ring-1 ring-[#7A13D0]/20"
                        : isPending
                        ? "bg-[#FEF3C7]/30 ring-1 ring-amber-200"
                        : isCompleted
                        ? "hover:bg-[#F9FAFB]"
                        : "hover:bg-[#F9FAFB] opacity-60"
                    }`}
                  >
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${
                      isCompleted
                        ? "bg-[#059669] text-white"
                        : isCurrent
                        ? "bg-[#7A13D0] text-white"
                        : isPending
                        ? "bg-[#FEF3C7] text-[#92400E] border border-amber-200"
                        : isLocked
                        ? "bg-[#E5E7EB] text-[#9CA3AF]"
                        : "bg-[#E5E7EB] text-[#9CA3AF]"
                    }`}>
                      {isCompleted ? (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : isLocked ? (
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      ) : (
                        index + 1
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-medium leading-snug ${inter.className} ${
                        isCurrent ? "text-[#111827]" : isPending ? "text-[#92400E]" : isCompleted ? "text-[#374151]" : "text-[#6B7280]"
                      }`}>
                        {question.label}
                      </div>
                      <div className={`text-xs mt-0.5 ${inter.className} ${
                        isCurrent ? "text-[#7A13D0]" : isPending ? "text-[#92400E]" : "text-[#9CA3AF]"
                      }`}>
                        {question.name === "Video3" ? "5 min · Video And Action" : question.name === "Video4" ? `${question.duration} min · Video And Response` : `${question.duration} min · ${question.type === "video" ? "Video" : question.type === "social" ? "Action" : "Response"}`}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            
            <div className="mt-8 pt-6 border-t border-[#E5E7EB]">
              <div className={`text-xs text-[#9CA3AF] space-y-1.5 ${inter.className}`}>
                <div className="flex justify-between">
                  <span>Client</span>
                  <span className="text-[#374151] font-medium">{sessionData.clientName}</span>
                </div>
                <div className="flex justify-between">
                  <span>Business</span>
                  <span className="text-[#374151] font-medium">{sessionData.businessName}</span>
                </div>
              </div>
            </div>
          </aside>
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
        monthlyRetainer: typeof sess.client.monthlyRetainerCents === "number" ? sess.client.monthlyRetainerCents / 100 : null,
        token: sess.id,
        createdAt: new Date(sess.createdAt).getTime(),
        answers: (sess.answers as any) || {},
        status: sess.status,
        submittedAt: sess.submittedAt ? new Date(sess.submittedAt).getTime() : null,
      },
    },
  };
};
