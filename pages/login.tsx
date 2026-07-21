import React, { useState, useEffect } from "react";
import Image from "next/image";
import Head from "next/head";
import { inter } from "@/lib/fonts";
import { motion } from "framer-motion";
import { Eye, EyeOff, Mail, Lock, Loader2 } from "lucide-react";
import { useRouter } from "next/router";
import { useSession } from "@/lib/session-client";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";


function resolveCredentialErrorMessage(rawError?: string | null) {
  const normalized = (rawError || "").toLowerCase();
  if (!normalized) return "We couldn't sign you in. Check your email and password, then try again.";
  if (normalized.includes("credentialssignin")) {
    return "We couldn't sign you in. Check your email and password, then try again.";
  }
  if (normalized.includes("invalid")) {
    return "We couldn't sign you in. Check your email and password, then try again.";
  }
  if (normalized.includes("password")) {
    return "We couldn't sign you in. Check your email and password, then try again.";
  }
  if (normalized.includes("email")) {
    return "We couldn't sign you in. Check your email and password, then try again.";
  }
  return "Sign-in is temporarily unavailable. Please try again in a moment.";
}

/**
 * Animated backdrop that mirrors the homepage hero: a dark #18042A field with
 * drifting vertical grid lines, a twinkling starfield, and two slowly floating
 * blurred purple gradient blobs. Pure transform/opacity on the compositor.
 * Honors prefers-reduced-motion. Self-contained so it doesn't depend on the
 * App Router's global stylesheet.
 */
// Evenly spaced vertical grid lines, like the hero.
const GRID_LINES = Array.from({ length: 7 }, (_, i) => i);

const AnimatedBackground = () => (
  <div className="login-bg" aria-hidden="true">
    {GRID_LINES.map((i) => (
      <motion.div
        key={i}
        className="login-gridline"
        style={{ left: `${((i + 1) * 100) / 8}%` }}
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "100%", opacity: 0.07, x: [0, 10, 0] }}
        transition={{
          duration: 1.1,
          delay: i * 0.06,
          ease: "easeInOut",
          x: { duration: 4, repeat: Infinity, ease: "easeInOut" },
        }}
      />
    ))}
    <div className="login-stars" />
    <div className="login-stars login-stars--2" />
    <div className="login-vignette" />
  </div>
);

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const { data: session, status } = useSession();

  // Email validity — same rule the public modals use, surfaced inline as the
  // user types. Note: this does NOT gate the submit button.
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const showEmailError = email.length > 0 && !emailValid;

  // Post-login destination override (e.g. a deep link from a Discord alert). Only internal
  // paths are honored — reject protocol-relative (`//host`) or backslash tricks to avoid an
  // open redirect. The target page still enforces its own role guard.
  const returnToRaw = typeof router.query.returnTo === "string" ? router.query.returnTo : "";
  const safeReturnTo = returnToRaw.startsWith("/") && !/^\/[/\\]/.test(returnToRaw) ? returnToRaw : "";

  useEffect(() => {
    if (status === "loading") return;
    if (!session) return;

    const kind = (session.user as any)?.kind;
    const target = kind === "client" ? "/client" : kind === "unaffiliated" ? "/onboarding/start" : "/panel";
    router.replace(safeReturnTo || target);
  }, [session, status, router, safeReturnTo]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError("");
    setIsSubmitting(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (!signInError) {
        const meResponse = await fetch("/api/auth/me");
        const me = meResponse.ok ? await meResponse.json() : null;
        if (me?.kind === "client") {
          router.replace(safeReturnTo || "/client");
        } else if (me?.kind === "unaffiliated") {
          router.replace(safeReturnTo || "/onboarding/start");
        } else {
          router.replace(safeReturnTo || "/panel");
        }
      } else {
        setError(resolveCredentialErrorMessage(signInError.message));
      }
    } catch {
      setError("Sign-in is temporarily unavailable. Please try again in a moment.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (status === "loading" || status === "authenticated") {
    return (
      <div className="login-shell flex flex-col items-center justify-center gap-6">
        <AnimatedBackground />
        <Image
          src="/assets/vierra-logo-black-3.png"
          alt="Vierra"
          width={220}
          height={64}
          className="pointer-events-none relative z-10 h-10 w-auto select-none opacity-95 brightness-0 invert"
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          priority
        />
        <div className="relative z-10 flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2 w-2 rounded-full bg-white/70 animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
        <StyleBlock />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Vierra | Login</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <div className="login-shell flex items-center justify-center p-4">
        <AnimatedBackground />

        <div className="login-card-wrap relative z-10 w-full max-w-md">
          <div className="login-card">
            <h1 className="flex justify-center mb-9 mt-1">
              <Image
                src="/assets/vierra-logo-black-3.png"
                alt="Vierra"
                width={340}
                height={99}
                className="pointer-events-none h-16 w-auto select-none brightness-0 invert"
                draggable={false}
                onDragStart={(e) => e.preventDefault()}
                priority
              />
            </h1>

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className={`mb-1.5 block text-sm font-medium text-white/80 ${inter.className}`}
                >
                  Email
                </label>
                <div className="login-field">
                  <Mail className="login-field__icon" size={18} aria-hidden="true" />
                  <input
                    type="email"
                    id="email"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError("");
                    }}
                    className={`login-input ${showEmailError ? "login-input--invalid" : ""} ${inter.className}`}
                    placeholder="you@vierradev.com"
                    required
                    aria-invalid={showEmailError}
                    aria-describedby={showEmailError ? "email-error" : undefined}
                    disabled={isSubmitting}
                  />
                </div>
                {showEmailError && (
                  <p id="email-error" className="mt-1.5 text-xs text-red-300">
                    Enter a valid email address.
                  </p>
                )}
              </div>

              <div>
                <label
                  htmlFor="password"
                  className={`mb-1.5 block text-sm font-medium text-white/80 ${inter.className}`}
                >
                  Password
                </label>
                <div className="login-field">
                  <Lock className="login-field__icon" size={18} aria-hidden="true" />
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (error) setError("");
                    }}
                    className={`login-input login-input--password ${inter.className}`}
                    placeholder="Enter your password"
                    required
                    disabled={isSubmitting}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="login-field__toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={isSubmitting}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  aria-live="polite"
                  className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2.5 text-center text-sm text-red-200"
                >
                  {error}
                </div>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                style={{ marginTop: "1.75rem" }}
                className={`login-submit ${inter.className}`}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Signing in…
                  </>
                ) : (
                  "Sign in"
                )}
              </button>
            </form>
          </div>
        </div>
      </div>

      <StyleBlock />
    </>
  );
};

