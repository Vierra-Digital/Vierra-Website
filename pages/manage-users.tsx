import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Head from "next/head"
import { FiUsers, FiLogOut, FiFileText } from "react-icons/fi"
import Image from "next/image"
import Link from "next/link"
import { Inter } from "next/font/google"
import { signOut } from "@/lib/session-client"
import type { GetServerSideProps } from "next"
import { requireSession } from "@/lib/auth"

const inter = Inter({ subsets: ["latin"] })

type PageProps = { dashboardHref: string }

export default function ManageUsersPage({ dashboardHref }: PageProps) {
  type CompletedUser = {
    id: string
    email: string
    client?: { name: string | null }
  }
  const router = useRouter()
  const [users, setUsers] = useState<CompletedUser[]>([])
  const [selected, setSelected] = useState<CompletedUser | null>(null)
  const [resetStatus, setResetStatus] = useState<"idle" | "sending" | "sent" | "error">("idle")

  const sendResetEmail = async (userId: string) => {
    setResetStatus("sending")
    try {
      const r = await fetch("/api/admin/userPassword", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId }),
      })
      setResetStatus(r.ok ? "sent" : "error")
    } catch {
      setResetStatus("error")
    }
  }

  useEffect(() => {
    fetch("/api/admin/completed-users")
      .then((res) => res.json())
      .then((data) => {
        setUsers(data)
      })
  }, [])

  return (
    <>
      <Head>
        <title>Vierra | Manage Users</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
    <div className="relative min-h-screen bg-[#18042A] text-white flex">
      
      <div className="absolute top-4 left-4 z-20">
        <Link
          href={dashboardHref}
          aria-label="Go to homepage"
          className="block"
        >
          <Image
            src="/assets/vierra-logo.png"
            alt="Vierra Logo"
            width={120}
            height={40}
            className="cursor-pointer h-10 w-auto"
          />
        </Link>
      </div>

      <div className="w-56 bg-[#2E0A4F] h-screen flex flex-col justify-between pt-20 pb-4 px-4">
        <div className="flex flex-col space-y-2">
          <button
            onClick={() => router.push("/panel")}
            className="flex items-center w-full p-2 rounded text-white/70 hover:text-white hover:bg-white/10"
          >
            <FiFileText className="w-5 h-5" />
            <span className={`ml-3 text-sm font-medium ${inter.className}`}>
              Dashboard
            </span>
          </button>
          <button
            onClick={() => router.push("/manage-users")}
            className="flex items-center w-full p-2 rounded text-white bg-white/10"
          >
            <FiUsers className="w-5 h-5" />
            <span className={`ml-3 text-sm font-medium ${inter.className}`}>
              Manage Users
            </span>
          </button>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center w-full p-2 rounded text-white/70 hover:text-white hover:bg-white/10"
        >
          <FiLogOut className="w-5 h-5" />
          <span className={`ml-3 text-sm font-medium ${inter.className}`}>
            Logout
          </span>
        </button>
      </div>

      
      <div className="flex-1 p-6">
        <h1 className="text-2xl font-bold mb-4">Manage Users</h1>
        {users.map((u) => (
          <div key={u.id} className="mb-2">
            <button
              onClick={() => { setSelected(u); setResetStatus("idle") }}
              className="border border-white/20 px-3 py-1 rounded"
            >
              {u.client?.name || "No Name"}
            </button>
          </div>
        ))}

        {selected && (
          <div className="mt-4 space-y-2">
            <p>Email: {selected.email}</p>
            <button
              onClick={() => sendResetEmail(selected.id)}
              disabled={resetStatus === "sending"}
              className="border border-white/20 px-3 py-1 rounded text-sm"
            >
              {resetStatus === "sending" ? "Sending…" : "Send password reset email"}
            </button>
            {resetStatus === "sent" && <p className="text-green-400 text-sm">Reset email sent.</p>}
            {resetStatus === "error" && <p className="text-red-400 text-sm">Failed to send reset email.</p>}
          </div>
        )}
      </div>
    </div>
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await requireSession(ctx.req, ctx.res)
  if (!session) {
    return { redirect: { destination: "/login", permanent: false } }
  }

  const role = (session.user as any).role
  if ((session.user as any).role !== "admin") {
    return { redirect: { destination: "/client", permanent: false } }
  }

  return { props: { dashboardHref: role === "user" ? "/client" : "/panel" } }
}
