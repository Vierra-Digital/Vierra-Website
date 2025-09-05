import Image from "next/image"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useSession, signOut, signIn } from "next-auth/react"
import { Inter } from "next/font/google"
import { FiFileText, FiLogOut, FiLink, FiChevronRight, FiPlus, FiImage, FiArrowLeft, FiChevronDown, FiUserCheck, FiCheck, FiEye, FiEyeOff } from "react-icons/fi"
import type { GetServerSideProps } from "next"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/pages/api/auth/[...nextauth]"
import UserSettingsPage from "@/components/UserSettingsPage"

const inter = Inter({ subsets: ["latin"] })

type PageProps = { dashboardHref: string }

export default function ConnectPage({ dashboardHref }: PageProps) {
  const { data: session } = useSession()
  const router = useRouter()
  const [showSettings, setShowSettings] = useState(false)
  const [isImpersonating, setIsImpersonating] = useState(false)
  const [impersonationData, setImpersonationData] = useState<any>(null)
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

  const [fbConnected, setFb] = useState(false)
  const [liConnected, setLi] = useState(false)
  const [gaConnected, setGa] = useState(false)
  const [loading, setLoading] = useState(true)

  // Check for impersonation data
  useEffect(() => {
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

  const stopImpersonation = () => {
    localStorage.removeItem('impersonationData')
    setIsImpersonating(false)
    setImpersonationData(null)
    router.push('/manage-users')
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const handleAddAccount = () => {
    setIsLoginMode(false)
    setShowLoginModal(true)
    setShowUserDropdown(false)
  }

  const handleSwitchAccount = (account: any) => {
    setSelectedAccount(account)
    setLoginEmail(account.email || '')
    setLoginPassword("")
    setLoginError("")
    setIsLoginMode(true)
    setShowLoginModal(true)
    setShowUserDropdown(false)
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

      if (result?.error) {
        setLoginError('Invalid credentials')
      } else {
        // Login successful, reload the page
        window.location.reload()
      }
    } catch (error) {
      setLoginError('Login failed. Please try again.')
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: newAccountEmail,
          name: newAccountName,
          role: newAccountRole,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setCreatedAccount(data.account)
        setShowSuccessModal(true)
        setShowLoginModal(false)
        // Refresh admin accounts list
        fetch("/api/admin/accounts")
          .then((res) => res.json())
          .then((data) => setAdminAccounts(data.accounts || []))
          .catch((err) => console.error("Error fetching admin accounts:", err))
      } else {
        const errorData = await response.json()
        setAddAccountError(errorData.error || 'Failed to create account')
      }
    } catch (error) {
      setAddAccountError('Failed to create account. Please try again.')
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
    setShowPassword(false)
    setIsLoginMode(true)
    setNewAccountEmail("")
    setNewAccountName("")
    setNewAccountRole("user")
    setAddAccountError("")
    setIsCreatingAccount(false)
  }

  // Fetch admin accounts for switch/add account dropdown
  useEffect(() => {
    const headers: HeadersInit = {}
    if (isImpersonating) {
      headers['x-impersonation'] = 'true'
    }
    
    fetch("/api/admin/accounts", { headers })
      .then((res) => res.json())
      .then((data) => setAdminAccounts(data.accounts || []))
      .catch((err) => console.error("Error fetching admin accounts:", err))
  }, [isImpersonating])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (!target.closest('.user-dropdown')) {
        setShowUserDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Fetch connection status
  useEffect(() => {
    const token = localStorage.getItem("token")
    if (!token) {
      setLoading(false)
      return
    }

    ;(async () => {
      try {
        const [fb, li, ga] = await Promise.all([
          fetch(`/api/facebook/status`, {
            headers: { Authorization: `Bearer ${token}` },
          })
            .then((r) => (r.ok ? r.json() : { connected: false }))
            .catch(() => ({ connected: false })),
          fetch(`/api/linkedin/status`, {
            headers: { Authorization: `Bearer ${token}` },
          })
            .then((r) => (r.ok ? r.json() : { connected: false }))
            .catch(() => ({ connected: false })),
          fetch(`/api/googleads/status`, {
            headers: { Authorization: `Bearer ${token}` },
          })
            .then((r) => (r.ok ? r.json() : { connected: false }))
            .catch(() => ({ connected: false })),
        ])
        setFb(!!fb.connected)
        setLi(!!li.connected)
        setGa(!!ga.connected)
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const startOauth = (provider: "facebook" | "linkedin" | "googleads") => {
    window.location.href = `/api/${provider}/initiate`
  }

  // Layout (same as /client)
  return (
    <>
      <div className="min-h-screen bg-gray-100 flex">
        {/* Sidebar */}
        <div className="w-64 bg-[#2E0A4F] flex-shrink-0 min-h-screen">
          {/* Logo */}
          <div className="p-6">
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
                className="w-auto h-10"
              />
            </Link>
          </div>
          {/* Navigation */}
          <div className="px-4 pb-4">
            <div className="space-y-2">
              {isImpersonating && (
                <div className="mb-4 p-3 bg-yellow-600/20 border border-yellow-500/30 rounded-lg">
                  <div className="text-yellow-200 text-xs mb-2">
                    Impersonating: {impersonationData?.impersonatedUserName}
                  </div>
                  <button
                    onClick={stopImpersonation}
                    className="flex items-center w-full p-2 rounded bg-yellow-600 hover:bg-yellow-700 text-white transition-colors duration-200"
                  >
                    <FiArrowLeft className="w-4 h-4 mr-2" />
                    <span className="text-sm font-medium">
                      Back to Admin
                    </span>
                  </button>
                </div>
              )}
              <button
                onClick={() => router.push("/client")}
                className="flex items-center w-full p-3 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              >
                <FiFileText className="w-5 h-5" />
                <span className="ml-3 text-sm font-medium">Dashboard</span>
              </button>
              <button
                onClick={() => router.push("/connect")}
                className="flex items-center w-full p-3 rounded-lg text-white bg-white/10 transition-colors"
              >
                <FiLink className="w-5 h-5" />
                <span className="ml-3 text-sm font-medium">Connect</span>
              </button>
              {/* Only show Create Ads for admins or when impersonating */}
              {((session?.user as any)?.role === 'admin' || isImpersonating) && (
                <button
                  onClick={() => router.push("/create-ads")}
                  className="flex items-center w-full p-3 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <FiPlus className="w-5 h-5" />
                  <span className="ml-3 text-sm font-medium">Create Ads</span>
                </button>
              )}
              <button
                onClick={() => router.push("/gallery")}
                className="flex items-center w-full p-3 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              >
                <FiImage className="w-5 h-5" />
                <span className="ml-3 text-sm font-medium">Gallery</span>
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
                      {session?.user?.name || session?.user?.email || 'User'}
                    </span>
                  </div>
                  <FiChevronDown className="w-4 h-4 text-gray-500" />
                </div>
                
                {/* Dropdown Menu (match manage-users) */}
                {showUserDropdown && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    <div className="py-2">
                      <div className="px-4 py-2 text-sm text-gray-500 border-b border-gray-100">
                        Switch Account
                      </div>

                      {adminAccounts.map((account) => (
                        <button
                          key={account.id}
                          onClick={() => {
                            handleSwitchAccount(account)
                            setShowUserDropdown(false)
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3"
                        >
                          <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center">
                            <span className="text-xs font-medium text-gray-700">
                              {getInitials(account.email || 'U')}
                            </span>
                          </div>
                          <div>
                            <div className="font-medium">{account.email || 'User'}</div>
                            <div className="text-xs text-gray-500">{account.role}</div>
                          </div>
                        </button>
                      ))}
                      
                      <div className="border-t border-gray-100 mt-2 pt-2">
                        <button
                          onClick={() => {
                            handleAddAccount()
                            setShowUserDropdown(false)
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3"
                        >
                          <FiPlus className="w-4 h-4 text-gray-500" />
                          <span>Add Account</span>
                        </button>
                        
                        <button
                          onClick={() => {
                            signOut({ callbackUrl: "/login" })
                            setShowUserDropdown(false)
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center space-x-3"
                        >
                          <FiLogOut className="w-4 h-4" />
                          <span>Logout</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Content */}
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
              <>
                <h2 className="text-2xl font-bold mb-6 text-gray-900">
                  Connect Your Accounts
                </h2>
                {loading ? (
                  <p className="text-gray-600">Checking connections…</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <button
                      onClick={() => startOauth("facebook")}
                      className="flex items-center justify-between p-5 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition"
                    >
                      <span className="text-gray-900">
                        Facebook{" "}
                        {fbConnected ? "(Connected)" : "(Not Connected)"}
                      </span>
                      <FiChevronRight className="w-5 h-5 text-gray-500" />
                    </button>

                    <button
                      onClick={() => startOauth("linkedin")}
                      className="flex items-center justify-between p-5 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition"
                    >
                      <span className="text-gray-900">
                        LinkedIn{" "}
                        {liConnected ? "(Connected)" : "(Not Connected)"}
                      </span>
                      <FiChevronRight className="w-5 h-5 text-gray-500" />
                    </button>

                    <button
                      onClick={() => startOauth("googleads")}
                      className="flex items-center justify-between p-5 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition"
                    >
                      <span className="text-gray-900">
                        Google Ads{" "}
                        {gaConnected ? "(Connected)" : "(Not Connected)"}
                      </span>
                      <FiChevronRight className="w-5 h-5 text-gray-500" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Login/Create Account Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-gray-900">
                {isLoginMode ? 'Login' : 'Create Account'}
              </h2>
              <button
                onClick={handleCloseLoginModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {isLoginMode ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2E0A4F] focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2E0A4F] focus:border-transparent"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                {loginError && (
                  <p className="text-red-600 text-sm">{loginError}</p>
                )}
                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full bg-[#2E0A4F] text-white py-2 px-4 rounded-md hover:bg-[#3A1A5F] focus:outline-none focus:ring-2 focus:ring-[#2E0A4F] focus:ring-offset-2 disabled:opacity-50"
                >
                  {isLoggingIn ? 'Logging in...' : 'Login'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleCreateAccount} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={newAccountEmail}
                    onChange={(e) => setNewAccountEmail(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2E0A4F] focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name
                  </label>
                  <input
                    type="text"
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2E0A4F] focus:border-transparent"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Role
                  </label>
                  <select
                    value={newAccountRole}
                    onChange={(e) => setNewAccountRole(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2E0A4F] focus:border-transparent"
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                {addAccountError && (
                  <p className="text-red-600 text-sm">{addAccountError}</p>
                )}
                <button
                  type="submit"
                  disabled={isCreatingAccount}
                  className="w-full bg-[#2E0A4F] text-white py-2 px-4 rounded-md hover:bg-[#3A1A5F] focus:outline-none focus:ring-2 focus:ring-[#2E0A4F] focus:ring-offset-2 disabled:opacity-50"
                >
                  {isCreatingAccount ? 'Creating...' : 'Create Account'}
                </button>
              </form>
            )}

            <div className="mt-4 text-center">
              <button
                onClick={() => setIsLoginMode(!isLoginMode)}
                className="text-[#2E0A4F] hover:text-[#3A1A5F] text-sm"
              >
                {isLoginMode ? 'Need to create an account?' : 'Already have an account?'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="text-center">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
                <FiCheck className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Account Created Successfully!</h3>
              <p className="text-sm text-gray-600 mb-4">
                Account for {createdAccount?.email} has been created.
              </p>
              <button
                onClick={() => setShowSuccessModal(false)}
                className="w-full bg-[#2E0A4F] text-white py-2 px-4 rounded-md hover:bg-[#3A1A5F] focus:outline-none focus:ring-2 focus:ring-[#2E0A4F] focus:ring-offset-2"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/** SSR guard: logged-in users only; admins bounce to /panel */
export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions)
  if (!session) return { redirect: { destination: "/login", permanent: false } }
  const role = (session.user as any).role
  if ((session.user as any).role !== "user") {
    return { redirect: { destination: "/panel", permanent: false } }
  }
  return { props: { dashboardHref: role === "user" ? "/client" : "/panel" } }
}
