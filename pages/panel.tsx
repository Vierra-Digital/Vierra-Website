import React, { useEffect, useState } from "react"
import Head from "next/head"
import { Inter } from "next/font/google"
import Image from "next/image"
import { useRouter } from "next/navigation"
import SignPdfModal from "@/components/ui/SignPdfModal"
import LtvCalculatorModal from "@/components/ui/LtvCalculatorModal"
import Link from "next/link"
import { FiLogOut, FiFileText, FiUsers } from "react-icons/fi"
import { useSession, signOut } from "next-auth/react"
import UserSettingsPage from "@/components/UserSettingsPage"
import AddClientModal from "@/components/ui/AddClientModal"
import type { SessionItem } from "@/types/session"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/pages/api/auth/[...nextauth]"
import type { GetServerSideProps } from "next"

const inter = Inter({ subsets: ["latin"] })

type PageProps = { dashboardHref: string }

const PanelPage = ({ dashboardHref }: PageProps) => {
  const router = useRouter()
  const [isSignModalOpen, setIsSignModalOpen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [isLtvModalOpen, setIsLtvModalOpen] = useState(false)
  const { data: session } = useSession()
  const [isAddClientOpen, setIsAddClientOpen] = useState(false)
  const [items, setItems] = useState<SessionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchSessions()
  }, [])

  async function fetchSessions() {
    try {
      setLoading(true)
      const r = await fetch("/api/session/listClientSessions")
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const data: SessionItem[] = await r.json()
      setItems(data)
    } catch (e: any) {
      setError(e?.message ?? "Failed to load sessions")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Head>
        <title>Vierra | Admin Panel</title>
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
              onClick={() => setIsSignModalOpen(true)}
              className={`flex items-center w-full p-2 rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors duration-200`}
              aria-label="Prepare PDF for Signing"
            >
              <FiFileText className="w-5 h-5" />
              <span className={`ml-3 text-sm font-medium ${inter.className}`}>
                PDF Signer
              </span>
            </button>
            <button
              onClick={() => setIsLtvModalOpen(true)}
              className={`flex items-center w-full p-2 rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors duration-200`}
              aria-label="Open LTV Calculator"
            >
              <span className="w-5 h-5 flex items-center justify-center font-bold text-lg">
                Σ
              </span>
              <span className={`ml-3 text-sm font-medium ${inter.className}`}>
                LTV Calculator
              </span>
            </button>

            <button
              onClick={() => setIsAddClientOpen(true)}
              className={`flex items-center w-full p-2 rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors duration-200`}
              aria-label="Open LTV Calculator"
            >
              <FiUsers className="w-5 h-5" />
              <span className={`ml-3 text-sm font-medium ${inter.className}`}>
                Add Clients
              </span>
            </button>

            <button
              onClick={() => router.push("/manage-users")}
              className={`flex items-center w-full p-2 rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors duration-200`}
              aria-label="Manage Users"
            >
              <FiUsers className="w-5 h-5" />
              <span className={`ml-3 text-sm font-medium ${inter.className}`}>
                Manage Users
              </span>
            </button>
          </div>

          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className={`flex items-center w-full p-2 rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors duration-200`}
            aria-label="Logout"
          >
            <FiLogOut className="w-5 h-5" />
            <span className={`ml-3 text-sm font-medium ${inter.className}`}>
              Logout
            </span>
          </button>
        </div>

        <div className="flex-1 flex flex-col">
          {/* Top header bar */}
          <div className="h-16 bg-[#2E0A4F] flex items-center pl-64 pr-8 justify-end relative">
            <button
              className="ml-4 flex items-center focus:outline-none absolute right-8 top-1/2 -translate-y-1/2"
              aria-label="Open user settings"
              onClick={() => setShowSettings((prev) => !prev)}
            >
              <Image
                src={
                  typeof session?.user?.image === "string" &&
                  session.user.image.length > 0
                    ? session.user.image
                    : "/assets/vierra-logo.png"
                }
                alt="Profile"
                width={48}
                height={48}
                className="object-cover w-full h-full"
                priority
                quality={100}
              />
            </button>
          </div>
          {/* Main content area */}
          <div className="flex-1 bg-[#18042A] overflow-auto p-6">
            {showSettings ? (
              <UserSettingsPage
                user={
                  session?.user || {
                    name: "Test User",
                    email: "test@vierra.com",
                    image: "/assets/vierra-logo.png",
                  }
                }
              />
            ) : (
              // Dashboard
              <>
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold">Onboarding Sessions</h2>
                </div>

                {loading ? (
                  <p>Loading sessions...</p>
                ) : error ? (
                  <p className="text-red-400">{error}</p>
                ) : items.length === 0 ? (
                  <p>No sessions found.</p>
                ) : (
                  <table className="w-full border-collapse border border-gray-600">
                    <thead>
                      <tr className="bg-[#2E0A4F]">
                        <th className="border border-gray-600 p-2">
                          Client Name
                        </th>
                        <th className="border border-gray-600 p-2">Email</th>
                        <th className="border border-gray-600 p-2">Business</th>
                        <th className="border border-gray-600 p-2">Status</th>
                        <th className="border border-gray-600 p-2">
                          Created At
                        </th>
                        <th className="border border-gray-600 p-2">
                          Submitted At
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((session) => (
                        <tr key={session.token}>
                          <td className="border border-gray-600 p-2">
                            {session.clientName}
                          </td>
                          <td className="border border-gray-600 p-2">
                            {session.clientEmail}
                          </td>
                          <td className="border border-gray-600 p-2">
                            {session.businessName}
                          </td>
                          <td className="border border-gray-600 p-2">
                            {session.status}
                          </td>
                          <td className="border border-gray-600 p-2">
                            {new Date(session.createdAt).toLocaleString()}
                          </td>
                          <td className="border border-gray-600 p-2">
                            {session.submittedAt
                              ? new Date(session.submittedAt).toLocaleString()
                              : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <SignPdfModal
        isOpen={isSignModalOpen}
        onClose={() => setIsSignModalOpen(false)}
      />
      {/* <UserSettingsModal
          open={isSettingsModalOpen}
          onClose={() => setIsSettingsModalOpen(false)}
          user={session?.user || {}}
        /> */}
      {isLtvModalOpen && (
        <LtvCalculatorModal
          isOpen={isLtvModalOpen}
          onClose={() => setIsLtvModalOpen(false)}
        />
      )}
      {isAddClientOpen && (
        <AddClientModal
          isOpen={isAddClientOpen}
          onClose={() => {
            setIsAddClientOpen(false)
            fetchSessions() // safety refetch
          }}
          onCreated={(row) => {
            setItems((prev) => [row, ...prev])
          }}
        />
      )}
    </>
  )

  return null
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions)

  if (!session) {
    return { redirect: { destination: "/login", permanent: false } }
  }
  const role = (session.user as any).role
  if ((session.user as any).role === "user") {
    return { redirect: { destination: "/client", permanent: false } }
  }
  return { props: { dashboardHref: role === "user" ? "/client" : "/panel" } }
}

export default PanelPage
