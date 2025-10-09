import { useRouter } from "next/router";
import { useEffect } from "react";

export default function SessionIndex() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to onboarding by default
    const token = router.query.token;
    if (token) {
      router.replace(`/session/onboarding/${token}`);
    }
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#4F1488] via-[#2E0A4F] to-[#18042A] flex items-center justify-center">
      <div className="text-white text-xl">Redirecting...</div>
    </div>
  );
}