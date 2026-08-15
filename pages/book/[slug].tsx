import { useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { useBookingSlots, bookSlot } from "@/lib/booking/useBookingSlots";
import SlotCalendar from "@/components/booking/SlotCalendar";

export default function BookingPage() {
  const router = useRouter();
  const slug = typeof router.query.slug === "string" ? router.query.slug : "";
  // Optional campaign-contact attribution, carried through from the email that linked here
  // (see components/PanelPages/EmailingPlatformSection.tsx's "Insert booking link"). Absent for
  // plain shared booking-page links — booking still works identically either way.
  const ref = typeof router.query.ref === "string" ? router.query.ref : "";
  const booking = useBookingSlots(slug);
  const { data, loading, notFound, selected, setSelected } = booking;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState<string>("");

  const book = async () => {
    if (!selected || !name.trim() || !email.trim() || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const when = await bookSlot({ slug, start: selected, inviteeName: name.trim(), inviteeEmail: email.trim(), notes: notes.trim(), ref });
      setConfirmed(when);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not book.");
    } finally {
      setSubmitting(false);
    }
  };

  const picking = !loading && !notFound && !confirmed && !selected;
  const cardWidth = picking ? "max-w-4xl" : "max-w-lg";

  return (
    <>
      <Head>
        <title>{data?.title ? `Book — ${data.title}` : "Book a meeting"}</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>
      <div
        className="flex min-h-screen items-center justify-center p-4"
        style={{ background: "radial-gradient(120% 120% at 50% -10%, #2e0a4f 0%, #1b0833 45%, #0d0119 100%)" }}
      >
        <div className={`w-full ${cardWidth} rounded-2xl border border-white/10 bg-white p-8 shadow-2xl transition-[max-width]`}>
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="h-9 w-9 rounded-full border-4 border-[#E9D4FB] border-t-[#701CC0] motion-safe:animate-spin" />
            </div>
          ) : notFound ? (
            <div className="text-center">
              <h1 className="text-lg font-semibold text-[#1E1B2E]">Link not found</h1>
              <p className="mt-2 text-sm text-[#6B7280]">This booking link is inactive or doesn&apos;t exist.</p>
            </div>
          ) : confirmed ? (
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500 shadow-lg shadow-green-500/30">
                <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h1 className="text-lg font-semibold text-[#1E1B2E]">You&apos;re booked!</h1>
              <p className="mt-2 text-sm text-[#6B7280]">{data?.title} — {confirmed}. A confirmation is on its way to {email}.</p>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-semibold tracking-tight text-[#1E1B2E]">{data?.title}</h1>
              {data?.description ? <p className="mt-1 text-sm text-[#6B7280]">{data.description}</p> : null}
              <p className="mt-1 text-xs text-[#9A93AE]">{data?.durationMinutes} minutes · times shown in your local timezone</p>

              {selected ? (
                <div className="mt-5">
                  <button
                    type="button"
                    onClick={() => setSelected("")}
                    className="mb-3 text-xs font-semibold text-[#701CC0] hover:underline"
                  >
                    ← Choose a different time
                  </button>
                  <p className="text-sm font-medium text-[#1E1B2E]">
                    {new Date(selected).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })} at{" "}
                    {new Date(selected).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </p>
                  <div className="mt-3 space-y-2 border-t border-[#EEF0F4] pt-4">
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#701CC0]" />
                    <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Your email" className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#701CC0]" />
                    <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything to share? (optional)" rows={2} className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm outline-none focus:border-[#701CC0]" />
                    {error ? <p className="text-sm text-red-600">{error}</p> : null}
                    <button
                      type="button"
                      onClick={book}
                      disabled={submitting || !name.trim() || !email.trim()}
                      className="w-full rounded-lg bg-[#701CC0] py-2.5 text-sm font-semibold text-white hover:bg-[#5F17A5] disabled:opacity-50"
                    >
                      {submitting ? "Booking…" : "Confirm booking"}
                    </button>
                  </div>
                </div>
              ) : (
                <SlotCalendar state={booking} onSelectTime={setSelected} />
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
