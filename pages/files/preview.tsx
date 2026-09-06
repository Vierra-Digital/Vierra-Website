import Head from "next/head"
import { requireSession } from "@/lib/auth"
import type { GetServerSideProps } from "next"

type Props = {
  tokenId: string
  name: string
}

export default function FilePreviewPage({ tokenId, name }: Props) {
  const displayName = name.replace(/\.[^/.]+$/, "") || name
  const fileUrl = `/api/admin/file/${encodeURIComponent(name)}?tokenId=${encodeURIComponent(tokenId)}&preview=1`

  return (
    <>
      <Head>
        <title>{displayName}</title>
      </Head>
      <iframe title={displayName} src={fileUrl} className="fixed inset-0 h-full w-full border-0 bg-[#1a1a1a]" />
    </>
  )
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await requireSession(ctx.req, ctx.res)
  if (!session) {
    return { redirect: { destination: "/login", permanent: false } }
  }
  const role = (session.user as { role?: string })?.role
  if (role !== "staff" && role !== "admin" && role !== "user") {
    return { redirect: { destination: "/client", permanent: false } }
  }

  const tokenId = ctx.query.tokenId
  const name = ctx.query.name

  if (!tokenId || typeof tokenId !== "string") {
    return { redirect: { destination: "/panel", permanent: false } }
  }

  return {
    props: {
      tokenId,
      name: typeof name === "string" ? name : "document.pdf",
    },
  }
}