/** Scoped (styled-jsx) styles for the backdrop + glass card. */
const StyleBlock = () => (
  <style jsx global>{`
    .login-shell {
      position: relative;
      min-height: 100vh;
      min-height: 100dvh;
      overflow: hidden;
      background: #18042a;
    }

    .login-bg {
      position: absolute;
      inset: 0;
      z-index: 0;
      overflow: hidden;
    }

    /* Vertical grid lines — height / opacity / x drift driven by framer-motion. */
    .login-gridline {
      position: absolute;
      top: 0;
      width: 0;
      border-left: 1px solid #ffffff;
      will-change: height, transform, opacity;
    }

    /* Twinkling starfield — identical to the homepage hero's .cta-stars: two
       layers drifting diagonally by animating background-position, fast (5s/9s). */
    .login-stars {
      position: absolute;
      inset: -10% -10% -10% -10%;
      background-image:
        radial-gradient(1.5px 1.5px at 25px 35px, rgba(255, 255, 255, 0.9), transparent),
        radial-gradient(1.5px 1.5px at 120px 80px, rgba(255, 255, 255, 0.7), transparent),
        radial-gradient(1px 1px at 70px 160px, rgba(255, 255, 255, 0.8), transparent),
        radial-gradient(1px 1px at 180px 50px, rgba(255, 255, 255, 0.6), transparent),
        radial-gradient(1.5px 1.5px at 200px 140px, rgba(255, 255, 255, 0.85), transparent),
        radial-gradient(1px 1px at 40px 110px, rgba(255, 255, 255, 0.5), transparent);
      background-repeat: repeat;
      background-size: 220px 220px;
      opacity: 0.8;
      animation: login-stars-drift 5s linear infinite;
    }
    .login-stars--2 {
      background-size: 440px 440px;
      opacity: 0.5;
      animation: login-stars-drift-2 9s linear infinite;
    }
    @keyframes login-stars-drift {
      to { background-position: 220px 220px; }
    }
    @keyframes login-stars-drift-2 {
      to { background-position: 440px 440px; }
    }

    .login-vignette {
      position: absolute;
      inset: 0;
      background: radial-gradient(120% 120% at 50% 50%, transparent 55%, rgba(8, 1, 18, 0.65) 100%);
    }

    .login-card-wrap {
      animation: login-rise 0.6s cubic-bezier(0.16, 1, 0.3, 1) both;
    }
    @keyframes login-rise {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }

    /* Glow ring behind the glass card */
    .login-card-wrap::before {
      content: "";
      position: absolute;
      inset: -1px;
      border-radius: 24px;
      padding: 1px;
      background: linear-gradient(140deg, rgba(255, 255, 255, 0.35), rgba(143, 66, 255, 0.25) 40%, transparent 70%);
      -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      pointer-events: none;
    }

    .login-card {
      position: relative;
      border-radius: 24px;
      padding: 2.25rem;
      background: rgba(255, 255, 255, 0.06);
      backdrop-filter: blur(28px) saturate(140%);
      -webkit-backdrop-filter: blur(28px) saturate(140%);
      border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow:
        0 30px 80px -28px rgba(112, 28, 192, 0.7),
        inset 0 1px 0 rgba(255, 255, 255, 0.12);
    }

    .login-field {
      position: relative;
      display: flex;
      align-items: center;
    }
    .login-field__icon {
      position: absolute;
      left: 14px;
      color: rgba(255, 255, 255, 0.4);
      pointer-events: none;
    }
    .login-input {
      width: 100%;
      height: 46px;
      padding: 0 14px 0 42px;
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: #fff;
      font-size: 0.95rem;
      outline: none;
      transition: border-color 0.18s ease, box-shadow 0.18s ease, background-color 0.18s ease;
    }
    .login-input--password {
      padding-right: 44px;
    }
    .login-input::placeholder {
      color: rgba(255, 255, 255, 0.35);
    }
    .login-input:focus {
      border-color: rgba(143, 66, 255, 0.8);
      background: rgba(255, 255, 255, 0.08);
      box-shadow: 0 0 0 3px rgba(143, 66, 255, 0.25);
    }
    /* Invalid email — red border kept even on focus, matching the modal UX. */
    .login-input--invalid,
    .login-input--invalid:focus {
      border-color: rgba(248, 113, 113, 0.8);
      box-shadow: 0 0 0 3px rgba(248, 113, 113, 0.22);
    }
    .login-input:disabled {
      opacity: 0.6;
    }
    /* Kill the browser autofill yellow + keep text readable on glass */
    .login-input:-webkit-autofill,
    .login-input:-webkit-autofill:hover,
    .login-input:-webkit-autofill:focus {
      -webkit-text-fill-color: #fff;
      caret-color: #fff;
      transition: background-color 9999s ease-in-out 0s;
    }

    .login-field__toggle {
      position: absolute;
      right: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: rgba(255, 255, 255, 0.45);
      transition: color 0.18s ease;
    }
    .login-field__toggle:hover {
      color: #fff;
    }

    /* Traveling highlight ring on the submit button — same look as the nav
       "Free Audit Call" button (same gradient), just spinning faster. */
    @property --login-glow-angle {
      syntax: "<angle>";
      initial-value: 0deg;
      inherits: false;
    }
    @keyframes login-glow-spin {
      to { --login-glow-angle: 360deg; }
    }

    .login-submit {
      position: relative;
      isolation: isolate;
      width: 100%;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      border-radius: 12px;
      font-weight: 600;
      color: #fff;
      background: linear-gradient(135deg, #701cc0 0%, #8f42ff 100%);
      box-shadow: 0 10px 28px -8px rgba(143, 66, 255, 0.65);
      transition: transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease;
    }
    /* Sharp dark-purple gradient ring masked to the border, spinning around. */
    .login-submit::before {
      content: "";
      position: absolute;
      inset: -2px;
      /* 2px larger box than the button, so radius must be button radius + 2px
         (14px) to stay concentric — otherwise the ring corners look tighter. */
      border-radius: 14px;
      padding: 1.6px;
      background: conic-gradient(
        from var(--login-glow-angle),
        #701cc0,
        #8f42ff,
        #d4a5ff,
        #8f42ff,
        #701cc0
      );
      -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
      -webkit-mask-composite: xor;
      mask-composite: exclude;
      animation: login-glow-spin 4s linear infinite;
      z-index: -1;
      pointer-events: none;
    }
    .login-submit:hover:not(:disabled) {
      filter: brightness(1.08);
      transform: translateY(-1px);
      box-shadow: 0 14px 34px -8px rgba(143, 66, 255, 0.8);
    }
    /* Spin faster + brighter on hover, like the audit button. */
    .login-submit:hover:not(:disabled)::before {
      animation-duration: 1.5s;
      filter: brightness(1.5) saturate(1.2);
    }
    .login-submit:active:not(:disabled) {
      transform: translateY(0);
    }
    .login-submit:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }
    .login-submit:disabled::before {
      opacity: 0.4;
    }

    @media (prefers-reduced-motion: reduce) {
      .login-stars,
      .login-stars--2,
      .login-submit::before,
      .login-card-wrap {
        animation: none !important;
      }
    }
  `}</style>
);

export default LoginPage;
