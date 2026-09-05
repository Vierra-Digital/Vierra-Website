import Head from "next/head"
import { requireSession } from "@/lib/auth"
import type { GetServerSideProps } from "next"

type Props = {
  tokenId: string
  returnHref: string
  name: string
}

export default function FilePreviewPage({ tokenId, name, returnHref }: Props) {
  const displayName = name.replace(/\.[^/.]+$/, "") || name
  const fileUrl = `/api/admin/file/${encodeURIComponent(name)}?tokenId=${encodeURIComponent(tokenId)}&preview=1`

  return (
    <>
      <Head>
        <title>{displayName}</title>
      </Head>
      <div className="fixed inset-0 bg-[#1a1a1a] flex flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 p-4 text-white">
          <h1 className="break-all">{displayName}</h1>
          <a href={returnHref} className="underline">Return to files</a>
        </header>
        <iframe title={displayName} src={fileUrl} className="flex-1 w-full border-0" />
      </div>
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
      returnHref: role === "user" ? "/client" : "/panel?section=files",
      name: typeof name === "string" ? name : "document.pdf",
    },
  }
}
