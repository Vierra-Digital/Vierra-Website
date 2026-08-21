import React from "react";
import Head from "next/head";
import dynamic from "next/dynamic";
import type { GetServerSideProps } from "next";
import { requireSession } from "@/lib/auth";
import BrandLoadingScreen from "@/components/ui/BrandLoadingScreen";
import { getAccessibleGmailAccounts } from "@/lib/email/mailboxAccess";
import { resolveEnabledAccounts } from "@/lib/email/accountPreferences";

const EmailingPlatformSection = dynamic(
  () => import("@/components/PanelPages/EmailingPlatformSection"),
  {
    ssr: false,
    // The panel is a large client-only bundle. Render the exact same shared loading screen the
    // login page uses, so signing in and landing on the panel is one continuous motion.
    loading: () => <BrandLoadingScreen />,
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
  let initialSelectedAccounts = (accountsParam || "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  // No explicit ?accounts= — resolve the same "enabled accounts, primary first" selection the
  // client would otherwise wait on /api/gmail/status + account-preferences for, right here in the
  // same request that's already fetching the session. This is a same-process function call over
  // Prisma (no Gmail API round trip, no client network hop), so on a cold visit (nothing cached in
  // localStorage yet) the panel can start fetching messages immediately on mount instead of sitting
  // on the gate loading screen for a client-side round trip first.
  if (initialSelectedAccounts.length === 0) {
    try {
      const accessible = await getAccessibleGmailAccounts(session.user.id);
      initialSelectedAccounts = await resolveEnabledAccounts(
        session.user.id,
        accessible.map((a) => a.email)
      );
    } catch {
      // Fall back to the client's own connections fetch — same as before this optimization existed.
      initialSelectedAccounts = [];
    }
  }

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
