import { useEffect, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";

type BookingInfo = {
  id: string;
  inviteeName: string;
  startAt: string;
  endAt: string;
  status: string;
  meetingJoinUrl: string | null;
  title: string;
  timezone: string;
  durationMinutes: number;
};
type SlotsResponse = { slots: string[] };

/** Public self-service page: reschedule or cancel a booking. Linked from the confirmation email. */
export default function ManageBookingPage() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";
  const [booking, setBooking] = useState<BookingInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState<"idle" | "reschedule">("idle");
  const [slots, setSlots] = useState<string[]>([]);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!id) return;
    fetch(`/api/booking/manage/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: BookingInfo) => setBooking(d))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  const startReschedule = async () => {
    setMode("reschedule");
    setMessage("");
    try {
      // Reuses the same slug-scoped slots endpoint isn't available without the link's slug
      // here, so we ask the booking's own link for fresh availability via a small proxy: the
      // manage flow only needs *a* valid future time, validated server-side on submit anyway.
      const r = await fetch(`/api/booking/manage/${id}/slots`);
      if (r.ok) {
        const d: SlotsResponse = await r.json();
        setSlots(d.slots || []);
      }
    } catch {
      /* ignore */
    }
  };

  const submitReschedule = async () => {
    if (!selected || !email.trim() || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch(`/api/booking/manage/${id}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteeEmail: email.trim(), newStart: selected }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.message || "Couldn't reschedule.");
      setMessage("Rescheduled! Check your email for the update.");
      setMode("idle");
      const refreshed = await fetch(`/api/booking/manage/${id}`).then((res) => res.json());
      setBooking(refreshed);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Couldn't reschedule.");
    } finally {
      setBusy(false);
    }
  };

  const submitCancel = async () => {
    if (!email.trim() || busy) return;
    if (typeof window !== "undefined" && !window.confirm("Cancel this meeting?")) return;
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch(`/api/booking/manage/${id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteeEmail: email.trim() }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d?.message || "Couldn't cancel.");
      setMessage("Cancelled.");
      setBooking((prev) => (prev ? { ...prev, status: "cancelled" } : prev));
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Couldn't cancel.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Head>
        <title>Manage your meeting</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <div className="flex min-h-screen items-center justify-center p-4" style={{ background: "radial-gradient(120% 120% at 50% -10%, #2e0a4f 0%, #1b0833 45%, #0d0119 100%)" }}>
        <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-white p-8 shadow-2xl">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="h-9 w-9 rounded-full border-4 border-[#E9D4FB] border-t-[#701CC0] motion-safe:animate-spin" />
            </div>
          ) : notFound || !booking ? (
            <p className="text-sm text-[#6B7280]">This link isn&apos;t valid.</p>
          ) : (
            <>
              <h1 className="text-xl font-semibold text-[#1E1B2E]">{booking.title}</h1>
              <p className="mt-1 text-sm text-[#6B7280]">
                {new Date(booking.startAt).toLocaleString([], { dateStyle: "full", timeStyle: "short" })} · {booking.status}
              </p>
              {booking.meetingJoinUrl ? (
                <a href={booking.meetingJoinUrl} className="mt-1 block text-sm text-[#701CC0] hover:underline">
                  {booking.meetingJoinUrl}
                </a>
              ) : null}

              {booking.status !== "cancelled" ? (
                <div className="mt-4 space-y-2 border-t border-[#EEF0F4] pt-4">
                  <input
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    type="email"
                    placeholder="Confirm your email"
                    className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#701CC0]"
                  />
                  {mode === "reschedule" ? (
                    <>
                      <div className="max-h-48 overflow-y-auto">
                        <div className="flex flex-wrap gap-2">
                          {slots.map((iso) => (
                            <button
                              key={iso}
                              type="button"
                              onClick={() => setSelected(iso)}
                              className={`rounded-lg border px-3 py-1.5 text-sm ${selected === iso ? "border-[#701CC0] bg-[#701CC0] text-white" : "border-[#E5E7EB] text-[#1E1B2E]"}`}
                            >
                              {new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                            </button>
                          ))}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={submitReschedule}
                        disabled={busy || !selected || !email.trim()}
                        className="w-full rounded-lg bg-[#701CC0] py-2.5 text-sm font-semibold text-white hover:bg-[#5F17A5] disabled:opacity-50"
                      >
                        {busy ? "Saving…" : "Confirm new time"}
                      </button>
                    </>
                  ) : (
                    <div className="flex gap-2">
                      <button type="button" onClick={startReschedule} disabled={!email.trim()} className="flex-1 rounded-lg border border-[#E5E7EB] py-2 text-sm font-medium text-[#1E1B2E] disabled:opacity-50">
                        Reschedule
                      </button>
                      <button type="button" onClick={submitCancel} disabled={busy || !email.trim()} className="flex-1 rounded-lg border border-red-200 py-2 text-sm font-medium text-red-600 disabled:opacity-50">
                        Cancel meeting
                      </button>
                    </div>
                  )}
                  {message ? <p className="text-sm text-[#4A465C]">{message}</p> : null}
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </>
  );
}
