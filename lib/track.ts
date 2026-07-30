// Lightweight GA4 event helper. GA4 is loaded globally via the gtag snippet in
// app/layout.tsx / pages/_app.tsx; this wraps window.gtag so components can fire
// conversion-funnel events without each re-checking for gtag existence.
//
// Events fired across the site:
//   cta_click        — a "Let's Talk"/primary CTA was clicked (params: location)
//   lead_form_open   — the lead modal opened
//   lead_form_step   — advanced to a step (params: step)
//   generate_lead    — the lead form was submitted  ← mark as a GA4 Key Event
//   outbound_click   — an external link was clicked (params: url, label)
//
// After deploy: in GA4 → Admin → Events, toggle `generate_lead` as a Key Event
// so it counts as a conversion. (Dashboard step; cannot be done in code.)

type TrackParams = Record<string, string | number | boolean | undefined>;

export function track(event: string, params: TrackParams = {}): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as { gtag?: (...args: unknown[]) => void };
  try {
    if (typeof w.gtag === "function") {
      w.gtag("event", event, params);
    }
  } catch {
    // Never let analytics throw into the UI.
  }
}
