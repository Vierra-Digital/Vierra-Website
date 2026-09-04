import type { ArtemisBrain } from "@/lib/ai/artemisBox";

/**
 * Brains the panel is allowed to address.
 *
 * The box enforces this too — its API keys are scoped per brain and it answers 403 for anything
 * outside the key's list. This allowlist is the second layer: `personal` and `alex-assistant` hold
 * private mail, calendar and messages and must never be reachable from a company panel, whatever
 * a request body asks for.
 */
const PANEL_BRAINS = ["vierra", "ndimensions"] as const;

export type PanelBrain = (typeof PANEL_BRAINS)[number];

export const DEFAULT_BRAIN: PanelBrain = "vierra";

/** Resolve a request-supplied brain, falling back to the default rather than trusting the input. */
export function resolveBrain(value: unknown): PanelBrain {
  const candidate = typeof value === "string" ? value.trim().toLowerCase() : "";
  return (PANEL_BRAINS as readonly string[]).includes(candidate) ? (candidate as PanelBrain) : DEFAULT_BRAIN;
}

export function isPanelBrain(value: string): value is PanelBrain {
  return (PANEL_BRAINS as readonly string[]).includes(value);
}

export const panelBrains: readonly ArtemisBrain[] = PANEL_BRAINS;
