import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { FiUsers, FiLogOut, FiFileText, FiPlus, FiUserCheck, FiChevronDown, FiChevronLeft, FiChevronRight, FiEye, FiEyeOff, FiArrowLeft } from "react-icons/fi"
import { FiUsers, FiLogOut, FiFileText, FiPlus, FiUserCheck, FiChevronDown, FiChevronLeft, FiChevronRight, FiEye, FiEyeOff, FiArrowLeft } from "react-icons/fi"
import Image from "next/image"
import Link from "next/link"
import { Inter, Bricolage_Grotesque } from "next/font/google"
import { signOut, useSession, signIn } from "next-auth/react"
import { Inter, Bricolage_Grotesque } from "next/font/google"
import { signOut, useSession, signIn } from "next-auth/react"
import type { GetServerSideProps } from "next"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/pages/api/auth/[...nextauth]"

const inter = Inter({ subsets: ["latin"] })
const bricolage = Bricolage_Grotesque({ subsets: ["latin"] })
const bricolage = Bricolage_Grotesque({ subsets: ["latin"] })

type PageProps = { dashboardHref: string }

export default function ManageUsersPage({ dashboardHref }: PageProps) {
  type CompletedUser = {
    id: string
    email: string
    password: string
    client?: { 
      name: string | null
      businessName: string | null
      email: string | null
    }
    surveyAnswers: any
    surveyDate: string | null
    client?: { 
      name: string | null
      businessName: string | null
      email: string | null
    }
    surveyAnswers: any
    surveyDate: string | null
  }
  const router = useRouter()
  const { data: session } = useSession()
  const { data: session } = useSession()
  const [users, setUsers] = useState<CompletedUser[]>([])
  const [selected, setSelected] = useState<CompletedUser | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [entriesPerPage] = useState(10)
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
  const [clientStatuses, setClientStatuses] = useState<{[key: string]: boolean}>({})
  const [showLTVModal, setShowLTVModal] = useState(false)
  const [showPDFModal, setShowPDFModal] = useState(false)
  
  // LTV Calculator state
  const [ltvValues, setLTVValues] = useState({
    averagePurchaseValue: 0,
    costOfGoodsPercentage: 0,
    returnsPerYear: 0,
    customerTermYears: 0,
    numberOfReferrals: 0,
    numberOfClientsBroughtIn: 0
  })
  const [lifetimeValue, setLifetimeValue] = useState(0)
  const [currentPage, setCurrentPage] = useState(1)
  const [entriesPerPage] = useState(10)
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
  const [clientStatuses, setClientStatuses] = useState<{[key: string]: boolean}>({})
  const [showLTVModal, setShowLTVModal] = useState(false)
  const [showPDFModal, setShowPDFModal] = useState(false)
  
  // LTV Calculator state
  const [ltvValues, setLTVValues] = useState({
    averagePurchaseValue: 0,
    costOfGoodsPercentage: 0,
    returnsPerYear: 0,
    customerTermYears: 0,
    numberOfReferrals: 0,
    numberOfClientsBroughtIn: 0
  })
  const [lifetimeValue, setLifetimeValue] = useState(0)

  useEffect(() => {
    fetch("/api/admin/completed-users")
      .then((res) => res.json())
      .then((data) => {
        setUsers(data)
        // Initialize client statuses (default to active for new clients)
        const statuses: {[key: string]: boolean} = {}
        data.forEach((user: any, index: number) => {
          statuses[user.id] = index % 2 !== 0 // Even index = inactive, odd index = active
        })
        setClientStatuses(statuses)
      })
    
    // Fetch admin accounts
    fetch("/api/admin/accounts")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setAdminAccounts(data.accounts)
        }
      })
      .catch(error => {
        console.error('Error fetching admin accounts:', error)
        // Initialize client statuses (default to active for new clients)
        const statuses: {[key: string]: boolean} = {}
        data.forEach((user: any, index: number) => {
          statuses[user.id] = index % 2 !== 0 // Even index = inactive, odd index = active
        })
        setClientStatuses(statuses)
      })
    
    // Fetch admin accounts
    fetch("/api/admin/accounts")
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setAdminAccounts(data.accounts)
        }
      })
      .catch(error => {
        console.error('Error fetching admin accounts:', error)
      })
  }, [])

  const impersonateUser = async (userId: string) => {
    try {
      const response = await fetch('/api/admin/impersonate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId }),
      })

      if (response.ok) {
        const data = await response.json()
        if (data.success) {
          // Store impersonation data in localStorage for the client page to use
          localStorage.setItem('impersonationData', JSON.stringify({
            originalAdminId: data.impersonationData?.originalAdminId,
            originalAdminEmail: data.impersonationData?.originalAdminEmail,
            impersonatedUserId: data.impersonationData?.impersonatedUserId,
            impersonatedUserName: data.impersonationData?.impersonatedUserName,
            token: data.impersonationToken
          }))
          
          // Redirect to client view as the impersonated user
          router.push('/client')
        }
      } else {
        console.error('Failed to impersonate user')
      }
    } catch (error) {
      console.error('Error impersonating user:', error)
    }
  }

  // Pagination
  const totalPages = Math.ceil(users.length / entriesPerPage)
  const startIndex = (currentPage - 1) * entriesPerPage
  const endIndex = startIndex + entriesPerPage
  const currentUsers = users.slice(startIndex, endIndex)

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase()
  }

  const getStatusColor = (userId: string) => {
    const isActive = clientStatuses[userId]
    return isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
  }

  const getStatusText = (userId: string) => {
    const isActive = clientStatuses[userId]
    return isActive ? 'Active' : 'Inactive'
  }

  // Helper functions to extract data from survey answers
  const getSurveyValue = (answers: any, key: string) => {
    if (!answers || typeof answers !== 'object') return 'N/A'
    return answers[key] || 'N/A'
  }

  // Q1: "What is the name of your Business?"
  const getBusinessName = (answers: any) => {
    return getSurveyValue(answers, 'Q1')
  }

  // Q2: "What's your company website or main online presence?"
  const getWebsite = (answers: any) => {
    return getSurveyValue(answers, 'Q2')
  }

  // Q3: "What is the primary business sector of your organization (e.g., accounting, industrial, etc.)?"
  const getBusinessSector = (answers: any) => {
    return getSurveyValue(answers, 'Q3')
  }

  // Q6: "What is your business phone number?"
  const getPhoneNumber = (answers: any) => {
    return getSurveyValue(answers, 'Q6')
  }

  const handleAddClient = () => {
    // Generate a new client session and redirect to onboarding
    fetch('/api/session/generateClientSession', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    .then(res => res.json())
    .then(data => {
      if (data.success && data.sessionToken) {
        // Show success message
        alert('New client onboarding session created! Opening in new tab...')
        // Redirect to the onboarding session
        window.open(`/session/${data.sessionToken}`, '_blank')
        
        // Refresh the users list to show the new client
        setTimeout(() => {
          fetch("/api/admin/completed-users")
            .then((res) => res.json())
            .then((data) => {
              setUsers(data)
              // Update statuses for new users
              const statuses: {[key: string]: boolean} = {}
              data.forEach((user: any, index: number) => {
                statuses[user.id] = index % 2 !== 0
              })
              setClientStatuses(statuses)
            })
        }, 2000) // Wait 2 seconds for the client to complete onboarding
      } else {
        alert('Error creating client session: ' + (data.error || 'Unknown error'))
      }
    })
    .catch(error => {
      console.error('Error creating client session:', error)
      alert('Error creating client session. Please try again.')
    })
  }

  const handleAddAccount = () => {
    setIsLoginMode(false) // Set to create account mode
    setShowLoginModal(true)
    setShowUserDropdown(false)
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
          role: newAccountRole 
        })
      })

      const data = await response.json()

      if (data.success) {
        // Show success modal with account details
        setCreatedAccount({
          email: newAccountEmail,
          name: newAccountName,
          role: newAccountRole,
          password: data.password
        })
        setShowSuccessModal(true)
        setShowLoginModal(false)
        
        // Reset form
        setNewAccountEmail("")
        setNewAccountName("")
        setNewAccountRole("user")
        
        // Refresh admin accounts
        fetch("/api/admin/accounts")
          .then((res) => res.json())
          .then((data) => {
            if (data.success) {
              setAdminAccounts(data.accounts)
            }
          })
      } else {
        setAddAccountError(data.error || 'Error creating account')
      }
    } catch (error) {
      console.error('Error creating account:', error)
      setAddAccountError('Error creating account')
    } finally {
      setIsCreatingAccount(false)
    }
  }


  const handleSwitchAccount = async (account: any) => {
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' }
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

  const handleCloseLoginModal = () => {
    setShowLoginModal(false)
    setSelectedAccount(null)
    setLoginEmail("")
    setLoginPassword("")
    setLoginError("")
    setShowPassword(false)
    setIsLoginMode(true)
  }

  const handleToggleMode = () => {
    setIsLoginMode(!isLoginMode)
    setLoginError("")
    setAddAccountError("")
    // Clear form fields when switching modes
    if (!isLoginMode) {
      setLoginEmail("")
      setLoginPassword("")
    } else {
      setNewAccountEmail("")
      setNewAccountName("")
      setNewAccountRole("user")
    }
  }

  const handleLogout = () => {
    signOut({ callbackUrl: '/login' })
  }

  const handleToggleClientStatus = async (userId: string) => {
    const currentStatus = clientStatuses[userId]
    const newStatus = !currentStatus

    try {
      const response = await fetch('/api/admin/toggle-client-status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, isActive: newStatus })
      })

      const data = await response.json()

      if (data.success) {
        // Update local state
        setClientStatuses(prev => ({
          ...prev,
          [userId]: newStatus
        }))
      } else {
        alert('Error updating client status: ' + data.error)
      }
    } catch (error) {
      console.error('Error toggling client status:', error)
      alert('Error updating client status')
    }
  }

  const handleClientClick = (user: CompletedUser) => {
    // Show impersonation modal
    setSelected(user)
  }

  // LTV Calculator functions
  const calculateLTV = () => {
    const { averagePurchaseValue, costOfGoodsPercentage, returnsPerYear, customerTermYears, numberOfReferrals, numberOfClientsBroughtIn } = ltvValues
    
    // Basic LTV calculation: (Average Purchase Value - COGS) * Returns Per Year * Customer Term
    const grossMargin = averagePurchaseValue * (1 - costOfGoodsPercentage / 100)
    const baseLTV = grossMargin * returnsPerYear * customerTermYears
    
    // Add referral value (simplified calculation)
    const referralValue = numberOfReferrals * numberOfClientsBroughtIn * grossMargin * 0.1 // 10% of gross margin per referral
    
    const totalLTV = baseLTV + referralValue
    setLifetimeValue(totalLTV)
  }

  const handleLTVInputChange = (field: string, value: number) => {
    setLTVValues(prev => ({
      ...prev,
      [field]: value
    }))
  }

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
  }, [showUserDropdown])

  return (
    <div className="min-h-screen bg-gray-100 flex">
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <div className="w-64 bg-[#2E0A4F] h-screen flex flex-col">
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
      <div className="w-64 bg-[#2E0A4F] h-screen flex flex-col">
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
         <nav className="flex-1 px-4">
           <div className="space-y-2">
             <button
               onClick={() => setShowPDFModal(true)}
               className="flex items-center w-full p-3 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
             >
               <FiFileText className="w-5 h-5" />
               <span className="ml-3 text-sm font-medium">PDF Signer</span>
             </button>

             <button
               onClick={() => setShowLTVModal(true)}
               className="flex items-center w-full p-3 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
             >
               <span className="w-5 h-5 flex items-center justify-center font-bold text-lg">Σ</span>
               <span className="ml-3 text-sm font-medium">LTV Calculator</span>
             </button>

             <button
               onClick={() => router.push("/panel")}
               className="flex items-center w-full p-3 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
             >
               <FiUsers className="w-5 h-5" />
               <span className="ml-3 text-sm font-medium">Add Clients</span>
             </button>

             <button
               onClick={() => router.push("/manage-users")}
               className="flex items-center w-full p-3 rounded-lg text-white bg-white/10 transition-colors"
             >
               <FiUsers className="w-5 h-5" />
               <span className="ml-3 text-sm font-medium">Manage Users</span>
             </button>

             <button
               onClick={() => router.push("/create-ads")}
               className="flex items-center w-full p-3 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
             >
               <FiPlus className="w-5 h-5" />
               <span className="ml-3 text-sm font-medium">Create Ads</span>
             </button>
           </div>
         </nav>
                 {/* Navigation */}
         <nav className="flex-1 px-4">
           <div className="space-y-2">
             <button
               onClick={() => setShowPDFModal(true)}
               className="flex items-center w-full p-3 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
             >
               <FiFileText className="w-5 h-5" />
               <span className="ml-3 text-sm font-medium">PDF Signer</span>
             </button>

             <button
               onClick={() => setShowLTVModal(true)}
               className="flex items-center w-full p-3 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
             >
               <span className="w-5 h-5 flex items-center justify-center font-bold text-lg">Σ</span>
               <span className="ml-3 text-sm font-medium">LTV Calculator</span>
             </button>

             <button
               onClick={() => router.push("/panel")}
               className="flex items-center w-full p-3 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
             >
               <FiUsers className="w-5 h-5" />
               <span className="ml-3 text-sm font-medium">Add Clients</span>
             </button>

             <button
               onClick={() => router.push("/manage-users")}
               className="flex items-center w-full p-3 rounded-lg text-white bg-white/10 transition-colors"
             >
               <FiUsers className="w-5 h-5" />
               <span className="ml-3 text-sm font-medium">Manage Users</span>
             </button>

             <button
               onClick={() => router.push("/create-ads")}
               className="flex items-center w-full p-3 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
             >
               <FiPlus className="w-5 h-5" />
               <span className="ml-3 text-sm font-medium">Create Ads</span>
             </button>
           </div>
         </nav>
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
                    onClick={() => {
                      handleLogout()
                      setShowUserDropdown(false)
                    }}
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
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Clients</h1>
            <p className="text-gray-600 mt-1">All Clients</p>
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-end mb-6">
            <button 
              onClick={handleAddClient}
              className="flex items-center px-4 py-2 bg-[#2E0A4F] text-white rounded-lg hover:bg-[#3A1A5F] transition-colors"
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
                    onClick={() => {
                      handleLogout()
                      setShowUserDropdown(false)
                    }}
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
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Clients</h1>
            <p className="text-gray-600 mt-1">All Clients</p>
          </div>

          {/* Action Bar */}
          <div className="flex items-center justify-end mb-6">
            <button 
              onClick={handleAddClient}
              className="flex items-center px-4 py-2 bg-[#2E0A4F] text-white rounded-lg hover:bg-[#3A1A5F] transition-colors"
            >
              <FiPlus className="w-4 h-4 mr-2" />
              Add Client
              <FiPlus className="w-4 h-4 mr-2" />
              Add Client
            </button>
          </div>

          {/* Table */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Business Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Website</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Business Sector</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone Number</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {currentUsers.map((user, index) => (
                    <tr 
                      key={user.id} 
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleClientClick(user)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center mr-3">
                            <span className="text-sm font-medium text-gray-700">
                              {getInitials(user.client?.name || "U")}
                            </span>
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {user.client?.name || "Unknown User"}
                            </div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {getBusinessName(user.surveyAnswers)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {getWebsite(user.surveyAnswers)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {getBusinessSector(user.surveyAnswers)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {getPhoneNumber(user.surveyAnswers)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(user.id)}`}>
                          {getStatusText(user.id)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-6">
            <div className="text-sm text-gray-700">
              {entriesPerPage} Entries Per Page
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                {currentPage} of {totalPages}
              </span>
              
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FiChevronLeft className="w-4 h-4" />
                </button>
                
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FiChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Impersonation Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Client Actions</h3>
            
            <div className="mb-6">
              <p className="text-xs text-gray-500">Password: <span className="font-mono text-gray-700">{selected.password}</span></p>
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setSelected(null)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleToggleClientStatus(selected.id)
                }}
                className={`flex-1 px-4 py-2 rounded-lg transition-colors flex items-center justify-center ${
                  clientStatuses[selected.id] 
                    ? 'bg-red-500 text-white hover:bg-red-600' 
                    : 'bg-green-500 text-white hover:bg-green-600'
                }`}
              >
                {clientStatuses[selected.id] ? 'Deactivate' : 'Activate'}
              </button>
              <button
                onClick={async () => {
                  await impersonateUser(selected.id)
                  // After API sets cookie, redirect to client
                  setSelected(null)
                  window.location.href = '/client'
                }}
                className="flex-1 px-4 py-2 bg-[#2E0A4F] text-white rounded-lg hover:bg-[#3A1A5F] transition-colors flex items-center justify-center"
              >
                <FiUserCheck className="w-4 h-4 mr-2" />
                Log in as Client
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Login/Create Account Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="relative bg-white/10 backdrop-blur-md rounded-lg p-8 w-[90%] max-w-md shadow-lg">
            {/* Go Back Button */}
            <button
              onClick={handleCloseLoginModal}
              className="absolute top-4 left-4 text-white hover:text-gray-300 transition-colors flex items-center space-x-2"
            >
              <FiArrowLeft className="w-4 h-4" />
              <span className="text-sm">Back</span>
            </button>

            {/* Logo */}
            <div className="flex justify-center mb-6">
              <Image
                src="/assets/vierra-logo.png"
                alt="Vierra Logo"
                width={150}
                height={50}
                className="w-auto h-12"
              />
            </div>

            {/* Mode Toggle Buttons */}
            <div className="flex mb-6 bg-white/10 rounded-lg p-1">
              <button
                onClick={() => setIsLoginMode(true)}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  isLoginMode 
                    ? 'bg-[#701CC0] text-white' 
                    : 'text-white/70 hover:text-white'
                }`}
              >
                Login
              </button>
              <button
                onClick={() => setIsLoginMode(false)}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  !isLoginMode 
                    ? 'bg-[#701CC0] text-white' 
                    : 'text-white/70 hover:text-white'
                }`}
              >
                Create Account
              </button>
            </div>

            {/* Title */}
            <h2 className={`text-2xl font-bold text-white text-center mb-4 ${bricolage.className}`}>
              {isLoginMode ? 'Login to Account' : 'Create New Account'}
            </h2>

            {/* Account Info (only show in login mode when switching) */}
            {isLoginMode && selectedAccount && (
              <div className="mb-6 p-4 bg-white/10 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-white">
                      {getInitials(selectedAccount.email || 'U')}
                    </span>
                  </div>
                  <div>
                    <div className="text-white font-medium">{selectedAccount.email || 'User'}</div>
                    <div className="text-blue-300 text-xs font-medium">{selectedAccount.role}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Login Form */}
            {isLoginMode ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label htmlFor="email" className={`block text-sm font-medium text-white mb-2 ${bricolage.className}`}>
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
                    placeholder="Enter email"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="password" className={`block text-sm font-medium text-white mb-2 ${bricolage.className}`}>
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      id="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full px-4 py-2 pr-10 bg-white/10 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
                      placeholder="Enter password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/70 hover:text-white"
                    >
                      {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {loginError && (
                  <p className="text-red-400 text-sm text-center">{loginError}</p>
                )}

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className={`w-full px-4 py-2 bg-[#701CC0] text-white rounded-md shadow-[0px_4px_15.9px_0px_#701CC061] transform transition-transform duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${inter.className}`}
                >
                  {isLoggingIn ? 'Logging in...' : 'Login'}
                </button>
              </form>
            ) : (
              /* Create Account Form */
              <form onSubmit={handleCreateAccount} className="space-y-4">
                <div>
                  <label htmlFor="newEmail" className={`block text-sm font-medium text-white mb-2 ${bricolage.className}`}>
                    Email
                  </label>
                  <input
                    type="email"
                    id="newEmail"
                    value={newAccountEmail}
                    onChange={(e) => setNewAccountEmail(e.target.value)}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
                    placeholder="Enter email"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="newName" className={`block text-sm font-medium text-white mb-2 ${bricolage.className}`}>
                    Name
                  </label>
                  <input
                    type="text"
                    id="newName"
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
                    placeholder="Enter name"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="newRole" className={`block text-sm font-medium text-white mb-2 ${bricolage.className}`}>
                    Role
                  </label>
                  <select
                    id="newRole"
                    value={newAccountRole}
                    onChange={(e) => setNewAccountRole(e.target.value)}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-white/30"
                  >
                    <option value="user" className="bg-gray-800 text-white">User</option>
                    <option value="admin" className="bg-gray-800 text-white">Admin</option>
                  </select>
                </div>

                {addAccountError && (
                  <p className="text-red-400 text-sm text-center">{addAccountError}</p>
                )}

                <button
                  type="submit"
                  disabled={isCreatingAccount}
                  className={`w-full px-4 py-2 bg-[#701CC0] text-white rounded-md shadow-[0px_4px_15.9px_0px_#701CC061] transform transition-transform duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${inter.className}`}
                >
                  {isCreatingAccount ? 'Creating Account...' : 'Create Account'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}


      {/* Success Modal */}
      {showSuccessModal && createdAccount && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="relative bg-white/10 backdrop-blur-md rounded-lg p-8 w-[90%] max-w-md shadow-lg">
            {/* Close Button */}
            <button
              onClick={() => setShowSuccessModal(false)}
              className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
            >
              <FiPlus className="w-6 h-6 rotate-45" />
            </button>

            {/* Logo */}
            <div className="flex justify-center mb-6">
              <Image
                src="/assets/vierra-logo.png"
                alt="Vierra Logo"
                width={150}
                height={50}
                className="w-auto h-12"
              />
            </div>

            {/* Success Message */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiUserCheck className="w-8 h-8 text-green-400" />
              </div>
              <h2 className={`text-2xl font-bold text-white mb-2 ${bricolage.className}`}>
                Account Created Successfully!
              </h2>
              <p className="text-white/70">
                {createdAccount.role} account has been created
              </p>
            </div>

            {/* Account Details */}
            <div className="bg-white/10 rounded-lg p-4 mb-6">
              <div className="space-y-3">
                <div>
                  <label className="text-white/70 text-sm">Name</label>
                  <p className="text-white font-medium">{createdAccount.name}</p>
                </div>
                <div>
                  <label className="text-white/70 text-sm">Email</label>
                  <p className="text-white font-medium">{createdAccount.email}</p>
                </div>
                <div>
                  <label className="text-white/70 text-sm">Role</label>
                  <p className="text-white font-medium capitalize">{createdAccount.role}</p>
                </div>
                <div>
                  <label className="text-white/70 text-sm">Password</label>
                  <div className="flex items-center space-x-2">
                    <p className="text-white font-medium font-mono bg-white/10 px-2 py-1 rounded">
                      {createdAccount.password}
                    </p>
                    <button
                      onClick={() => navigator.clipboard.writeText(createdAccount.password)}
                      className="text-blue-400 hover:text-blue-300 text-sm"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <button
                onClick={() => setShowSuccessModal(false)}
                className="flex-1 px-4 py-2 border border-white/20 text-white rounded-lg hover:bg-white/10 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowSuccessModal(false)
                  // Auto-fill login form with new account
                  setLoginEmail(createdAccount.email)
                  setShowLoginModal(true)
                }}
                className="flex-1 px-4 py-2 bg-[#701CC0] text-white rounded-lg hover:bg-[#5A0FA0] transition-colors"
              >
                Login Now
              </button>
            </div>
          </div>
        </div>
               )}

       {/* LTV Calculator Modal */}
       {showLTVModal && (
         <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
           <div className="relative bg-[#2E0A4F] rounded-lg p-8 w-[90%] max-w-md shadow-lg">
             {/* Close Button */}
             <button
               onClick={() => setShowLTVModal(false)}
               className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
             >
               <FiPlus className="w-6 h-6 rotate-45" />
             </button>

             {/* Logo */}
             <div className="flex justify-center mb-6">
               <Image
                 src="/assets/vierra-logo.png"
                 alt="Vierra Logo"
                 width={150}
                 height={50}
                 className="w-auto h-12"
               />
             </div>

             {/* Title */}
             <h2 className={`text-2xl font-bold text-white text-center mb-6 ${bricolage.className}`}>
               LTV Calculator
             </h2>

             {/* Input Fields */}
             <div className="space-y-4 mb-6">
               <div>
                 <label className={`block text-sm font-medium text-white mb-2 ${bricolage.className}`}>
                   Average Purchase Value
                 </label>
                 <input
                   type="number"
                   value={ltvValues.averagePurchaseValue}
                   onChange={(e) => handleLTVInputChange('averagePurchaseValue', parseFloat(e.target.value) || 0)}
                   className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
                   placeholder="0"
                 />
               </div>

               <div>
                 <label className={`block text-sm font-medium text-white mb-2 ${bricolage.className}`}>
                   Cost Of Goods/Services Sold (As A Percentage)
                 </label>
                 <input
                   type="number"
                   value={ltvValues.costOfGoodsPercentage}
                   onChange={(e) => handleLTVInputChange('costOfGoodsPercentage', parseFloat(e.target.value) || 0)}
                   className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
                   placeholder="0"
                 />
               </div>

               <div>
                 <label className={`block text-sm font-medium text-white mb-2 ${bricolage.className}`}>
                   Returns Per Year
                 </label>
                 <input
                   type="number"
                   value={ltvValues.returnsPerYear}
                   onChange={(e) => handleLTVInputChange('returnsPerYear', parseFloat(e.target.value) || 0)}
                   className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
                   placeholder="0"
                 />
               </div>

               <div>
                 <label className={`block text-sm font-medium text-white mb-2 ${bricolage.className}`}>
                   Customer Term In Years
                 </label>
                 <input
                   type="number"
                   value={ltvValues.customerTermYears}
                   onChange={(e) => handleLTVInputChange('customerTermYears', parseFloat(e.target.value) || 0)}
                   className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
                   placeholder="0"
                 />
               </div>

               <div>
                 <label className={`block text-sm font-medium text-white mb-2 ${bricolage.className}`}>
                   Number Of Referrals
                 </label>
                 <input
                   type="number"
                   value={ltvValues.numberOfReferrals}
                   onChange={(e) => handleLTVInputChange('numberOfReferrals', parseFloat(e.target.value) || 0)}
                   className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
                   placeholder="0"
                 />
               </div>

               <div>
                 <label className={`block text-sm font-medium text-white mb-2 ${bricolage.className}`}>
                   Number Of Clients Brought In
                 </label>
                 <input
                   type="number"
                   value={ltvValues.numberOfClientsBroughtIn}
                   onChange={(e) => handleLTVInputChange('numberOfClientsBroughtIn', parseFloat(e.target.value) || 0)}
                   className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
                   placeholder="0"
                 />
               </div>
             </div>

             {/* Calculate Button */}
             <button
               onClick={calculateLTV}
               className={`w-full px-4 py-2 bg-[#701CC0] text-white rounded-md shadow-[0px_4px_15.9px_0px_#701CC061] transform transition-transform duration-300 hover:scale-105 ${inter.className} mb-4`}
             >
               Calculate LTV
             </button>

             {/* Result */}
             <div className="text-center">
               <p className="text-white text-lg font-bold">
                 Lifetime Value: ${lifetimeValue.toFixed(2)}
               </p>
             </div>
           </div>
         </div>
       )}

       {/* PDF Signer Modal */}
       {showPDFModal && (
         <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
           <div className="relative bg-[#2E0A4F] rounded-lg p-8 w-[90%] max-w-md shadow-lg">
             {/* Close Button */}
             <button
               onClick={() => setShowPDFModal(false)}
               className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
             >
               <FiPlus className="w-6 h-6 rotate-45" />
             </button>

             {/* Logo */}
             <div className="flex justify-center mb-6">
               <Image
                 src="/assets/vierra-logo.png"
                 alt="Vierra Logo"
                 width={150}
                 height={50}
                 className="w-auto h-12"
               />
             </div>

             {/* Title */}
             <h2 className={`text-2xl font-bold text-white text-center mb-6 ${bricolage.className}`}>
               Preparing The PDF
             </h2>

             {/* Upload Button */}
             <button
               className={`w-full px-4 py-2 bg-[#701CC0] text-white rounded-md shadow-[0px_4px_15.9px_0px_#701CC061] transform transition-transform duration-300 hover:scale-105 ${inter.className}`}
             >
               Upload PDF
             </button>
           </div>
         </div>
       )}
     </div>
   )
 }
        </div>
      )}

      {/* Login/Create Account Modal */}
      {showLoginModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="relative bg-white/10 backdrop-blur-md rounded-lg p-8 w-[90%] max-w-md shadow-lg">
            {/* Go Back Button */}
            <button
              onClick={handleCloseLoginModal}
              className="absolute top-4 left-4 text-white hover:text-gray-300 transition-colors flex items-center space-x-2"
            >
              <FiArrowLeft className="w-4 h-4" />
              <span className="text-sm">Back</span>
            </button>

            {/* Logo */}
            <div className="flex justify-center mb-6">
              <Image
                src="/assets/vierra-logo.png"
                alt="Vierra Logo"
                width={150}
                height={50}
                className="w-auto h-12"
              />
            </div>

            {/* Mode Toggle Buttons */}
            <div className="flex mb-6 bg-white/10 rounded-lg p-1">
              <button
                onClick={() => setIsLoginMode(true)}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  isLoginMode 
                    ? 'bg-[#701CC0] text-white' 
                    : 'text-white/70 hover:text-white'
                }`}
              >
                Login
              </button>
              <button
                onClick={() => setIsLoginMode(false)}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  !isLoginMode 
                    ? 'bg-[#701CC0] text-white' 
                    : 'text-white/70 hover:text-white'
                }`}
              >
                Create Account
              </button>
            </div>

            {/* Title */}
            <h2 className={`text-2xl font-bold text-white text-center mb-4 ${bricolage.className}`}>
              {isLoginMode ? 'Login to Account' : 'Create New Account'}
            </h2>

            {/* Account Info (only show in login mode when switching) */}
            {isLoginMode && selectedAccount && (
              <div className="mb-6 p-4 bg-white/10 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-white">
                      {getInitials(selectedAccount.email || 'U')}
                    </span>
                  </div>
                  <div>
                    <div className="text-white font-medium">{selectedAccount.email || 'User'}</div>
                    <div className="text-blue-300 text-xs font-medium">{selectedAccount.role}</div>
                  </div>
                </div>
              </div>
            )}

            {/* Login Form */}
            {isLoginMode ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label htmlFor="email" className={`block text-sm font-medium text-white mb-2 ${bricolage.className}`}>
                    Email
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
                    placeholder="Enter email"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="password" className={`block text-sm font-medium text-white mb-2 ${bricolage.className}`}>
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      id="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      className="w-full px-4 py-2 pr-10 bg-white/10 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
                      placeholder="Enter password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/70 hover:text-white"
                    >
                      {showPassword ? <FiEyeOff className="w-4 h-4" /> : <FiEye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {loginError && (
                  <p className="text-red-400 text-sm text-center">{loginError}</p>
                )}

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className={`w-full px-4 py-2 bg-[#701CC0] text-white rounded-md shadow-[0px_4px_15.9px_0px_#701CC061] transform transition-transform duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${inter.className}`}
                >
                  {isLoggingIn ? 'Logging in...' : 'Login'}
                </button>
              </form>
            ) : (
              /* Create Account Form */
              <form onSubmit={handleCreateAccount} className="space-y-4">
                <div>
                  <label htmlFor="newEmail" className={`block text-sm font-medium text-white mb-2 ${bricolage.className}`}>
                    Email
                  </label>
                  <input
                    type="email"
                    id="newEmail"
                    value={newAccountEmail}
                    onChange={(e) => setNewAccountEmail(e.target.value)}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
                    placeholder="Enter email"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="newName" className={`block text-sm font-medium text-white mb-2 ${bricolage.className}`}>
                    Name
                  </label>
                  <input
                    type="text"
                    id="newName"
                    value={newAccountName}
                    onChange={(e) => setNewAccountName(e.target.value)}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
                    placeholder="Enter name"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="newRole" className={`block text-sm font-medium text-white mb-2 ${bricolage.className}`}>
                    Role
                  </label>
                  <select
                    id="newRole"
                    value={newAccountRole}
                    onChange={(e) => setNewAccountRole(e.target.value)}
                    className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-white/30"
                  >
                    <option value="user" className="bg-gray-800 text-white">User</option>
                    <option value="admin" className="bg-gray-800 text-white">Admin</option>
                  </select>
                </div>

                {addAccountError && (
                  <p className="text-red-400 text-sm text-center">{addAccountError}</p>
                )}

                <button
                  type="submit"
                  disabled={isCreatingAccount}
                  className={`w-full px-4 py-2 bg-[#701CC0] text-white rounded-md shadow-[0px_4px_15.9px_0px_#701CC061] transform transition-transform duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed ${inter.className}`}
                >
                  {isCreatingAccount ? 'Creating Account...' : 'Create Account'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}


      {/* Success Modal */}
      {showSuccessModal && createdAccount && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="relative bg-white/10 backdrop-blur-md rounded-lg p-8 w-[90%] max-w-md shadow-lg">
            {/* Close Button */}
            <button
              onClick={() => setShowSuccessModal(false)}
              className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
            >
              <FiPlus className="w-6 h-6 rotate-45" />
            </button>

            {/* Logo */}
            <div className="flex justify-center mb-6">
              <Image
                src="/assets/vierra-logo.png"
                alt="Vierra Logo"
                width={150}
                height={50}
                className="w-auto h-12"
              />
            </div>

            {/* Success Message */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiUserCheck className="w-8 h-8 text-green-400" />
              </div>
              <h2 className={`text-2xl font-bold text-white mb-2 ${bricolage.className}`}>
                Account Created Successfully!
              </h2>
              <p className="text-white/70">
                {createdAccount.role} account has been created
              </p>
            </div>

            {/* Account Details */}
            <div className="bg-white/10 rounded-lg p-4 mb-6">
              <div className="space-y-3">
                <div>
                  <label className="text-white/70 text-sm">Name</label>
                  <p className="text-white font-medium">{createdAccount.name}</p>
                </div>
                <div>
                  <label className="text-white/70 text-sm">Email</label>
                  <p className="text-white font-medium">{createdAccount.email}</p>
                </div>
                <div>
                  <label className="text-white/70 text-sm">Role</label>
                  <p className="text-white font-medium capitalize">{createdAccount.role}</p>
                </div>
                <div>
                  <label className="text-white/70 text-sm">Password</label>
                  <div className="flex items-center space-x-2">
                    <p className="text-white font-medium font-mono bg-white/10 px-2 py-1 rounded">
                      {createdAccount.password}
                    </p>
                    <button
                      onClick={() => navigator.clipboard.writeText(createdAccount.password)}
                      className="text-blue-400 hover:text-blue-300 text-sm"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3">
              <button
                onClick={() => setShowSuccessModal(false)}
                className="flex-1 px-4 py-2 border border-white/20 text-white rounded-lg hover:bg-white/10 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowSuccessModal(false)
                  // Auto-fill login form with new account
                  setLoginEmail(createdAccount.email)
                  setShowLoginModal(true)
                }}
                className="flex-1 px-4 py-2 bg-[#701CC0] text-white rounded-lg hover:bg-[#5A0FA0] transition-colors"
              >
                Login Now
              </button>
            </div>
          </div>
        </div>
               )}

       {/* LTV Calculator Modal */}
       {showLTVModal && (
         <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
           <div className="relative bg-[#2E0A4F] rounded-lg p-8 w-[90%] max-w-md shadow-lg">
             {/* Close Button */}
             <button
               onClick={() => setShowLTVModal(false)}
               className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
             >
               <FiPlus className="w-6 h-6 rotate-45" />
             </button>

             {/* Logo */}
             <div className="flex justify-center mb-6">
               <Image
                 src="/assets/vierra-logo.png"
                 alt="Vierra Logo"
                 width={150}
                 height={50}
                 className="w-auto h-12"
               />
             </div>

             {/* Title */}
             <h2 className={`text-2xl font-bold text-white text-center mb-6 ${bricolage.className}`}>
               LTV Calculator
             </h2>

             {/* Input Fields */}
             <div className="space-y-4 mb-6">
               <div>
                 <label className={`block text-sm font-medium text-white mb-2 ${bricolage.className}`}>
                   Average Purchase Value
                 </label>
                 <input
                   type="number"
                   value={ltvValues.averagePurchaseValue}
                   onChange={(e) => handleLTVInputChange('averagePurchaseValue', parseFloat(e.target.value) || 0)}
                   className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
                   placeholder="0"
                 />
               </div>

               <div>
                 <label className={`block text-sm font-medium text-white mb-2 ${bricolage.className}`}>
                   Cost Of Goods/Services Sold (As A Percentage)
                 </label>
                 <input
                   type="number"
                   value={ltvValues.costOfGoodsPercentage}
                   onChange={(e) => handleLTVInputChange('costOfGoodsPercentage', parseFloat(e.target.value) || 0)}
                   className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
                   placeholder="0"
                 />
               </div>

               <div>
                 <label className={`block text-sm font-medium text-white mb-2 ${bricolage.className}`}>
                   Returns Per Year
                 </label>
                 <input
                   type="number"
                   value={ltvValues.returnsPerYear}
                   onChange={(e) => handleLTVInputChange('returnsPerYear', parseFloat(e.target.value) || 0)}
                   className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
                   placeholder="0"
                 />
               </div>

               <div>
                 <label className={`block text-sm font-medium text-white mb-2 ${bricolage.className}`}>
                   Customer Term In Years
                 </label>
                 <input
                   type="number"
                   value={ltvValues.customerTermYears}
                   onChange={(e) => handleLTVInputChange('customerTermYears', parseFloat(e.target.value) || 0)}
                   className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
                   placeholder="0"
                 />
               </div>

               <div>
                 <label className={`block text-sm font-medium text-white mb-2 ${bricolage.className}`}>
                   Number Of Referrals
                 </label>
                 <input
                   type="number"
                   value={ltvValues.numberOfReferrals}
                   onChange={(e) => handleLTVInputChange('numberOfReferrals', parseFloat(e.target.value) || 0)}
                   className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
                   placeholder="0"
                 />
               </div>

               <div>
                 <label className={`block text-sm font-medium text-white mb-2 ${bricolage.className}`}>
                   Number Of Clients Brought In
                 </label>
                 <input
                   type="number"
                   value={ltvValues.numberOfClientsBroughtIn}
                   onChange={(e) => handleLTVInputChange('numberOfClientsBroughtIn', parseFloat(e.target.value) || 0)}
                   className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-md text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
                   placeholder="0"
                 />
               </div>
             </div>

             {/* Calculate Button */}
             <button
               onClick={calculateLTV}
               className={`w-full px-4 py-2 bg-[#701CC0] text-white rounded-md shadow-[0px_4px_15.9px_0px_#701CC061] transform transition-transform duration-300 hover:scale-105 ${inter.className} mb-4`}
             >
               Calculate LTV
             </button>

             {/* Result */}
             <div className="text-center">
               <p className="text-white text-lg font-bold">
                 Lifetime Value: ${lifetimeValue.toFixed(2)}
               </p>
             </div>
           </div>
         </div>
       )}

       {/* PDF Signer Modal */}
       {showPDFModal && (
         <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
           <div className="relative bg-[#2E0A4F] rounded-lg p-8 w-[90%] max-w-md shadow-lg">
             {/* Close Button */}
             <button
               onClick={() => setShowPDFModal(false)}
               className="absolute top-4 right-4 text-white hover:text-gray-300 transition-colors"
             >
               <FiPlus className="w-6 h-6 rotate-45" />
             </button>

             {/* Logo */}
             <div className="flex justify-center mb-6">
               <Image
                 src="/assets/vierra-logo.png"
                 alt="Vierra Logo"
                 width={150}
                 height={50}
                 className="w-auto h-12"
               />
             </div>

             {/* Title */}
             <h2 className={`text-2xl font-bold text-white text-center mb-6 ${bricolage.className}`}>
               Preparing The PDF
             </h2>

             {/* Upload Button */}
             <button
               className={`w-full px-4 py-2 bg-[#701CC0] text-white rounded-md shadow-[0px_4px_15.9px_0px_#701CC061] transform transition-transform duration-300 hover:scale-105 ${inter.className}`}
             >
               Upload PDF
             </button>
           </div>
         </div>
       )}
     </div>
   )
 }

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions)

  // Not logged in -> login
  if (!session) {
    return { redirect: { destination: "/login", permanent: false } }
  }

  const role = (session.user as any).role

  // Only admins allowed
  if ((session.user as any).role !== "admin") {
    return { redirect: { destination: "/client", permanent: false } }
  }

  return { props: { dashboardHref: role === "user" ? "/client" : "/panel" } }
}
