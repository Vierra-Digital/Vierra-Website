import React from "react";
import Head from "next/head";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import type { GetServerSideProps } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { FiSettings } from "react-icons/fi";

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
      <div className="fixed inset-0 bg-[#F7F8FC] overflow-hidden">
        <header className="h-16 border-b border-[#E5E7EB] bg-white px-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/panel" className="inline-flex items-center gap-2">
              <Image
                src="/assets/vierra-logo-black-3.png"
                alt="Vierra"
                width={110}
                height={32}
                className="w-[110px] h-auto"
                priority
              />
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/panel/email/settings"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#701CC0]"
              aria-label="Email settings"
              title="Email settings"
            >
              <FiSettings className="h-4 w-4" />
            </Link>
          </div>
        </header>
        <main className="h-[calc(100vh-64px)] overflow-hidden">
          <EmailingPlatformSection standalone initialSelectedAccounts={initialSelectedAccounts} />
        </main>
      </div>
    </>
  );
};

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions);
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
