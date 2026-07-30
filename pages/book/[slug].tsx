import { useEffect, useMemo, useState } from "react";
import Head from "next/head";
import { useRouter } from "next/router";

type SlotsResponse = { title: string; description: string | null; durationMinutes: number; slots: string[] };

export default function BookingPage() {
  const router = useRouter();
  const slug = typeof router.query.slug === "string" ? router.query.slug : "";
  const [data, setData] = useState<SlotsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selected, setSelected] = useState<string>("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState<string>("");

  useEffect(() => {
    if (!slug) return;
    setLoading(true);
    fetch(`/api/booking/${encodeURIComponent(slug)}/slots`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: SlotsResponse) => setData(d))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [slug]);

  const byDay = useMemo(() => {
    const groups = new Map<string, string[]>();
    for (const iso of data?.slots || []) {
      const day = new Date(iso).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
      const arr = groups.get(day) || [];
      arr.push(iso);
      groups.set(day, arr);
    }
    return [...groups.entries()];
  }, [data]);

  const book = async () => {
    if (!selected || !name.trim() || !email.trim() || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/booking/${encodeURIComponent(slug)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ start: selected, inviteeName: name.trim(), inviteeEmail: email.trim(), notes: notes.trim() }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.message || "Could not book that time.");
      setConfirmed(payload?.when || "your selected time");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not book.");
    } finally {
      setSubmitting(false);
    }
  };

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
        <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-white p-8 shadow-2xl">
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
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-50 text-2xl">✓</div>
              <h1 className="text-lg font-semibold text-[#1E1B2E]">You&apos;re booked!</h1>
              <p className="mt-2 text-sm text-[#6B7280]">{data?.title} — {confirmed}. A confirmation is on its way to {email}.</p>
            </div>
          ) : (
            <>
              <h1 className="text-xl font-semibold tracking-tight text-[#1E1B2E]">{data?.title}</h1>
              {data?.description ? <p className="mt-1 text-sm text-[#6B7280]">{data.description}</p> : null}
              <p className="mt-1 text-xs text-[#9A93AE]">{data?.durationMinutes} minutes · times shown in your local timezone</p>

              <div className="mt-5 max-h-64 overflow-y-auto pr-1">
                {byDay.length === 0 ? (
                  <p className="text-sm text-[#6B7280]">No open times in the next couple of weeks.</p>
                ) : (
                  byDay.map(([day, slots]) => (
                    <div key={day} className="mb-4">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#847FA0]">{day}</p>
                      <div className="flex flex-wrap gap-2">
                        {slots.map((iso) => {
                          const label = new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
                          const active = selected === iso;
                          return (
                            <button
                              key={iso}
                              type="button"
                              onClick={() => setSelected(iso)}
                              className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                                active ? "border-[#701CC0] bg-[#701CC0] text-white" : "border-[#E5E7EB] text-[#1E1B2E] hover:border-[#701CC0]"
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {selected ? (
                <div className="mt-4 space-y-2 border-t border-[#EEF0F4] pt-4">
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
              ) : null}
            </>
          )}
        </div>
      </div>
    </>
  );
}
