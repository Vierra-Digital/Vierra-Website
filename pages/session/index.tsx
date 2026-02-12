import { useRouter } from "next/router";
import { useEffect } from "react";
import Head from "next/head";

export default function SessionIndex() {
  const router = useRouter();
  
  useEffect(() => {
    const token = router.query.token;
    if (token) {
      router.replace(`/session/onboarding/${token}`);
    }
  }, [router]);

  return (
    <>
      <Head>
        <title>Vierra | Session</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
    <div className="min-h-screen bg-gradient-to-br from-[#4F1488] via-[#2E0A4F] to-[#18042A] flex items-center justify-center">
      <div className="text-white text-xl">Redirecting...</div>
    </div>
    </>
  );
}