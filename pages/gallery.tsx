import React, { useState, useEffect } from "react"
import Head from "next/head"
import { Inter } from "next/font/google"
import Image from "next/image"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { FiLogOut, FiFileText, FiUsers, FiPlus, FiCheck, FiLink, FiImage, FiArrowLeft, FiChevronDown, FiTarget } from "react-icons/fi"
import { useSession, signOut, signIn } from "next-auth/react"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/pages/api/auth/[...nextauth]"
import type { GetServerSideProps } from "next"

const inter = Inter({ subsets: ["latin"] })

type GalleryImage = {
  id: string;
  platform: string;
  content: string;
  urlLink: string | null;
  metadata: any;
  createdAt: string;
}

type ImagesByPlatform = {
  [platform: string]: GalleryImage[];
}

type PageProps = { dashboardHref: string }

export default function GalleryPage({ dashboardHref }: PageProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [images, setImages] = useState<ImagesByPlatform>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null)
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
    if (status === "loading") return
    if (!session) router.replace("/login")
  }, [session, status, router])

  useEffect(() => {
    if (session) {
      loadGalleryImages()
    }
  }, [session])

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

  const stopImpersonation = () => {
    localStorage.removeItem('impersonationData')
    setIsImpersonating(false)
    setImpersonationData(null)
    router.push('/manage-users')
  }

  // Fetch admin accounts for switch/add account dropdown
  useEffect(() => {
    const headers: HeadersInit = {}
    if (isImpersonating && impersonationData?.impersonatedUserId) {
      headers['x-impersonation'] = 'true'
      headers['x-impersonated-user-id'] = String(impersonationData.impersonatedUserId)
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

  const loadGalleryImages = async () => {
    try {
      setLoading(true)
      const headers: HeadersInit = {}
      if (isImpersonating && impersonationData?.impersonatedUserId) {
        headers['x-impersonated-user-id'] = String(impersonationData.impersonatedUserId)
      }
      const response = await fetch('/api/gallery/images', { headers })
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setImages(data.images)
        } else {
          setError('Failed to load gallery images')
        }
      } else {
        setError('Failed to load gallery images')
      }
    } catch (error) {
      console.error('Error loading gallery images:', error)
      setError('Error loading gallery images')
    } finally {
      setLoading(false)
    }
  }

  const getTotalImages = () => {
    return Object.values(images).reduce((total, platformImages) => total + platformImages.length, 0)
  }

  const getPlatformDisplayName = (platform: string) => {
    switch (platform) {
      case 'facebook': return 'Facebook'
      case 'instagram': return 'Instagram'
      case 'linkedin': return 'LinkedIn'
      case 'googleads': return 'Google Ads'
      default: return platform.charAt(0).toUpperCase() + platform.slice(1)
    }
  }

  const getPlatformColor = (platform: string) => {
    switch (platform) {
      case 'facebook': return 'bg-blue-600'
      case 'instagram': return 'bg-pink-600'
      case 'linkedin': return 'bg-blue-700'
      case 'googleads': return 'bg-green-600'
      default: return 'bg-gray-600'
    }
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-900 text-xl">Loading...</p>
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <>
      <Head>
        <title>Gallery - Vierra</title>
        <meta name="description" content="View your generated ad images" />
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
                className="flex items-center w-full p-3 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
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
                className="flex items-center w-full p-3 rounded-lg text-white bg-white/10 transition-colors"
              >
                <FiImage className="w-5 h-5" />
                <span className="ml-3 text-sm font-medium">Gallery</span>
              </button>
              <button
                onClick={() => router.push("/campaigns")}
                className="flex items-center w-full p-3 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              >
                <FiTarget className="w-5 h-5" />
                <span className="ml-3 text-sm font-medium">Campaigns</span>
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col">
          {/* Top Header */}
          <div className="bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => router.push("/create-ads")}
                  className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
                >
                  <FiArrowLeft className="w-5 h-5 mr-2" />
                  Back to Create Ads
                </button>
              </div>
              <div className="flex items-center space-x-4">
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
                        {isImpersonating && impersonationData?.impersonatedUserName
                          ? impersonationData.impersonatedUserName
                          : (session?.user?.name || session?.user?.email || 'User')}
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
          </div>

          {/* Page Content */}
          <div className="flex-1 p-6 bg-white">
            <div className="max-w-7xl mx-auto">
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Image Gallery</h1>
                <p className="text-gray-600">
                  View all your generated ad images organized by platform
                </p>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-gray-600">Loading gallery images...</div>
                </div>
              ) : error ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-red-600">{error}</div>
                </div>
              ) : getTotalImages() === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <FiImage className="w-16 h-16 text-gray-300 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No images yet</h3>
                  <p className="text-gray-600 mb-6">Generate some ad images to see them here</p>
                  <button
                    onClick={() => router.push("/create-ads")}
                    className="bg-[#2E0A4F] hover:bg-[#3A1A5F] text-white px-6 py-3 rounded-lg transition-colors"
                  >
                    Create Ads
                  </button>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Platform filter */}
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => setSelectedPlatform(null)}
                      className={`px-4 py-2 rounded-lg transition-colors ${
                        selectedPlatform === null
                          ? 'bg-[#2E0A4F] text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      All ({getTotalImages()})
                    </button>
                    {Object.keys(images).map((platform) => (
                      <button
                        key={platform}
                        onClick={() => setSelectedPlatform(platform)}
                        className={`px-4 py-2 rounded-lg transition-colors ${
                          selectedPlatform === platform
                            ? 'bg-[#2E0A4F] text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {getPlatformDisplayName(platform)} ({images[platform].length})
                      </button>
                    ))}
                  </div>

                  {/* Images grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {Object.entries(images).map(([platform, platformImages]) => {
                      if (selectedPlatform && selectedPlatform !== platform) return null
                      
                      return platformImages.map((image) => (
                        <div
                          key={image.id}
                          className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
                        >
                          <div className="aspect-square relative">
                            <img
                              src={`data:image/png;base64,${image.content}`}
                              alt={`Generated ${platform} ad`}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute top-2 left-2">
                              <span className={`px-2 py-1 rounded text-xs font-medium text-white ${getPlatformColor(platform)}`}>
                                {getPlatformDisplayName(platform)}
                              </span>
                            </div>
                          </div>
                          <div className="p-4">
                            <div className="text-sm text-gray-600">
                              {new Date(image.createdAt).toLocaleDateString()}
                            </div>
                            {image.urlLink && (
                              <a
                                href={image.urlLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#2E0A4F] hover:text-[#3A1A5F] text-sm mt-1 block"
                              >
                                View Shareable Link
                              </a>
                            )}
                          </div>
                        </div>
                      ))
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
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
}

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions)
  
  if (!session) {
    return {
      redirect: {
        destination: "/login",
        permanent: false,
      },
    }
  }

  return {
    props: {
      dashboardHref: process.env.NEXTAUTH_URL || "http://localhost:3000",
    },
  }
}
