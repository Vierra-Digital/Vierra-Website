import { withSession } from "@/lib/api/withSession";
import { resolveCompanyTargets, resolveLinkedInTokenForContext } from "@/lib/linkedin";

type SessionRole = "admin" | "staff" | "user";

export default withSession(async (req, res, session) => {
  const role = ((session.user as { role?: SessionRole }).role || "user") as SessionRole;
  if (!["admin", "staff", "user"].includes(role)) return res.status(403).json({ message: "Forbidden" });

  const userId = (session.user as { id?: string }).id;
  if (!userId) return res.status(400).json({ message: "Invalid session user." });
  const clientId = typeof req.query.clientId === "string" ? req.query.clientId : null;

  try {
    const token = await resolveLinkedInTokenForContext({
      sessionUserId: userId,
      role,
      clientId,
    });
    if (!token) return res.status(200).json({ connected: false, pages: [] });

    const pages = await resolveCompanyTargets(token);
    return res.status(200).json({ connected: true, pages });
  } catch (error) {
    console.error("linkedin/company-pages", error);
    const raw = error instanceof Error ? error.message : "";
    const permissionLike =
      /ACCESS_DENIED|NOT_AUTHORIZED|permissions?|organization|scope/i.test(raw);
    const message =
      permissionLike
        ? "LinkedIn is connected, but organization permissions are missing. Reconnect LinkedIn and approve company admin scopes."
        : "Unable to load LinkedIn company pages.";
    return res.status(200).json({ connected: false, pages: [], message });
  }
}, { methods: ["GET"] });

