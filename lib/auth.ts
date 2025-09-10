import { getServerSession } from "next-auth";
import { authOptions } from "@/pages/api/auth/[...nextauth]";

export async function requireSession(req: any, res: any) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return null;
  // Support admin impersonation by honoring an impersonated user id header
  const isAdmin = (session.user as any).role === 'admin';
  const impersonatedHeader = req.headers['x-impersonated-user-id'] as string | undefined;
  const impersonatedCookie = req.cookies?.impersonatedUserId as string | undefined;
  const effective = impersonatedHeader || impersonatedCookie;
  if (isAdmin && effective) {
    (session.user as any).id = parseInt(effective);
  }
  return session;
}
