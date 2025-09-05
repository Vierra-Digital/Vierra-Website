import React, { useState, useEffect } from "react"
import Head from "next/head"
import { Inter } from "next/font/google"
import Image from "next/image"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { FiLogOut, FiFileText, FiUsers, FiPlus, FiCheck, FiLink, FiImage, FiArrowLeft, FiChevronDown, FiTarget, FiTrendingUp, FiCalendar, FiDollarSign, FiX } from "react-icons/fi"
import { useSession, signOut, signIn } from "next-auth/react"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/pages/api/auth/[...nextauth]"
import type { GetServerSideProps } from "next"

const inter = Inter({ subsets: ["latin"] })

type Campaign = {
  id: string;
  campaignId: string;
  name: string;
  platform: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
  budget: number;
  spent: number;
  impressions: number;
  clicks: number;
  conversions: number;
  startDate: string | null;
  endDate?: string | null;
  createdAt: string;
  originalCampaignName: string;
  caption: string;
  imageData: string;
}

type PageProps = { dashboardHref: string }

export default function CampaignsPage({ dashboardHref }: PageProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null)
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
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [showImageModal, setShowImageModal] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
  const [showCampaignModal, setShowCampaignModal] = useState(false)
  const [editingCaption, setEditingCaption] = useState(false)
  const [editingBudget, setEditingBudget] = useState(false)
  const [tempCaption, setTempCaption] = useState('')
  const [tempBudget, setTempBudget] = useState<number | ''>('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (status === "loading") return
    if (!session) router.replace("/login")
  }, [session, status, router])

  useEffect(() => {
    if (session) {
      loadCampaigns()
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

  const loadCampaigns = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/campaigns')
      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          setCampaigns(data.campaigns)
        } else {
          setError('Failed to load campaigns')
        }
      } else {
        setError('Failed to load campaigns')
      }
    } catch (error) {
      console.error('Error loading campaigns:', error)
      setError('Error loading campaigns')
    } finally {
      setLoading(false)
    }
  }

  const getTotalCampaigns = () => {
    return campaigns.length
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'paused': return 'bg-yellow-100 text-yellow-800'
      case 'completed': return 'bg-gray-100 text-gray-800'
      case 'draft': return 'bg-blue-100 text-blue-800'
      case 'cancelled': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const handleImageClick = (imageUrl: string) => {
    setSelectedImage(imageUrl)
    setShowImageModal(true)
  }

  const closeImageModal = () => {
    setSelectedImage(null)
    setShowImageModal(false)
  }

  const handleCampaignClick = async (campaign: Campaign) => {
    setSelectedCampaign(campaign)
    setTempBudget(campaign.budget)
    setTempCaption(campaign.caption || '')
    setShowCampaignModal(true)
    
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden'
  }

  const closeCampaignModal = () => {
    setSelectedCampaign(null)
    setShowCampaignModal(false)
    setEditingCaption(false)
    setEditingBudget(false)
    setTempCaption('')
    setTempBudget('')
    setShowDeleteConfirm(false)
    
    // Restore body scroll
    document.body.style.overflow = 'unset'
  }

  const handleDeactivateCampaign = async () => {
    if (!selectedCampaign) return
    
    setIsUpdating(true)
    try {
      const response = await fetch('/api/update-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: selectedCampaign.campaignId,
          status: 'paused',
          userId: session?.user?.id
        })
      })
      
      if (response.ok) {
        loadCampaigns() // Refresh the campaigns
        closeCampaignModal()
      }
    } catch (error) {
      console.error('Error deactivating campaign:', error)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleUpdateBudget = async () => {
    if (!selectedCampaign || !tempBudget) return
    
    setIsUpdating(true)
    try {
      const response = await fetch('/api/update-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: selectedCampaign.campaignId,
          budget: Number(tempBudget),
          userId: session?.user?.id
        })
      })
      
      if (response.ok) {
        loadCampaigns()
        setEditingBudget(false)
      }
    } catch (error) {
      console.error('Error updating budget:', error)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleUpdateCaption = async () => {
    if (!selectedCampaign) return
    
    setIsUpdating(true)
    try {
      const response = await fetch('/api/save-campaign-caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: selectedCampaign.campaignId,
          platform: selectedCampaign.platform,
          caption: tempCaption.trim(),
          userId: session?.user?.id
        })
      })
      
      if (response.ok) {
        setEditingCaption(false)
      }
    } catch (error) {
      console.error('Error updating caption:', error)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleRegenerateImage = async () => {
    if (!selectedCampaign) return
    
    setIsRegenerating(true)
    try {
      const response = await fetch('/api/regenerate-content', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: selectedCampaign.platform,
          campaignName: selectedCampaign.originalCampaignName,
          userId: session?.user?.id
        })
      })
      
      if (response.ok) {
        // Refresh the image by adding a timestamp to break cache
        setSelectedImage(`/generated-content/${selectedCampaign.platform}-image-latest.png?t=${Date.now()}`)
      }
    } catch (error) {
      console.error('Error regenerating image:', error)
    } finally {
      setIsRegenerating(false)
    }
  }

  const handleDeleteCampaign = async () => {
    if (!selectedCampaign) return
    
    setIsDeleting(true)
    try {
      const response = await fetch('/api/delete-campaign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId: selectedCampaign.campaignId,
          userId: session?.user?.id
        })
      })
      
      if (response.ok) {
        loadCampaigns() // Refresh the campaigns list
        closeCampaignModal()
      } else {
        console.error('Failed to delete campaign')
      }
    } catch (error) {
      console.error('Error deleting campaign:', error)
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  const getFilteredCampaigns = () => {
    if (!selectedStatus) return campaigns
    return campaigns.filter(campaign => campaign.status === selectedStatus)
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
        <title>Campaign Management - Vierra</title>
        <meta name="description" content="Manage your advertising campaigns" />
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
                className="flex items-center w-full p-3 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
              >
                <FiImage className="w-5 h-5" />
                <span className="ml-3 text-sm font-medium">Gallery</span>
              </button>
              <button
                onClick={() => router.push("/campaigns")}
                className="flex items-center w-full p-3 rounded-lg text-white bg-white/10 transition-colors"
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
                <h1 className="text-2xl font-bold text-gray-900">Campaign Management</h1>
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
                            onClick={handleAddAccount}
                            className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-3"
                          >
                            <FiPlus className="w-4 h-4 text-gray-500" />
                            <span>Add Account</span>
                          </button>

                          <button
                            onClick={() => { signOut({ callbackUrl: '/login' }); setShowUserDropdown(false) }}
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
          </div>

          {/* Page Content */}
          <div className="flex-1 p-6 bg-white">
            <div className="max-w-7xl mx-auto">
              <div className="mb-8">
                <p className="text-gray-600">
                  Monitor and manage your advertising campaigns across all platforms
                </p>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-gray-600">Loading campaigns...</div>
                </div>
              ) : error ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-red-600">{error}</div>
                </div>
              ) : getTotalCampaigns() === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <FiTarget className="w-16 h-16 text-gray-300 mb-4" />
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No campaigns yet</h3>
                  <p className="text-gray-600 mb-6">Create your first campaign to get started</p>
                  <button
                    onClick={() => router.push("/create-ads")}
                    className="bg-[#2E0A4F] hover:bg-[#3A1A5F] text-white px-6 py-3 rounded-lg transition-colors"
                  >
                    Create Campaign
                  </button>
                </div>
              ) : (
                <div className="space-y-8">
                  {/* Status filter */}
                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => setSelectedStatus(null)}
                      className={`px-4 py-2 rounded-lg transition-colors ${
                        selectedStatus === null
                          ? 'bg-[#2E0A4F] text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      All ({getTotalCampaigns()})
                    </button>
                    <button
                      onClick={() => setSelectedStatus('active')}
                      className={`px-4 py-2 rounded-lg transition-colors ${
                        selectedStatus === 'active'
                          ? 'bg-[#2E0A4F] text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Active ({campaigns.filter(c => c.status === 'active').length})
                    </button>
                    <button
                      onClick={() => setSelectedStatus('paused')}
                      className={`px-4 py-2 rounded-lg transition-colors ${
                        selectedStatus === 'paused'
                          ? 'bg-[#2E0A4F] text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Paused ({campaigns.filter(c => c.status === 'paused').length})
                    </button>
                    <button
                      onClick={() => setSelectedStatus('completed')}
                      className={`px-4 py-2 rounded-lg transition-colors ${
                        selectedStatus === 'completed'
                          ? 'bg-[#2E0A4F] text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Completed ({campaigns.filter(c => c.status === 'completed').length})
                    </button>
                    <button
                      onClick={() => setSelectedStatus('draft')}
                      className={`px-4 py-2 rounded-lg transition-colors ${
                        selectedStatus === 'draft'
                          ? 'bg-[#2E0A4F] text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      Draft ({campaigns.filter(c => c.status === 'draft').length})
                    </button>
                  </div>

                  {/* Campaigns grid */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                    {getFilteredCampaigns().map((campaign) => (
                      <div
                        key={campaign.id}
                        className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
                      >
                        {/* Campaign Image Preview */}
                        <div className="aspect-video relative bg-gray-100 overflow-hidden">
                          {campaign.imageData ? (
                            // Show the actual saved image
                            <img
                              src={`data:image/png;base64,${campaign.imageData}`}
                              alt={`${campaign.name} preview`}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            // Show placeholder when no image is available
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                              <div className="text-center">
                                <FiImage className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                                <p className="text-sm text-gray-500">Generated Content Preview</p>
                                <p className="text-xs text-gray-400 mt-1">Click to view full size</p>
                              </div>
                            </div>
                          )}
                          
                          {/* Overlay for click interaction */}
                          <div 
                            className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-10 transition-all cursor-pointer"
                            onClick={() => handleCampaignClick(campaign)}
                          />
                        </div>

                        <div className="p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                                {campaign.name}
                              </h3>
                              <div className="flex items-center space-x-2">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${getPlatformColor(campaign.platform)} text-white`}>
                                  {getPlatformDisplayName(campaign.platform)}
                                </span>
                                <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(campaign.status)}`}>
                                  {campaign.status}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-3">
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">Budget</span>
                              <span className="text-sm font-medium text-gray-900">
                                ${campaign.budget.toLocaleString()}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">Spent</span>
                              <span className="text-sm font-medium text-gray-900">
                                ${campaign.spent.toLocaleString()}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">Impressions</span>
                              <span className="text-sm font-medium text-gray-900">
                                {campaign.impressions.toLocaleString()}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">Clicks</span>
                              <span className="text-sm font-medium text-gray-900">
                                {campaign.clicks.toLocaleString()}
                              </span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-sm text-gray-600">Conversions</span>
                              <span className="text-sm font-medium text-gray-900">
                                {campaign.conversions}
                              </span>
                            </div>
                          </div>

                          <div className="mt-4 pt-4 border-t border-gray-100">
                            <div className="flex items-center justify-between text-xs text-gray-500">
                              <span>
                                {campaign.startDate 
                                  ? `Started ${new Date(campaign.startDate).toLocaleDateString()}`
                                  : 'Not started'
                                }
                              </span>
                              {campaign.endDate && (
                                <span>Ended {new Date(campaign.endDate).toLocaleDateString()}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
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

      {/* Campaign Management Modal */}
      {showCampaignModal && selectedCampaign && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className="relative bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden">
            <button
              onClick={closeCampaignModal}
              className="absolute top-4 right-4 text-gray-500 hover:text-gray-700 z-10"
            >
              <FiX className="w-6 h-6" />
            </button>
            
            <div className="p-6 max-h-[90vh] overflow-y-auto">
              {/* Campaign Header */}
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">{selectedCampaign.name}</h2>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getPlatformColor(selectedCampaign.platform)} text-white`}>
                    {getPlatformDisplayName(selectedCampaign.platform)}
                  </span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(selectedCampaign.status)}`}>
                    {selectedCampaign.status}
                  </span>
                </div>
              </div>

              {/* Campaign Image */}
              <div className="mb-6">
                <div className="aspect-video bg-gray-100 rounded-lg overflow-hidden relative">
                  {selectedCampaign.imageData ? (
                    <img
                      src={`data:image/png;base64,${selectedCampaign.imageData}`}
                      alt={selectedCampaign.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                      <div className="text-center">
                        <FiImage className="w-16 h-16 text-gray-300 mx-auto mb-2" />
                        <p className="text-gray-500">Generated Content Preview</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Caption Section */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">Caption</h3>
                  <button
                    onClick={() => setEditingCaption(!editingCaption)}
                    className="text-[#2E0A4F] hover:text-[#3A1A5F] text-sm"
                  >
                    {editingCaption ? 'Cancel' : 'Edit'}
                  </button>
                </div>
                {editingCaption ? (
                  <div className="space-y-3">
                    <textarea
                      value={tempCaption}
                      onChange={(e) => setTempCaption(e.target.value)}
                      placeholder="Enter campaign caption..."
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2E0A4F] focus:border-transparent resize-none"
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleUpdateCaption}
                        disabled={isUpdating}
                        className="bg-[#2E0A4F] hover:bg-[#3A1A5F] text-white px-4 py-2 rounded-lg text-sm disabled:opacity-60"
                      >
                        {isUpdating ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditingCaption(false)}
                        className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-lg text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-gray-700">
                      {tempCaption || 'No caption available. Click Edit to add one.'}
                    </p>
                  </div>
                )}
              </div>

              {/* Budget Section */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">Budget</h3>
                  <button
                    onClick={() => setEditingBudget(!editingBudget)}
                    className="text-[#2E0A4F] hover:text-[#3A1A5F] text-sm"
                  >
                    {editingBudget ? 'Cancel' : 'Edit'}
                  </button>
                </div>
                {editingBudget ? (
                  <div className="space-y-3">
                    <input
                      type="number"
                      value={tempBudget}
                      onChange={(e) => setTempBudget(e.target.value ? Number(e.target.value) : '')}
                      placeholder="Enter budget amount"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#2E0A4F] focus:border-transparent"
                      min="0"
                      step="0.01"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={handleUpdateBudget}
                        disabled={isUpdating}
                        className="bg-[#2E0A4F] hover:bg-[#3A1A5F] text-white px-4 py-2 rounded-lg text-sm disabled:opacity-60"
                      >
                        {isUpdating ? 'Saving...' : 'Save'}
                      </button>
                      <button
                        onClick={() => setEditingBudget(false)}
                        className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-4 py-2 rounded-lg text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-gray-700 text-lg font-medium">
                      ${selectedCampaign.budget.toLocaleString()}
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleRegenerateImage}
                  disabled={isRegenerating}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-60"
                >
                  <FiImage className="w-4 h-4" />
                  {isRegenerating ? 'Regenerating...' : 'Regenerate Image'}
                </button>
                
                {selectedCampaign.status === 'active' && (
                  <button
                    onClick={handleDeactivateCampaign}
                    disabled={isUpdating}
                    className="flex items-center gap-2 bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-60"
                  >
                    <FiTarget className="w-4 h-4" />
                    {isUpdating ? 'Deactivating...' : 'Deactivate Campaign'}
                  </button>
                )}

                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isDeleting}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm disabled:opacity-60"
                >
                  <FiX className="w-4 h-4" />
                  Delete Campaign
                </button>
              </div>

              {/* Delete Confirmation */}
              {showDeleteConfirm && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <FiX className="w-5 h-5 text-red-400" />
                    </div>
                    <div className="ml-3 w-0 flex-1">
                      <h3 className="text-sm font-medium text-red-800">
                        Delete Campaign
                      </h3>
                      <div className="mt-2 text-sm text-red-700">
                        <p>
                          Are you sure you want to delete "{selectedCampaign.name}"? This action cannot be undone and will remove all campaign data including captions and metrics.
                        </p>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <button
                          onClick={handleDeleteCampaign}
                          disabled={isDeleting}
                          className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-sm disabled:opacity-60"
                        >
                          {isDeleting ? 'Deleting...' : 'Yes, Delete'}
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(false)}
                          className="bg-gray-300 hover:bg-gray-400 text-gray-700 px-3 py-1 rounded text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Simple Image Modal (kept for backward compatibility) */}
      {showImageModal && selectedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="relative max-w-4xl max-h-[90vh] w-full h-full flex items-center justify-center p-4">
            <button
              onClick={closeImageModal}
              className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
            >
              <FiX className="w-8 h-8" />
            </button>
            <img
              src={selectedImage}
              alt="Campaign Preview"
              className="max-w-full max-h-full object-contain rounded-lg"
              onError={(e) => {
                // Show fallback when image fails to load
                e.currentTarget.style.display = 'none';
                const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = 'flex';
              }}
              onLoad={(e) => {
                // Hide fallback when image loads successfully
                const fallback = e.currentTarget.nextElementSibling as HTMLElement;
                if (fallback) fallback.style.display = 'none';
              }}
            />
            {/* Fallback content when image fails to load */}
            <div className="absolute inset-0 flex items-center justify-center" style={{ display: 'none' }}>
              <div className="text-center text-white">
                <FiImage className="w-24 h-24 mx-auto mb-4 text-gray-400" />
                <p className="text-lg">Generated content preview</p>
                <p className="text-sm text-gray-300 mt-2">Image will appear here when campaign content is generated</p>
              </div>
            </div>
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
