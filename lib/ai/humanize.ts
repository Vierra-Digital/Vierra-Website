/**
 * Humanization — the style guide and output cleaner that make Artemis read like a person.
 *
 * Both halves already run on the box, but only on its own endpoints. `/chat` and `/generate` build
 * their prompt from `humanize.txt` and pass the answer through `clean_ai_tells()`. The
 * OpenAI-compatible passthrough at `/v1/chat/completions` cannot: it forwards whatever body it is
 * given straight to vLLM, so the system prompt is entirely the caller's. That is the path every
 * panel feature uses (compose, reply, rewrite, summarize, Gmail auto-draft), which is why they
 * sounded like stock AI while Corinna did not.
 *
 * The guide below is a copy of `~/artemis/humanize.txt` on the box, which stays the canonical
 * version. If that file changes meaningfully, update this one. Adapted in one place: the box tells
 * the model it may only use what Alex said, which is the assistant's rule, not the panel's.
 */

/** Adapted from blader/humanizer and Wikipedia's "Signs of AI writing". */
export const HUMANIZE_STYLE = `STYLE - write like a real person, not an AI. This shapes HOW you write; it does not override a tone you were asked to hit.

PUNCTUATION & FORMAT
- Never use em dashes or en dashes. Use periods, commas, colons, or parentheses. Rewrite to avoid the dash.
- Straight quotes only, never curly. No ellipsis character; three periods only if truly needed.
- Don't overuse bold. Never write lists where every item is "**Label:** sentence." Sentence case in headings, not Title Case.
- No decorative emojis. Hyphenate a pair only before a noun ("high-quality report"), not after ("the report is high quality").

WORDS TO CUT
- Buzzwords: delve, tapestry, realm, landscape, showcase, underscore, crucial, pivotal, testament, vibrant, seamless, robust, leverage, utilize, harness, elevate, unlock, foster, comprehensive, intricate, game-changer, cutting-edge.
- Use plain verbs "is / has", not "serves as / features / boasts".
- Filler: "in order to"->"to", "due to the fact that"->"because", "at this point in time"->"now". Cut "it's important to note", "it's worth noting".

STRUCTURE
- Vary sentence length. Don't force groups of three. Don't stack short fragments as fake punchlines.
- No "not only X but Y". No false "from X to Y" ranges. Use active voice and name who acts.
- No fake-depth openers: "at its core", "the real question is", "fundamentally". No "X is the Y of Z" sayings.
- No preambles ("let's dive in", "here's what you need to know") and don't restate a heading in its first line. Just say it.
- Don't stack qualifiers or over-hedge. Take a position.

TONE
- No flattery or agreement openers ("great question", "you're absolutely right"). No chatbot closings ("I hope this helps", "let me know", "would you like me to").
- No knowledge-limit disclaimers. Don't answer objections nobody raised. Don't raise a fake alternative just to dismiss it.
- End on the last useful point. No generic optimism ("the future looks bright").

TRUTH
- Never invent facts, names, numbers, dates, or sources. If you don't know, say so. Use only what you were given in this request.
- Always write dates as MM/DD/YYYY and times in 12-hour format with AM/PM (for example 09/05/2026 7:00 PM). Never show raw ISO timestamps like 2026-09-05T19:00:00.`;

/**
 * Deterministic pass over model output — the prompt asks for these rules, this enforces the ones
 * that can be enforced. A port of `clean_ai_tells()` on the box, kept behaviourally identical so
 * text reads the same whichever endpoint produced it. Idempotent, so running it over output the
 * box already cleaned changes nothing.
 */
export function cleanAiTells(text: string): string {
  if (!text) return text;
  return (
    text
      // A spaced em/en dash is doing the job of a comma, so make it one. A bare em dash is the
      // same substitution; a bare en dash is usually a range or a hyphen, so it becomes a hyphen.
      .replace(/ — /g, ", ")
      .replace(/ – /g, ", ")
      .replace(/—/g, ", ")
      .replace(/–/g, "-")
      .replace(/‑/g, "-")
      .replace(/―/g, "-")
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/…/g, "...")
      .replace(/ /g, " ")
      .replace(/​/g, "")
      // Tidy what the substitutions above can leave behind: a space before punctuation, a doubled
      // comma where a dash sat next to one, and runs of spaces.
      .replace(/[ \t]+([,.;:!?])/g, "$1")
      .replace(/,\s*,/g, ", ")
      .replace(/[ \t]{2,}/g, " ")
      .trim()
  );
}

/**
 * Today, as MM/DD/YYYY in Vierra's own timezone.
 *
 * Eastern rather than the server's clock: this ends up in emails and drafts written for a Medford
 * and New York team, and a Netlify function runs in UTC, which is a day ahead all evening.
 */
function todayEastern(): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(new Date());
}

/**
 * Put the style guide in front of a caller's system prompt, and tell the model what day it is.
 *
 * The date matters because of the style guide, not despite it: the rules demand MM/DD/YYYY, and a
 * model asked to propose a meeting time will happily obey the format with an invented year (a live
 * draft came back suggesting 09/10/2023). The box injects the current date on its own endpoints;
 * the passthrough this client uses does not, so it has to be added here.
 */
export function withHumanizedSystem(system: string): string {
  const dateLine = `Today's date is ${todayEastern()} (US Eastern). Never state a date you were not given or cannot derive from today.`;
  return `${HUMANIZE_STYLE}\n\n${dateLine}\n\n${system}`;
}
