type EnrichmentItem = {
  keyword: string;
  angle: string;
  title: string;
};

function fallbackEnrichment(seedKeyword: string): EnrichmentItem[] {
  const base = seedKeyword.trim() || "linkedin content";
  return [
    {
      keyword: `${base} strategy`,
      angle: "Best-practice breakdown",
      title: `How to build a ${base} strategy that actually drives leads`,
    },
    {
      keyword: `${base} mistakes`,
      angle: "Contrarian insights",
      title: `The biggest ${base} mistakes most brands still make`,
    },
    {
      keyword: `${base} examples`,
      angle: "Proof-driven list",
      title: `Real-world ${base} examples and why they perform`,
    },
  ];
}

export async function enrichKeywordWithAnswerThePublic(seedKeyword: string) {
  const bridgeUrl = process.env.ANSWER_THE_PUBLIC_BRIDGE_URL;
  if (!bridgeUrl) {
    return fallbackEnrichment(seedKeyword);
  }

  const response = await fetch(bridgeUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.ANSWER_THE_PUBLIC_BRIDGE_TOKEN
        ? { Authorization: `Bearer ${process.env.ANSWER_THE_PUBLIC_BRIDGE_TOKEN}` }
        : {}),
    },
    body: JSON.stringify({
      keyword: seedKeyword,
      source: "linkedin_outreach",
    }),
  });

  if (!response.ok) {
    return fallbackEnrichment(seedKeyword);
  }

  const payload = (await response.json()) as { items?: EnrichmentItem[] };
  if (!Array.isArray(payload.items) || payload.items.length === 0) {
    return fallbackEnrichment(seedKeyword);
  }

  return payload.items.slice(0, 10);
}

