import { withSession } from "@/lib/api/withSession";
import { resolveLinkedInTokenForContext, resolvePersonalTarget, linkedInRequest } from "@/lib/linkedin";

type SessionRole = "admin" | "staff" | "user";
type TargetType = "personal" | "company";

type PublishBody = {
  clientId?: string;
  targetType?: TargetType;
  companyId?: string;
  postText?: string;
  visibility?: "PUBLIC" | "CONNECTIONS";
};

export default withSession(async (req, res, session) => {
  const role = ((session.user as { role?: SessionRole }).role || "user") as SessionRole;
  if (!["admin", "staff", "user"].includes(role)) return res.status(403).json({ message: "Forbidden" });

  const userId = (session.user as { id?: string }).id;
  if (!userId) return res.status(400).json({ message: "Invalid session user." });

  const body = (req.body || {}) as PublishBody;
  const postText = (body.postText || "").trim();
  if (!postText) return res.status(400).json({ message: "postText is required." });

  const token = await resolveLinkedInTokenForContext({
      sessionUserId: userId,
      role,
      clientId: typeof body.clientId === "string" ? body.clientId : null,
    });
    if (!token) return res.status(400).json({ message: "LinkedIn is not connected for this account." });

    let authorUrn = "";
    if (body.targetType === "company") {
      if (!body.companyId?.trim()) return res.status(400).json({ message: "companyId is required for company posts." });
      authorUrn = `urn:li:organization:${body.companyId.trim()}`;
    } else {
      const personal = await resolvePersonalTarget(token);
      authorUrn = `urn:li:person:${personal.personId}`;
    }

    const visibility = body.visibility === "CONNECTIONS" ? "CONNECTIONS" : "PUBLIC";
    const payload = {
      author: authorUrn,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: postText },
          shareMediaCategory: "NONE",
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": visibility,
      },
    };

    const publishResponse = await linkedInRequest<{ id?: string }>(token, "/v2/ugcPosts", {
      method: "POST",
      body: payload,
    });

    return res.status(200).json({
      ok: true,
      postId: publishResponse.id || null,
      author: authorUrn,
    });
}, { methods: ["POST"] });

