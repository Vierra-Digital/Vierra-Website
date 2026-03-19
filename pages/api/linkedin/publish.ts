import type { NextApiRequest, NextApiResponse } from "next";
import { requireSession } from "@/lib/auth";
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ message: "Method Not Allowed" });
  }

  const session = await requireSession(req, res);
  if (!session) return res.status(401).json({ message: "Not authenticated" });

  const role = ((session.user as { role?: SessionRole }).role || "user") as SessionRole;
  if (!["admin", "staff", "user"].includes(role)) return res.status(403).json({ message: "Forbidden" });

  const userId = Number((session.user as { id?: string | number }).id);
  if (Number.isNaN(userId)) return res.status(400).json({ message: "Invalid session user." });

  const body = (req.body || {}) as PublishBody;
  const postText = (body.postText || "").trim();
  if (!postText) return res.status(400).json({ message: "postText is required." });

  try {
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
  } catch (error) {
    console.error("linkedin/publish", error);
    return res.status(500).json({ message: "Failed to publish to LinkedIn." });
  }
}

