import React, { useEffect, useRef, useState } from "react";
import Head from "next/head";
import Image from "next/image";
import { useRouter } from "next/router";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import type { GetServerSideProps } from "next"; import { prisma } from "@/lib/prisma";
import cookie from "cookie";


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
  | { label: string; name: string; type: "text"; placeholder: string }
  | { label: string; name: string; type: "video"; videoUrl: string }
  | { label: string; name: string; type: "social" };

const questions: Question[] = [
  { label: "How are you doing?", name: "Q1", placeholder: "Answer", type: "text" },
  { label: "Watch this short introduction video before continuing.", name: "Video", type: "video", videoUrl: "/assets/onboarding-intro.mp4" },
  { label: "Connect your accounts", name: "Social", type: "social" },
  { label: "What is your Major?", name: "Q2", placeholder: "Answer", type: "text" },
  { label: "What is the name of your Business?", name: "Q3", placeholder: "Answer", type: "text" },
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
    window.location.href = `/api/${provider}/initiate?session=${encodeURIComponent(sessionIdForOauth)}`;
  }

  async function refreshSocial() {
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
  }


  // Debounce handle
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const cur = questions[step];
    if (cur?.type === "social") refreshSocial();
  }, [step, sessionIdForOauth]);

  useEffect(() => {
    if (!router.isReady) return;
    if (router.query.linked) refreshSocial();
  }, [router.isReady, router.query.linked, sessionIdForOauth]);


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
        <title>Vierra | Client Onboarding - {sessionData.clientName}</title>
      </Head>
      <div className="relative min-h-screen bg-gradient-to-br from-[#4F1488] via-[#2E0A4F] to-[#18042A] animate-gradient-move flex items-center justify-center overflow-hidden">
        <div className="absolute top-8 left-8 z-10">
          <Image src="/assets/vierra-logo.png" alt="Vierra Logo" width={120} height={40} className="w-auto h-10" />
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
              <label className={`block text-sm font-medium text-white mb-2 ${inter.className}`}>
                {q.label}
              </label>

              {q.type === "social" ? (
                <div className="space-y-3">
                  <p className={`text-white/80 mb-2 ${inter.className}`}>
                    Connect any ad accounts now (optional). You can also do this later.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => startOauth("facebook")}
                      className="flex items-center justify-between p-4 bg-white/5 rounded hover:bg-white/10 transition"
                    >
                      <span>Facebook {fbConnected ? "(Connected)" : "(Not Connected)"}</span>
                      <span>→</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => startOauth("linkedin")}
                      className="flex items-center justify-between p-4 bg-white/5 rounded hover:bg-white/10 transition"
                    >
                      <span>LinkedIn {liConnected ? "(Connected)" : "(Not Connected)"}</span>
                      <span>→</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => startOauth("googleads")}
                      className="flex items-center justify-between p-4 bg-white/5 rounded hover:bg-white/10 transition"
                    >
                      <span>Google Ads {gaConnected ? "(Connected)" : "(Not Connected)"}</span>
                      <span>→</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={refreshSocial}
                      className="px-3 py-2 rounded bg-purple-500 text-white hover:opacity-90"
                      disabled={socialLoading}
                    >
                      {socialLoading ? "Refreshing…" : "Refresh Status"}
                    </button>
                    {(fbConnected || liConnected || gaConnected) && (
                      <span className="text-green-300 text-sm">At least one account connected</span>
                    )}
                  </div>
                </div>
              ) :
                q.type === "video" ? (
                  <video src={q.videoUrl} controls className="w-full rounded shadow mb-2" />
                ) : (
                  <input
                    type="text"
                    id={q.name}
                    name={q.name}
                    value={answers[q.name] || ""}
                    onChange={handleChange}
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
                  disabled={disableNext}
                  className={`px-4 py-2 rounded-md bg-purple-500 text-white shadow hover:scale-105 transition-transform ${bricolage.className} ${disableNext ? "opacity-50 cursor-not-allowed" : ""}`}
                >
                  Next
                </button>
              ) : (
                <button
                  type="button" // avoid form submit noise
                  className={`px-4 py-2 rounded-md bg-green-500 text-white shadow hover:scale-105 transition-transform ${bricolage.className}`}
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
          </form>
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
    cookie.serialize("ob_session", token, {
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
