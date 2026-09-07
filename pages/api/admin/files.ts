import { withSession } from "@/lib/api/withSession"
import { prisma } from "@/lib/prisma"

export default withSession(async (req, res, session) => {
  // Client sessions never carry a `role` (see ResolvedIdentity's "client" variant) — default to
  // "user" the same way pages/api/context/client.ts does, or every real client gets 403'd here.
  const role = ((session.user as { role?: string })?.role || "user") as string
  if (role !== "admin" && role !== "staff" && role !== "user")
    return res.status(403).json({ message: "Forbidden" })

  const { filter } = req.query
  const companyId = (session as any).companyId as string | undefined

  try {
    const uid = (session.user as { id?: string })?.id ?? undefined
    const NEVER_MATCH_USER_ID = "00000000-0000-0000-0000-000000000000"

    const where: Record<string, unknown> = {}
    if (role === "user") {
      // Every teammate on the same client company shares one Files list (see
      // ClientTeamSection.tsx and context/client.ts's identical company-wide scope), not a
      // separate copy per representative. session.companyId is this client's own company — a
      // missing value means it could not be resolved, so deny rather than fall through to an
      // unscoped query.
      if (!companyId) return res.status(200).json([])
      where.company_id = companyId
    } else {
      if (companyId) where.company_id = companyId
      if (filter === "me" || !filter) {
        where.user_id = uid ?? NEVER_MATCH_USER_ID
      } else if (filter && typeof filter === "string") {
        where.client_id = filter
      }
    }

    const files = await prisma.storedFile.findMany({
      where: Object.keys(where).length ? where : undefined,
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        name: true,
        file_type: true,
        signing_token_id: true,
        storage_key: true,
        is_deletion_protected: true,
        created_at: true,
        user_id: true,
        client_id: true,
        users: { select: { name: true } },
        clients: { select: { name: true } },
      },
    })

    const rows = files.map((f) => {
      const d = f.created_at
      const mm = String(d.getMonth() + 1).padStart(2, "0")
      const dd = String(d.getDate()).padStart(2, "0")
      const yyyy = d.getFullYear()
      return {
        id: f.id,
        name: f.name,
        date: `${mm}/${dd}/${yyyy}`,
        fileType: f.file_type,
        signingTokenId: f.signing_token_id,
        // Signing-flow files download by tokenId; uploaded files have no token but do have
        // storage_key — either is enough content to serve, so callers know to try the id-based
        // download path instead of showing "unavailable" for a file that really is there.
        hasContent: Boolean(f.signing_token_id || f.storage_key),
        isDeletionProtected: f.is_deletion_protected,
        owner: f.users?.name ?? f.clients?.name ?? "Unknown",
      }
    })

    return res.status(200).json(rows)
  } catch (e) {
    console.error("admin/files GET", e)
    return res.status(500).json({ message: "Failed to load files." })
  }
}, { methods: ["GET"] })
