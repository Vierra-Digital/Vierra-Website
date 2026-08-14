import React from "react";
import Head from "next/head";
import Image from "next/image";
import dynamic from "next/dynamic";
import type { GetServerSideProps } from "next";
import { requireSession } from "@/lib/auth";
import { BRAND_LOGO } from "@/components/email/emailTheme";

const EmailingPlatformSection = dynamic(
  () => import("@/components/PanelPages/EmailingPlatformSection"),
  {
    ssr: false,
    // The panel is a large client-only bundle; show an instant branded loader over the dark
    // canvas instead of a blank screen while it downloads + hydrates. The wordmark is the
    // WHITE variant so it reads against the dark (#18042a) canvas.
    loading: () => (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-6 bg-[#18042a]">
        <Image
          src={BRAND_LOGO.wordmarkLight}
          alt="Vierra"
          width={260}
          height={66}
          className="h-14 w-auto motion-safe:animate-pulse"
          priority
        />
        <div className="h-10 w-10 rounded-full border-4 border-white/20 border-t-white/80 motion-safe:animate-spin" />
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
