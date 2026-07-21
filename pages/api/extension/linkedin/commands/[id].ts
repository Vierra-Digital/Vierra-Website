import type { NextApiRequest, NextApiResponse } from "next";
import { prisma } from "@/lib/prisma";
import { applyExtensionCors, resolveExtensionUser } from "@/lib/linkedin/extensionAuth";

/**
 * The extension reports the result of a send command back here after attempting the send
 * on linkedin.com. Scoped to the token's user (a command can only be resolved by its owner).
 *
 * POST { status: "SENT" | "FAILED", error?, liThreadId?, liMessageId? }
 *   - On SENT with a liMessageId, records the sent message into the thread so the panel
 *     shows it immediately (idempotent on (thread_id, li_message_id)).
 */
function str(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  applyExtensionCors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST", "OPTIONS"]);
    res.status(405).json({ message: "Method Not Allowed" });
    return;
  }

  const auth = await resolveExtensionUser(req);
  if (!auth) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  const id = str(req.query.id);
  if (!id) {
    res.status(400).json({ message: "Missing command id." });
    return;
  }
  const body = (req.body || {}) as { status?: unknown; error?: unknown; liThreadId?: unknown; liMessageId?: unknown };
  const status = str(body.status) === "SENT" ? "SENT" : str(body.status) === "FAILED" ? "FAILED" : null;
  if (!status) {
    res.status(400).json({ message: "status must be SENT or FAILED." });
    return;
  }

  try {
    // Ensure the command belongs to the token's user before mutating.
    const command = await prisma.linkedInSendCommand.findFirst({
      where: { id, user_id: auth.userId },
      select: { id: true, li_thread_id: true, body: true },
    });
    if (!command) {
      res.status(404).json({ message: "Command not found." });
      return;
    }

    await prisma.linkedInSendCommand.update({
      where: { id: command.id },
      data: { status, error: status === "FAILED" ? str(body.error) : null, updated_at: new Date() },
    });

    // Record the successfully sent message so it appears in the panel thread.
    const liMessageId = str(body.liMessageId);
    if (status === "SENT" && liMessageId) {
      const liThreadId = str(body.liThreadId) || command.li_thread_id;
      const thread = await prisma.linkedInThread.findUnique({
        where: { user_id_li_thread_id: { user_id: auth.userId, li_thread_id: liThreadId } },
        select: { id: true },
      });
      if (thread) {
        await prisma.linkedInMessage.upsert({
          where: { thread_id_li_message_id: { thread_id: thread.id, li_message_id: liMessageId } },
          update: { body: command.body, direction: "out", sent_at: new Date() },
          create: {
            thread_id: thread.id,
            li_message_id: liMessageId,
            direction: "out",
            body: command.body,
            sent_at: new Date(),
          },
        });
        await prisma.linkedInThread.update({
          where: { id: thread.id },
          data: { last_message_at: new Date(), updated_at: new Date() },
        });
      }
    }

    res.status(200).json({ success: true });
  } catch (e) {
    console.error("extension/linkedin/commands/[id] error:", e);
    res.status(500).json({ message: "Internal Server Error" });
  }
}
