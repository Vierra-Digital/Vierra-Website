import { useEffect } from "react";

// Pings the server to mark the current user online: once on mount, every 2
// minutes while the tab is open, and whenever the tab regains visibility.
export function useActivityHeartbeat() {
  useEffect(() => {
    const updateActivity = async () => {
      try {
        await fetch("/api/profile/updateActivity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "online" }),
        });
      } catch (error) {
        console.error("Failed to update activity:", error);
      }
    };

    updateActivity();
    const interval = setInterval(updateActivity, 2 * 60 * 1000);
    const handleVisibilityChange = () => {
      if (!document.hidden) updateActivity();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);
}
