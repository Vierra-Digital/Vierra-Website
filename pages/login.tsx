import React, { useState, useEffect } from "react";
import Image from "next/image";
import Head from "next/head";
import { Inter } from "next/font/google";
import { Eye, EyeOff, Mail, Lock, Loader2 } from "lucide-react";
import { useRouter } from "next/router";
import { signIn, useSession, getSession } from "next-auth/react";

const inter = Inter({ subsets: ["latin"] });

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
 * Lightweight, GPU-accelerated animated backdrop: a handful of blurred gradient
 * "aurora" orbs that drift on the compositor (transform/opacity only) plus a
 * faint grid. Replaces the old particles.js canvas, which was the source of the
 * lag. Honors prefers-reduced-motion.
 */
// Static (deterministic) particle layout — fixed values avoid SSR/client
// hydration mismatches and keep each dot animating transform/opacity only.
const PARTICLES = [
  { left: "8%", size: 3, delay: 0, dur: 17, drift: 18 },
  { left: "18%", size: 2, delay: 6, dur: 22, drift: -14 },
  { left: "27%", size: 4, delay: 2, dur: 19, drift: 22 },
  { left: "38%", size: 2, delay: 9, dur: 24, drift: -10 },
  { left: "46%", size: 3, delay: 4, dur: 20, drift: 16 },
  { left: "55%", size: 2, delay: 11, dur: 26, drift: -20 },
  { left: "63%", size: 4, delay: 1, dur: 18, drift: 12 },
  { left: "71%", size: 3, delay: 7, dur: 23, drift: -16 },
  { left: "80%", size: 2, delay: 3, dur: 21, drift: 20 },
  { left: "88%", size: 3, delay: 10, dur: 25, drift: -12 },
  { left: "33%", size: 2, delay: 13, dur: 28, drift: 14 },
  { left: "92%", size: 2, delay: 5, dur: 19, drift: -18 },
] as const;

