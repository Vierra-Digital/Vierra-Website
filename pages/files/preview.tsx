import React from "react"
import Head from "next/head"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/pages/api/auth/[...nextauth]"
import type { GetServerSideProps } from "next"

type Props = {
  tokenId: string
  name: string
}

export default function FilePreviewPage({ tokenId, name }: Props) {
  const displayName = name.replace(/\.[^/.]+$/, "") || name
  const pdfUrl = `/api/admin/file/${encodeURIComponent(name)}?tokenId=${encodeURIComponent(tokenId)}&preview=1`

  return (
    <>
      <Head>
        <title>{displayName}</title>
      </Head>
      <div className="fixed inset-0 bg-[#1a1a1a] flex flex-col">
        <iframe
          title={displayName}
          src={pdfUrl}
          className="flex-1 w-full border-0"
        />
      </div>
    </>
  )
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions)
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
