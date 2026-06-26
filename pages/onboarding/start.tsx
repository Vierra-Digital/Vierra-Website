import React, { useState, useRef } from "react";
import Head from "next/head";
import Image from "next/image";
import { Inter } from "next/font/google";
import { Loader2, Camera } from "lucide-react";
import { useRouter } from "next/router";
import type { GetServerSideProps } from "next";
import { requireSession } from "@/lib/auth";
import { signOut } from "@/lib/session-client";

const inter = Inter({ subsets: ["latin"] });

type Step = "company" | "name" | "photo";
const STEPS: Step[] = ["company", "name", "photo"];

function ErrorAlert({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2.5 text-center text-sm text-red-200">
      {children}
    </div>
  );
}

export default function OnboardingStartPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("company");
  const [companyName, setCompanyName] = useState("");
  const [fullName, setFullName] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageData, setImageData] = useState<{ base64: string; mimeType: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stepIndex = STEPS.indexOf(step);

  const goTo = (s: Step) => {
    setError("");
    setStep(s);
  };

  const handleCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !companyName.trim()) return;
    setIsSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/onboarding/create-company", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName: companyName.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to create company.");
      goTo("name");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create company.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || !fullName.trim()) return;
    setIsSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: fullName.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to save name.");
      goTo("photo");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save name.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      const [header, base64] = result.split(",");
      const mimeType = header.split(":")[1].split(";")[0];
      setImagePreview(result);
      setImageData({ base64, mimeType });
    };
    reader.readAsDataURL(file);
  };

  const handlePhotoFinish = async (skip = false) => {
    if (isSubmitting) return;
    if (skip || !imageData) {
      router.replace("/panel");
      return;
    }
    setIsSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/profile/uploadImage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageData: imageData.base64, mimeType: imageData.mimeType }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to upload photo.");
      router.replace("/panel");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload photo.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>Vierra | Get Started</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div
        className={`min-h-screen flex items-center justify-center p-4 ${inter.className}`}
        style={{ background: "radial-gradient(120% 120% at 50% -10%, #2e0a4f 0%, #1b0833 45%, #0d0119 100%)" }}
      >
        <div className="w-full max-w-md">
          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {STEPS.map((s, i) => (
              <div
                key={s}
                className="h-1.5 rounded-full transition-all duration-500"
                style={{
                  width: i === stepIndex ? "2rem" : "0.5rem",
                  background: i <= stepIndex ? "#8f42ff" : "rgba(255,255,255,0.15)",
                }}
              />
            ))}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-9 backdrop-blur-2xl">
            {/* Logo */}
            <div className="flex justify-center mb-1">
              <Image
                src="/assets/vierra-logo-black-3.png"
                alt="Vierra"
                width={220}
                height={64}
                className="h-10 w-auto select-none brightness-0 invert"
                priority
              />
            </div>

            {/* ── Step 1: Company ── */}
            {step === "company" && (
              <>
                <h2 className="mt-6 mb-2 text-center text-xl font-semibold text-white">Set up your company</h2>
                <p className="mb-6 text-center text-sm text-white/60">
                  You&apos;re not part of a company yet. Create one to get started — you&apos;ll be its first admin.
                </p>
                <form onSubmit={handleCompanySubmit} className="space-y-4">
                  <div>
                    <label htmlFor="companyName" className="mb-1.5 block text-sm font-medium text-white/80">
                      Company name
                    </label>
                    <input
                      id="companyName"
                      type="text"
                      value={companyName}
                      onChange={(e) => { setCompanyName(e.target.value); if (error) setError(""); }}
                      placeholder="Acme Inc."
                      required
                      disabled={isSubmitting}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder:text-white/30 outline-none focus:border-[#8f42ff] transition-colors"
                    />
                  </div>
                  {error && <ErrorAlert>{error}</ErrorAlert>}
                  <button
                    type="submit"
                    disabled={isSubmitting || !companyName.trim()}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-[#701cc0] to-[#8f42ff] py-3 font-semibold text-white disabled:opacity-60 transition-opacity"
                  >
                    {isSubmitting ? <><Loader2 size={18} className="animate-spin" /> Creating…</> : "Continue"}
                  </button>
                </form>
              </>
            )}

            {/* ── Step 2: Full Name ── */}
            {step === "name" && (
              <>
                <h2 className="mt-6 mb-2 text-center text-xl font-semibold text-white">What&apos;s your name?</h2>
                <p className="mb-6 text-center text-sm text-white/60">
                  This is how you&apos;ll appear to your team inside Vierra.
                </p>
                <form onSubmit={handleNameSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="fullName" className="mb-1.5 block text-sm font-medium text-white/80">
                      Full name
                    </label>
                    <input
                      id="fullName"
                      type="text"
                      value={fullName}
                      onChange={(e) => { setFullName(e.target.value); if (error) setError(""); }}
                      placeholder="Jane Smith"
                      required
                      autoFocus
                      disabled={isSubmitting}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white placeholder:text-white/30 outline-none focus:border-[#8f42ff] transition-colors"
                    />
                  </div>
                  {error && <ErrorAlert>{error}</ErrorAlert>}
                  <button
                    type="submit"
                    disabled={isSubmitting || !fullName.trim()}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-[#701cc0] to-[#8f42ff] py-3 font-semibold text-white disabled:opacity-60 transition-opacity"
                  >
                    {isSubmitting ? <><Loader2 size={18} className="animate-spin" /> Saving…</> : "Continue"}
                  </button>
                </form>
              </>
            )}

            {/* ── Step 3: Profile Photo ── */}
            {step === "photo" && (
              <>
                <h2 className="mt-6 mb-2 text-center text-xl font-semibold text-white">Add a profile photo</h2>
                <p className="mb-6 text-center text-sm text-white/60">
                  Optional — you can always change this later in your profile settings.
                </p>
                <div className="flex flex-col items-center gap-6">
                  {/* Avatar picker */}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="group relative h-28 w-28 rounded-full border-2 border-dashed border-white/20 bg-white/5 overflow-hidden hover:border-[#8f42ff]/70 transition-colors"
                  >
                    {imagePreview ? (
                      <>
                        <img src={imagePreview} alt="Preview" className="h-full w-full object-cover" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Camera size={22} className="text-white" />
                        </div>
                      </>
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-1.5 text-white/40 group-hover:text-white/60 transition-colors">
                        <Camera size={26} />
                        <span className="text-xs font-medium">Upload</span>
                      </div>
                    )}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />

                  {error && <ErrorAlert>{error}</ErrorAlert>}

                  <div className="w-full space-y-2">
                    <button
                      type="button"
                      disabled={isSubmitting || !imageData}
                      onClick={() => handlePhotoFinish(false)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-[#701cc0] to-[#8f42ff] py-3 font-semibold text-white disabled:opacity-50 transition-opacity"
                    >
                      {isSubmitting ? <><Loader2 size={18} className="animate-spin" /> Uploading…</> : "Save & go to panel"}
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handlePhotoFinish(true)}
                      className="w-full py-2 text-center text-sm text-white/40 hover:text-white/70 transition-colors disabled:pointer-events-none"
                    >
                      Skip for now
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="mt-6 w-full text-center text-sm text-white/30 hover:text-white/60 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await requireSession(ctx.req, ctx.res);
  if (!session) {
    return { redirect: { destination: "/login", permanent: false } };
  }
  if (session.kind === "member") {
    return { redirect: { destination: "/panel", permanent: false } };
  }
  if (session.kind === "client") {
    return { redirect: { destination: "/client", permanent: false } };
  }
  return { props: {} };
};
