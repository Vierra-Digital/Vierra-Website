import React, { useState, useEffect } from "react";
import Head from "next/head";
import Image from "next/image";
import { Inter } from "next/font/google";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useRouter } from "next/router";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const inter = Inter({ subsets: ["latin"] });

export default function AcceptInvitePage() {
  const router = useRouter();
  const [authState, setAuthState] = useState<"loading" | "ready" | "unauthenticated">("loading");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();

    async function bootstrap() {
      // The invite link delivers tokens in the URL hash (implicit flow).
      // @supabase/ssr does not auto-exchange these, so we do it explicitly.
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
          // Clean the tokens out of the URL without a navigation.
          window.history.replaceState(null, "", window.location.pathname);
          setAuthState("ready");
        } else {
          setAuthState("unauthenticated");
        }
        return;
      }

      // No hash tokens — check for an existing session (e.g. page was refreshed).
      const { data: { session } } = await supabase.auth.getSession();
      setAuthState(session ? "ready" : "unauthenticated");
    }

    bootstrap();

  }, []);

  useEffect(() => {
    if (authState === "unauthenticated") router.replace("/login");
  }, [authState, router]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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
      if (!res.ok) {
        setError(data.message || "Failed to set password.");
        return;
      }
      window.location.href = "/panel";
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authState === "loading") {
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
        <title>Vierra | Accept Invitation</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <div
        className={`min-h-screen flex items-center justify-center p-4 ${inter.className}`}
        style={{ background: "radial-gradient(120% 120% at 50% -10%, #2e0a4f 0%, #1b0833 45%, #0d0119 100%)" }}
      >
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-9 backdrop-blur-2xl">
          <h1 className="mb-1 flex justify-center">
            <Image
              src="/assets/vierra-logo-black-3.png"
              alt="Vierra"
              width={220}
              height={64}
              className="h-10 w-auto select-none brightness-0 invert"
              priority
            />
          </h1>
          <h2 className="mt-6 mb-2 text-center text-xl font-semibold text-white">You&apos;ve been invited</h2>
          <p className="mb-6 text-center text-sm text-white/60">
            Set a password to finish creating your account.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
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

            {error && (
              <div role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2.5 text-center text-sm text-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !password || !confirm}
              style={{ marginTop: "1.75rem" }}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-[#701cc0] to-[#8f42ff] py-3 font-semibold text-white disabled:opacity-60"
            >
              {isSubmitting ? (
                <><Loader2 size={18} className="animate-spin" /> Setting up account…</>
              ) : (
                "Get started"
              )}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
