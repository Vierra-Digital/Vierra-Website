import React from "react";
import Head from "next/head";
import dynamic from "next/dynamic";
import type { GetServerSideProps } from "next";
import { requireSession } from "@/lib/auth";

const EmailingPlatformSection = dynamic(
  () => import("@/components/PanelPages/EmailingPlatformSection"),
  { ssr: false }
);

type Props = {
  initialSelectedAccounts: string[];
};

const EmailPanelStandalonePage: React.FC<Props> = ({ initialSelectedAccounts }) => {
  return (
    <>
      <Head>
        <title>Vierra | Email Panel</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <div className="fixed inset-0 overflow-hidden">
        <main className="h-screen overflow-hidden">
          <EmailingPlatformSection initialSelectedAccounts={initialSelectedAccounts} />
        </main>
      </div>
    </>
  );
};

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await requireSession(ctx.req, ctx.res);
  if (!session) {
    return { redirect: { destination: "/login", permanent: false } };
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

  return {
    props: {
      initialSelectedAccounts,
    },
  };
};

export default EmailPanelStandalonePage;
