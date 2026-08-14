import React from "react";
import Head from "next/head";
import Image from "next/image";
import dynamic from "next/dynamic";
import type { GetServerSideProps } from "next";
import { requireSession } from "@/lib/auth";

const EmailingPlatformSection = dynamic(
  () => import("@/components/PanelPages/EmailingPlatformSection"),
  {
    ssr: false,
    // The panel is a large client-only bundle; show an instant branded loader over the dark
    // canvas instead of a blank screen while it downloads + hydrates. Deliberately identical to
    // the login screen's loading state (white wordmark + bouncing dots) so signing in and
    // landing on the panel reads as one continuous transition rather than two different apps.
    loading: () => (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-6 bg-[#18042a]">
        <Image
          src="/assets/vierra-logo-black-3.png"
          alt="Vierra"
          width={220}
          height={64}
          className="pointer-events-none h-10 w-auto select-none opacity-95 brightness-0 invert"
          draggable={false}
          priority
        />
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2 w-2 rounded-full bg-white/70 motion-safe:animate-bounce"
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
        </div>
      </div>
    ),
  }
);

type Props = {
  initialSelectedAccounts: string[];
  initialOpenThreadId: string;
};

const EmailPanelStandalonePage: React.FC<Props> = ({ initialSelectedAccounts, initialOpenThreadId }) => {
  return (
    <>
      <Head>
        <title>Vierra | Email Panel</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <div className="fixed inset-0 overflow-hidden">
        <main className="h-screen overflow-hidden">
          <EmailingPlatformSection
            initialSelectedAccounts={initialSelectedAccounts}
            initialOpenThreadId={initialOpenThreadId}
          />
        </main>
      </div>
    </>
  );
};

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await requireSession(ctx.req, ctx.res);
  if (!session) {
    // Preserve the deep link (accounts + thread) so login can bounce back here.
    return {
      redirect: { destination: `/login?returnTo=${encodeURIComponent(ctx.resolvedUrl)}`, permanent: false },
    };
  }

  const role = (session.user as any).role;
  if (role !== "admin" && role !== "staff") {
    return { redirect: { destination: "/client", permanent: false } };
  }

  const accountsParam = Array.isArray(ctx.query.accounts) ? ctx.query.accounts[0] : ctx.query.accounts;
  const initialSelectedAccounts = (accountsParam || "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  const threadParam = Array.isArray(ctx.query.thread) ? ctx.query.thread[0] : ctx.query.thread;
  const initialOpenThreadId = (threadParam || "").trim();

  return {
    props: {
      initialSelectedAccounts,
      initialOpenThreadId,
    },
  };
};

export default EmailPanelStandalonePage;
