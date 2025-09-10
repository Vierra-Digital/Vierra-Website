import React, { useEffect, useState } from "react"
import Head from "next/head"
import { Inter } from "next/font/google"
import Image from "next/image"
import { useRouter } from "next/navigation"
import SignPdfModal from "@/components/ui/SignPdfModal"
import LtvCalculatorModal from "@/components/ui/LtvCalculatorModal"
import Link from "next/link"
import { FiLogOut, FiFileText, FiUsers, FiPlus, FiChevronDown } from "react-icons/fi"
import { useSession, signOut, signIn } from "next-auth/react"
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
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const [adminAccounts, setAdminAccounts] = useState<any[]>([])
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<any>(null)
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loginError, setLoginError] = useState("")
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [isLoginMode, setIsLoginMode] = useState(true)
  const [newAccountEmail, setNewAccountEmail] = useState("")
  const [newAccountName, setNewAccountName] = useState("")
  const [newAccountRole, setNewAccountRole] = useState("user")
  const [addAccountError, setAddAccountError] = useState("")
  const [isCreatingAccount, setIsCreatingAccount] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [createdAccount, setCreatedAccount] = useState<any>(null)
  const [isImpersonating, setIsImpersonating] = useState(false)
  const [impersonationData, setImpersonationData] = useState<any>(null)

  useEffect(() => {
    fetchSessions()
  }, [])

  useEffect(() => {
    // Check for impersonation data
    const storedImpersonation = localStorage.getItem('impersonationData')
    if (storedImpersonation) {
      try {
        const data = JSON.parse(storedImpersonation)
        setImpersonationData(data)
        setIsImpersonating(true)
      } catch (error) {
        console.error('Error parsing impersonation data:', error)
        localStorage.removeItem('impersonationData')
      }
    }
  }, [])

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  // Fetch admin accounts for switch/add account dropdown
  useEffect(() => {
    const headers: HeadersInit = {}
    if (isImpersonating) {
      headers['x-impersonation'] = 'true'
    }
    
    fetch("/api/admin/accounts", { headers })
      .then((res) => res.json())
      .then((data) => {
        if (data?.success) setAdminAccounts(data.accounts)
      })
      .catch((err) => console.error("Error fetching admin accounts:", err))
  }, [isImpersonating])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showUserDropdown) {
        const target = event.target as HTMLElement
        if (!target.closest('.user-dropdown')) {
          setShowUserDropdown(false)
        }
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showUserDropdown]);

  // Account controls (match manage-users behavior)
  const handleAddAccount = () => {
    setIsLoginMode(false)
    setShowLoginModal(true)
    setShowUserDropdown(false)
  }

  const handleSwitchAccount = async (account: any) => {
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' }
      if (isImpersonating) headers['x-impersonation'] = 'true'
      const res = await fetch('/api/admin/switch-account', {
        method: 'POST',
        headers,
        body: JSON.stringify({ accountId: account.id }),
      })
      if (res.ok) {
        setShowUserDropdown(false)
        window.location.reload()
      } else {
        console.error('Failed to switch account')
      }
    } catch (err) {
      console.error('Error switching account:', err)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoggingIn(true)
    setLoginError("")
    try {
      const result = await signIn('credentials', {
        email: loginEmail,
        password: loginPassword,
        redirect: false,
      })
      if (result && !result.error) {
        setShowLoginModal(false)
        router.refresh()
      } else {
        setLoginError('Invalid credentials')
      }
    } catch (err) {
      setLoginError('Login failed')
    } finally {
      setIsLoggingIn(false)
    }
  }

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsCreatingAccount(true)
    setAddAccountError("")
    try {
      const response = await fetch('/api/admin/create-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newAccountEmail, name: newAccountName, role: newAccountRole })
      })
      const data = await response.json()
      if (response.ok && data?.success) {
        setCreatedAccount({ email: newAccountEmail, name: newAccountName, role: newAccountRole, password: data.password })
        setShowSuccessModal(true)
        setShowLoginModal(false)
        setNewAccountEmail("")
        setNewAccountName("")
        setNewAccountRole("user")
        // refresh accounts
        fetch('/api/admin/accounts').then(r=>r.json()).then(d=>{ if (d?.success) setAdminAccounts(d.accounts) })
      } else {
        setAddAccountError(data?.error || 'Error creating account')
      }
    } catch (err) {
      setAddAccountError('Error creating account')
    } finally {
      setIsCreatingAccount(false)
    }
  }

  const handleCloseLoginModal = () => {
    setShowLoginModal(false)
    setSelectedAccount(null)
    setLoginEmail("")
    setLoginPassword("")
    setLoginError("")
  }

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
      <div className="min-h-screen bg-gray-100 flex">
        {/* Sidebar */}
        <div className="w-64 bg-[#2E0A4F] flex-shrink-0 min-h-screen">
          {/* Logo */}
          <div className="p-6">
            <Link href={dashboardHref} className="block">
              <Image
                src="/assets/vierra-logo.png"
                alt="Vierra Logo"
                width={120}
                height={40}
                className="w-auto h-10"
              />
            </Link>
          </div>

          {/* Navigation */}
          <div className="px-4 pb-4">
            <div className="space-y-2">
              <button
                onClick={() => setIsSignModalOpen(true)}
                className="flex items-center w-full p-3 rounded-lg text-white bg-white/10 transition-colors"
                aria-label="Prepare PDF for Signing"
              >
                <FiFileText className="w-5 h-5" />
                <span className="ml-3 text-sm font-medium">PDF Signer</span>
              </button>
              <button
                onClick={() => setIsLtvModalOpen(true)}
                className="flex items-center w-full p-3 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Open LTV Calculator"
              >
                <span className="w-5 h-5 flex items-center justify-center font-bold text-lg">Σ</span>
                <span className="ml-3 text-sm font-medium">LTV Calculator</span>
              </button>
              <button
                onClick={() => setIsAddClientOpen(true)}
                className="flex items-center w-full p-3 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Add Clients"
              >
                <FiUsers className="w-5 h-5" />
                <span className="ml-3 text-sm font-medium">Add Clients</span>
              </button>
              <button
                onClick={() => router.push("/manage-users")}
                className="flex items-center w-full p-3 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Manage Users"
              >
                <FiUsers className="w-5 h-5" />
                <span className="ml-3 text-sm font-medium">Manage Users</span>
              </button>
              <button
                onClick={() => router.push("/create-ads")}
                className="flex items-center w-full p-3 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Create Ads"
              >
                <FiPlus className="w-5 h-5" />
                <span className="ml-3 text-sm font-medium">Create Ads</span>
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Top Header */}
          <div className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-end">
              <div className="relative user-dropdown">
                <div 
                  className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 p-2 rounded-lg"
                  onClick={() => setShowUserDropdown(!showUserDropdown)}
                >
                  <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-gray-700">
                      {session?.user?.name ? getInitials(session.user.name) : 'A'}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-gray-900">
                      {session?.user?.name || session?.user?.email || 'Admin'}
                    </span>
                  </div>
                  <FiChevronDown className="w-4 h-4 text-gray-500" />
                </div>
                
                {showUserDropdown && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    <button
                      onClick={() => { signOut({ callbackUrl: '/login' }); setShowUserDropdown(false) }}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-3"
                    >
                      <FiLogOut className="w-4 h-4" />
                      <span>Logout</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Page Content */}
          <div className="flex-1 p-6 bg-white">
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
                <div className="mb-6">
                  <h1 className="text-3xl font-bold text-gray-900">Onboarding Sessions</h1>
                </div>

                {loading ? (
                  <p className="text-gray-600">Loading sessions...</p>
                ) : error ? (
                  <p className="text-red-600">{error}</p>
                ) : items.length === 0 ? (
                  <p className="text-gray-600">No sessions found.</p>
                ) : (
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Client Name
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Email
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Business
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Status
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Created At
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Submitted At
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {items.map((session) => (
                            <tr key={session.token} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {session.clientName}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {session.clientEmail}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {session.businessName}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                  session.status === 'completed' 
                                    ? 'bg-green-100 text-green-800' 
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {session.status}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {new Date(session.createdAt).toLocaleString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {session.submittedAt
                                  ? new Date(session.submittedAt).toLocaleString()
                                  : "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
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
      {/* Login/Create Account Modal (simple) */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="relative bg-white rounded-lg p-6 w-[90%] max-w-md shadow-lg">
            <button
              onClick={handleCloseLoginModal}
              className="absolute top-3 right-3 text-gray-500 hover:text-gray-700"
            >
              ×
            </button>

            <h2 className="text-xl font-semibold mb-4">
              {isLoginMode ? 'Login to Account' : 'Create New Account'}
            </h2>

            {isLoginMode && selectedAccount && (
              <div className="mb-4 p-3 bg-gray-50 rounded border border-gray-200 text-sm">
                <div className="font-medium">{selectedAccount.email}</div>
                <div className="text-gray-500">{selectedAccount.role}</div>
              </div>
            )}

            <form onSubmit={isLoginMode ? handleLogin : handleCreateAccount} className="space-y-3">
              {isLoginMode ? (
                <>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="Email"
                    className="w-full border border-gray-300 rounded p-2"
                    required
                  />
                  <div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Password"
                      className="w-full border border-gray-300 rounded p-2"
                      required
                    />
                    <label className="text-xs text-gray-600 inline-flex items-center mt-1">
                      <input type="checkbox" className="mr-2" checked={showPassword} onChange={() => setShowPassword(!showPassword)} />
                      Show password
                    </label>
                  </div>
                  {loginError && <div className="text-red-600 text-sm">{loginError}</div>}
                  <button
                    type="submit"
                    disabled={isLoggingIn}
                    className="w-full bg-[#2E0A4F] text-white rounded py-2 hover:bg-[#3A1A5F] disabled:opacity-60"
                  >
                    {isLoggingIn ? 'Logging in...' : 'Login'}
                  </button>
                </>
              ) : (
                <>
                  <input
                    type="email"
                    value={newAccountEmail}
                    onChange={(e) => setNewAccountEmail(e.target.value)}
                    placeholder="Email"
                    className="w-full border border-gray-300 rounded p-2"
                    required
                  />
                  <input
                    type="text"
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                    placeholder="Name"
                    className="w-full border border-gray-300 rounded p-2"
                  />
                  <select
                    value={newAccountRole}
                    onChange={(e) => setNewAccountRole(e.target.value)}
                    className="w-full border border-gray-300 rounded p-2"
                  >
                    <option value="user">user</option>
                    <option value="admin">admin</option>
                  </select>
                  {addAccountError && <div className="text-red-600 text-sm">{addAccountError}</div>}
                  <button
                    type="submit"
                    disabled={isCreatingAccount}
                    className="w-full bg-[#2E0A4F] text-white rounded py-2 hover:bg-[#3A1A5F] disabled:opacity-60"
                  >
                    {isCreatingAccount ? 'Creating...' : 'Create Account'}
                  </button>
                </>
              )}
            </form>
          </div>
        </div>
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
