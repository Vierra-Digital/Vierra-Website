import React, { useState } from "react";
import Head from "next/head";
import Image from "next/image";
import { Inter } from "next/font/google";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/router";
import type { GetServerSideProps } from "next";
import { requireSession } from "@/lib/auth";
import { signOut } from "@/lib/session-client";

const inter = Inter({ subsets: ["latin"] });

export default function OnboardingStartPage() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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
      if (!res.ok) {
        throw new Error(data.message || "Failed to create company.");
      }
      router.replace("/panel");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create company.");
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
          <h2 className="mt-6 mb-2 text-center text-xl font-semibold text-white">Set up your company</h2>
          <p className="mb-6 text-center text-sm text-white/60">
            You&apos;re not part of a company yet. Create one to get started — you&apos;ll be its first admin.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="companyName" className="mb-1.5 block text-sm font-medium text-white/80">
                Company name
              </label>
              <input
                id="companyName"
                type="text"
                value={companyName}
                onChange={(e) => {
                  setCompanyName(e.target.value);
                  if (error) setError("");
                }}
                placeholder="Acme Inc."
                required
                disabled={isSubmitting}
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-white outline-none focus:border-[#8f42ff]"
              />
            </div>

            {error && (
              <div role="alert" className="rounded-xl border border-red-400/30 bg-red-500/10 px-3 py-2.5 text-center text-sm text-red-200">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !companyName.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-[#701cc0] to-[#8f42ff] py-3 font-semibold text-white disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={18} className="animate-spin" /> Creating…
                </>
              ) : (
                "Create company"
              )}
            </button>
          </form>

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="mt-6 w-full text-center text-sm text-white/40 hover:text-white/70"
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
