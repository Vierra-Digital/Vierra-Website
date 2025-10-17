import type { GetServerSideProps } from 'next'
import Head from 'next/head'
import React from 'react'
import { prisma } from '@/lib/prisma'

type Props = { title: string; content: string } | { expired: true }

export default function TestBlogPage(props: Props) {
  if ('expired' in props) {
    return <div className="min-h-screen flex items-center justify-center">This test link has expired.</div>
  }
  return (
    <div className="min-h-screen bg-white text-[#111827]">
      <Head><title>{props.title}</title></Head>
      <main className="max-w-3xl mx-auto p-8">
        <h1 className="text-3xl font-bold mb-6">{props.title}</h1>
        <div className="prose" dangerouslySetInnerHTML={{ __html: props.content }} />
      </main>
    </div>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const slug = String(ctx.params?.slug || '')
  const post = await prisma.blogPost.findFirst({ where: { slug, is_test: true } })
  if (!post) return { notFound: true }

  const createdMs = post.published_date?.getTime?.() || new Date().getTime()
  const ageMs = Date.now() - createdMs
  const expired = ageMs > 24 * 60 * 60 * 1000
  if (expired) return { props: { expired: true } }

  return { props: { title: post.title, content: post.content } }
}


