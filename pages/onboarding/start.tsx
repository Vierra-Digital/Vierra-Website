import React, { useState, useRef, useEffect } from "react";
import Head from "next/head";
import Image from "next/image";
import { Inter } from "next/font/google";
import { Loader2, Camera, Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/router";
import type { GetServerSideProps } from "next";
import { requireSession } from "@/lib/auth";
import { signOut } from "@/lib/session-client";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import ImageCropModal from "@/components/ImageCropModal";

const inter = Inter({ subsets: ["latin"] });

type Step = "password" | "company" | "name" | "photo";

function ErrorAlert({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2.5 text-center text-sm text-red-200">
      {children}
    </div>
  );
}

export default function OnboardingStartPage({ initialStep }: { initialStep: Step }) {
  const router = useRouter();
  const [bootstrapState, setBootstrapState] = useState<"loading" | "ready" | "unauthenticated">(
    initialStep === "password" ? "loading" : "ready"
  );
  const STEPS: Step[] =
    initialStep === "password" ? ["password", "name", "photo"]
    : initialStep === "company" ? ["company", "name", "photo"]
    : ["name", "photo"];
  const [step, setStep] = useState<Step>(initialStep);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [fullName, setFullName] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageData, setImageData] = useState<{ base64: string; mimeType: string } | null>(null);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const stepIndex = STEPS.indexOf(step);

  // Invite links deliver Supabase tokens in the URL hash (implicit flow), which
  // never reaches getServerSideProps. Exchange them client-side before the
  // rest of the wizard can rely on an authenticated session.
  useEffect(() => {
    if (initialStep !== "password") return;
    const supabase = getSupabaseBrowserClient();

    async function bootstrap() {
      const hash = window.location.hash.slice(1);
      const params = new URLSearchParams(hash);
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (accessToken && refreshToken) {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (data.session && !error) {
          window.history.replaceState(null, "", window.location.pathname);
          setBootstrapState("ready");
        } else {
          setBootstrapState("unauthenticated");
        }
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      setBootstrapState(session ? "ready" : "unauthenticated");
    }

    bootstrap();
  }, [initialStep]);

  useEffect(() => {
    if (bootstrapState === "unauthenticated") router.replace("/login");
  }, [bootstrapState, router]);

  const goTo = (s: Step) => {
    setError("");
    setStep(s);
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setIsSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/auth/setPassword", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed to set password.");
      goTo("name");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set password.");
    } finally {
      setIsSubmitting(false);
    }
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
      setCropImageSrc(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleCropComplete = (blob: Blob) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      const base64 = result.split(",")[1];
      setImagePreview(result);
      setImageData({ base64, mimeType: blob.type || "image/jpeg" });
      setCropImageSrc(null);
    };
    reader.readAsDataURL(blob);
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

  if (bootstrapState === "loading") {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${inter.className}`}
        style={{ background: "radial-gradient(120% 120% at 50% -10%, #2e0a4f 0%, #1b0833 45%, #0d0119 100%)" }}
      >
        <Loader2 size={32} className="animate-spin text-white/50" />
      </div>
    );
  }

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

            {/* ── Step: Set password (invite links only) ── */}
            {step === "password" && (
              <>
                <h2 className="mt-6 mb-2 text-center text-xl font-semibold text-white">You&apos;ve been invited</h2>
                <p className="mb-6 text-center text-sm text-white/60">
                  Set a password to finish creating your account.
                </p>
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-white/80">
                      Password
                    </label>
                    <div className="relative flex items-center">
                      <input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); if (error) setError(""); }}
                        placeholder="Choose a password"
                        required
                        minLength={6}
                        disabled={isSubmitting}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 pr-11 text-white outline-none focus:border-[#8f42ff]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 text-white/40 hover:text-white/70"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="confirm" className="mb-1.5 block text-sm font-medium text-white/80">
                      Confirm password
                    </label>
                    <div className="relative flex items-center">
                      <input
                        id="confirm"
                        type={showConfirm ? "text" : "password"}
                        value={confirm}
                        onChange={(e) => { setConfirm(e.target.value); if (error) setError(""); }}
                        placeholder="Repeat your password"
                        required
                        disabled={isSubmitting}
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 pr-11 text-white outline-none focus:border-[#8f42ff]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm((v) => !v)}
                        className="absolute right-3 text-white/40 hover:text-white/70"
                        aria-label={showConfirm ? "Hide password" : "Show password"}
                        tabIndex={-1}
                      >
                        {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  {error && <ErrorAlert>{error}</ErrorAlert>}

                  <button
                    type="submit"
                    disabled={isSubmitting || !password || !confirm}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-[#701cc0] to-[#8f42ff] py-3 font-semibold text-white disabled:opacity-60 transition-opacity"
                  >
                    {isSubmitting ? <><Loader2 size={18} className="animate-spin" /> Setting up account…</> : "Get started"}
                  </button>
                </form>
              </>
            )}

            {/* ── Step: Company ── */}
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

            {/* ── Step: Full Name ── */}
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

            {/* ── Step: Profile Photo ── */}
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

      {cropImageSrc && (
        <ImageCropModal
          imageSrc={cropImageSrc}
          onComplete={handleCropComplete}
          onCancel={() => setCropImageSrc(null)}
        />
      )}
    </>
  );
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await requireSession(ctx.req, ctx.res);
  if (!session) {
    // No cookie session yet — this is likely a fresh invite link whose
    // Supabase tokens live in the URL hash, which never reaches the server.
    // Let the client exchange them and continue the wizard from "password".
    return { props: { initialStep: "password" } };
  }
  if (session.kind === "member") {
    // Already finished onboarding (has a name) — nothing left to do here.
    if (session.user.name) {
      return { redirect: { destination: "/panel", permanent: false } };
    }
    // Already belongs to a company (self-service signup or invite already
    // accepted) — skip straight to name + photo.
    return { props: { initialStep: "name" } };
  }
  if (session.kind === "client") {
    return { redirect: { destination: "/client", permanent: false } };
  }
  return { props: { initialStep: "company" } };
};
