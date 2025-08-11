import { getServerSession } from "next-auth";
import { authOptions } from "@/pages/api/auth/[...nextauth]";

export async function requireSession(req: any, res: any) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return null;
  return session;
}