const AnimatedBackground = () => (
  <div className="login-bg" aria-hidden="true">
    <div className="login-center-glow" />
    <div className="aurora aurora--1" />
    <div className="aurora aurora--2" />
    <div className="aurora aurora--3" />
    <div className="aurora aurora--4" />
    <div className="login-grid" />
    <div className="login-particles">
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className="login-particle"
          style={
            {
              left: p.left,
              width: `${p.size}px`,
              height: `${p.size}px`,
              "--delay": `${p.delay}s`,
              "--dur": `${p.dur}s`,
              "--drift": `${p.drift}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
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

  useEffect(() => {
    if (status === "loading") return;
    if (!session) return;

    const role = (session.user as any)?.role;
    const target = role === "user" ? "/client" : "/panel";
    router.replace(target);
  }, [session, status, router]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;
    setError("");
    setIsSubmitting(true);

    try {
      const response = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      });

      if (response?.ok) {
        const session = await getSession();
        const role = (session?.user as any)?.role;
        if (role === "staff" || role === "admin") {
          router.replace("/panel");
        } else {
          router.replace("/client");
        }
      } else {
        setError(resolveCredentialErrorMessage(response?.error));
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
      background:
        radial-gradient(120% 120% at 50% -10%, #2e0a4f 0%, #1b0833 45%, #0d0119 100%);
    }

    .login-bg {
      position: absolute;
      inset: 0;
      z-index: 0;
      overflow: hidden;
    }

    .aurora {
      position: absolute;
      border-radius: 9999px;
      filter: blur(90px);
      opacity: 0.55;
      will-change: transform;
      mix-blend-mode: screen;
    }
    .aurora--1 {
      top: -12%;
      left: -8%;
      width: 46vw;
      height: 46vw;
      background: radial-gradient(circle at 30% 30%, #8f42ff, transparent 70%);
      animation: aurora-drift-1 22s ease-in-out infinite;
    }
    .aurora--2 {
      bottom: -18%;
      right: -10%;
      width: 50vw;
      height: 50vw;
      background: radial-gradient(circle at 60% 40%, #701cc0, transparent 70%);
      animation: aurora-drift-2 26s ease-in-out infinite;
    }
    .aurora--3 {
      top: 30%;
      left: 45%;
      width: 34vw;
      height: 34vw;
      background: radial-gradient(circle at 50% 50%, #b06bff, transparent 70%);
      animation: aurora-drift-3 30s ease-in-out infinite;
    }
    .aurora--4 {
      top: 8%;
      right: 6%;
      width: 30vw;
      height: 30vw;
      background: radial-gradient(circle at 40% 60%, #5a1bb0, transparent 70%);
      animation: aurora-drift-4 24s ease-in-out infinite;
    }

    /* Drift + a gentle opacity "breathe"; only transform/opacity animate. */
    @keyframes aurora-drift-1 {
      0%, 100% { transform: translate3d(0, 0, 0) scale(1); opacity: 0.5; }
      50% { transform: translate3d(12vw, 8vh, 0) scale(1.15); opacity: 0.65; }
    }
    @keyframes aurora-drift-2 {
      0%, 100% { transform: translate3d(0, 0, 0) scale(1.05); opacity: 0.6; }
      50% { transform: translate3d(-10vw, -6vh, 0) scale(0.9); opacity: 0.4; }
    }
    @keyframes aurora-drift-3 {
      0%, 100% { transform: translate3d(-50%, 0, 0) scale(1); opacity: 0.35; }
      50% { transform: translate3d(-58%, 10vh, 0) scale(1.2); opacity: 0.5; }
    }
    @keyframes aurora-drift-4 {
      0%, 100% { transform: translate3d(0, 0, 0) scale(0.95); opacity: 0.45; }
      50% { transform: translate3d(-8vw, 7vh, 0) scale(1.1); opacity: 0.6; }
    }

    /* Soft ambient glow behind the card — gently pulses (scale/opacity), no rotation. */
    .login-center-glow {
      position: absolute;
      top: 50%;
      left: 50%;
      width: 70vmax;
      height: 70vmax;
      transform: translate3d(-50%, -50%, 0);
      background: radial-gradient(circle, rgba(143, 66, 255, 0.16) 0%, rgba(112, 28, 192, 0.06) 35%, transparent 65%);
      will-change: transform, opacity;
      animation: login-center-pulse 9s ease-in-out infinite;
    }
    @keyframes login-center-pulse {
      0%, 100% { transform: translate3d(-50%, -50%, 0) scale(0.92); opacity: 0.65; }
      50% { transform: translate3d(-50%, -50%, 0) scale(1.08); opacity: 1; }
    }

    .login-grid {
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
      background-size: 54px 54px;
      mask-image: radial-gradient(120% 80% at 50% 40%, #000 30%, transparent 80%);
      -webkit-mask-image: radial-gradient(120% 80% at 50% 40%, #000 30%, transparent 80%);
    }

    .login-particles {
      position: absolute;
      inset: 0;
      overflow: hidden;
    }
    .login-particle {
      position: absolute;
      bottom: -8px;
      border-radius: 9999px;
      background: rgba(214, 188, 255, 0.7);
      box-shadow: 0 0 6px rgba(176, 107, 255, 0.7);
      opacity: 0;
      will-change: transform, opacity;
      animation: login-particle-rise var(--dur, 20s) linear infinite;
      animation-delay: var(--delay, 0s);
    }
    @keyframes login-particle-rise {
      0% { transform: translate3d(0, 0, 0); opacity: 0; }
      10% { opacity: 0.8; }
      90% { opacity: 0.8; }
      100% { transform: translate3d(var(--drift, 0px), -100vh, 0); opacity: 0; }
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
      .aurora,
      .login-center-glow,
      .login-particle,
      .login-submit::before,
      .login-card-wrap {
        animation: none !important;
      }
      .login-particle {
        opacity: 0;
      }
    }
  `}</style>
);

export default LoginPage;
