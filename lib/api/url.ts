import type { NextApiRequest } from "next";

export function resolveBaseUrl(req: NextApiRequest): string {
  const envBase = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
  if (envBase) return envBase.replace(/\/+$/, "");

  const protoHeader = req.headers["x-forwarded-proto"];
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader;
  const host = req.headers.host || "vierradev.com";
  return `${proto || "https"}://${host}`.replace(/\/+$/, "");
}

