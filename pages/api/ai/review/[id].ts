import { withAuth } from "@/lib/api/withAuth";
import { asQueryStr, asStr } from "@/lib/api/parsing";
import { prisma } from "@/lib/prisma";

const ACTIONS = ["approve", "reject", "edit"] as const;
type Action = (typeof ACTIONS)[number];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Act on one review item: approve, reject, or save an edited version.
 *
 * Approval is the gate the whole design hangs on — it is the only thing that marks a draft fit to
 * be used — so it is admin-only, and the update is scoped by company_id so one company can never
 * approve another's drafts by guessing an id.
 */
export default withAuth(
  async (req, res, session) => {
    const id = asQueryStr(req.query.id).trim();
    if (!UUID.test(id)) {
      res.status(400).json({ message: "Unknown review item." });
      return;
    }

    const action = asStr(req.body?.action).trim().toLowerCase() as Action;
    if (!(ACTIONS as readonly string[]).includes(action)) {
      res.status(400).json({ message: "Action must be approve, reject or edit." });
      return;
    }

    const note = asStr(req.body?.note).trim().slice(0, 2000) || null;
    const editedContent = asStr(req.body?.content).trim();

    if (action === "edit" && !editedContent) {
      res.status(400).json({ message: "Provide the edited text." });
      return;
    }

    // updateMany, not update: it takes the company_id in the same WHERE, so a mismatched id
    // updates nothing instead of throwing after the row has already been found.
    const { count } = await prisma.artemisReviewItem.updateMany({
      where: { id, company_id: session.companyId },
      data: {
        status: action === "approve" ? "approved" : action === "reject" ? "rejected" : "edited",
        // The original draft is never overwritten — the feedback loop compares the two.
        ...(action === "edit" ? { edited_content: editedContent.slice(0, 100_000) } : {}),
        review_note: note,
        reviewed_by: session.user.id,
        reviewed_at: new Date(),
        updated_at: new Date(),
      },
    });

    if (count === 0) {
      res.status(404).json({ message: "Unknown review item." });
      return;
    }

    const item = await prisma.artemisReviewItem.findFirst({
      where: { id, company_id: session.companyId },
      select: {
        id: true,
        status: true,
        content: true,
        edited_content: true,
        review_note: true,
        reviewed_at: true,
      },
    });

    res.status(200).json({ item });
  },
  { methods: ["PATCH"], roles: ["admin"], scope: "ai/review/[id]" }
);
