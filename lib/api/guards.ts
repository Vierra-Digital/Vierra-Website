import type { NextApiRequest, NextApiResponse } from "next";
import { requireSession } from "@/lib/auth";

type SessionLike = Awaited<ReturnType<typeof requireSession>>;

export async function requireSessionOrRespond401(
  req: NextApiRequest,
  res: NextApiResponse,
  message = "Not authenticated"
): Promise<Exclude<SessionLike, null>> {
  const session = await requireSession(req, res);
  if (!session) {
    res.status(401).json({ message });
    throw new Error("__handled__");
  }
  return session;
}

export function getSessionRole(session: { user?: { role?: string } } | null | undefined): string | undefined {
  return session?.user?.role;
}

export function requireRolesOrRespond403(
  res: NextApiResponse,
  role: string | undefined,
  allowedRoles: string[],
  message = "Forbidden"
): void {
  if (!role || !allowedRoles.includes(role)) {
    res.status(403).json({ message });
    throw new Error("__handled__");
  }
}

export function requireMethodOrRespond405(
  req: NextApiRequest,
  res: NextApiResponse,
  allowedMethods: string[],
  customMessage?: string
): void {
  if (req.method && allowedMethods.includes(req.method)) return;
  res.setHeader("Allow", allowedMethods);
  res.status(405).json({ message: customMessage ?? "Method Not Allowed" });
  throw new Error("__handled__");
}

export function handleApiError(res: NextApiResponse, scope: string, error: unknown, message = "Internal Server Error") {
  if (error instanceof Error && error.message === "__handled__") return;
  console.error(scope, error);
  res.status(500).json({ message });
}
