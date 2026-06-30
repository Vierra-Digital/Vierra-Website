import { withSession } from "@/lib/api/withSession"
import { prisma } from "@/lib/prisma"

export default withSession(async (req, res, session) => {
  const role = (session.user as { role?: string })?.role
  if (role !== "admin" && role !== "staff" && role !== "user")
    return res.status(403).json({ message: "Forbidden" })

  const { filter } = req.query
  const companyId = (session as any).companyId as string | undefined

  try {
    const uid = (session.user as { id?: string })?.id ?? undefined
    const NEVER_MATCH_USER_ID = "00000000-0000-0000-0000-000000000000"

    const where: Record<string, unknown> = {}
    if (companyId) where.company_id = companyId
    if (role === "user") {
      const client = await prisma.client.findUnique({
        where: { user_id: uid ?? NEVER_MATCH_USER_ID },
        select: { id: true },
      })
      if (client) {
        where.client_id = client.id
      } else {
        where.client_id = "__none__"
      }
    } else if (filter === "me" || !filter) {
      where.user_id = uid ?? NEVER_MATCH_USER_ID
    } else if (filter && typeof filter === "string") {
      where.client_id = filter
    }

    const files = await prisma.storedFile.findMany({
      where: Object.keys(where).length ? where : undefined,
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        name: true,
        file_type: true,
        signing_token_id: true,
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
