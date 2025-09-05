import React, { useState, useEffect } from "react"
import Head from "next/head"
import { Inter, Bricolage_Grotesque } from "next/font/google"
import Image from "next/image"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { FiLogOut, FiFileText, FiUsers, FiPlus, FiCheck, FiLink, FiImage, FiArrowLeft, FiChevronDown, FiTarget } from "react-icons/fi"
import { useSession, signOut, signIn } from "next-auth/react"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/pages/api/auth/[...nextauth]"
import type { GetServerSideProps } from "next"

const inter = Inter({ subsets: ["latin"] })
const bricolage = Bricolage_Grotesque({ subsets: ["latin"] })

type PageProps = { dashboardHref: string }

const CreateAdsPage = ({ dashboardHref }: PageProps) => {
  const router = useRouter()
  const { data: session } = useSession()
  const [isImpersonating, setIsImpersonating] = useState(false)
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['facebook'])
  const [generatedContent, setGeneratedContent] = useState<{[key: string]: {image?: string, caption?: string}}>({})
  const [isGenerating, setIsGenerating] = useState<{[key: string]: {image?: boolean, caption?: boolean}}>({})
  const [loadingProgress, setLoadingProgress] = useState<{[key: string]: {image?: number, caption?: number}}>({})
  const [lastAnalysisTimestamp, setLastAnalysisTimestamp] = useState<string | null>(null)
  const [isAnalysisExpanded, setIsAnalysisExpanded] = useState(false)
  const [additionalContext, setAdditionalContext] = useState('')
  const [isSavingContext, setIsSavingContext] = useState(false)
  const [contextSaved, setContextSaved] = useState(false)
  const [contextActive, setContextActive] = useState(false)
  const [uploadedImages, setUploadedImages] = useState<File[]>([])
  const [uploadedImagePreviews, setUploadedImagePreviews] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [generatedImageLinks, setGeneratedImageLinks] = useState<string[]>([])
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
  const [showPDFModal, setShowPDFModal] = useState(false)
  const [budget, setBudget] = useState<number | ''>('')
  const [isSavingBudget, setIsSavingBudget] = useState(false)
  const [budgetSaved, setBudgetSaved] = useState(false)
  const [showBudgetModal, setShowBudgetModal] = useState(false)
  const [isPublishingCampaign, setIsPublishingCampaign] = useState(false)
  const [campaignName, setCampaignName] = useState('')
  const [isSavingCampaign, setIsSavingCampaign] = useState(false)
  const [campaignSaved, setCampaignSaved] = useState(false)

  const formatPlatformName = (platform: string) => {
    if (platform === 'googleads') return 'Google Ads';
    return platform.charAt(0).toUpperCase() + platform.slice(1);
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  // Function to upload image to URL generator service
  const uploadImageToUrlGenerator = async (file: File): Promise<any> => {
    try {
      // Convert file to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1]; // Remove data:image/...;base64, prefix
          resolve(base64);
        };
        reader.onerror = reject;
      });
      
      reader.readAsDataURL(file);
      const base64Data = await base64Promise;

      // Use our local API endpoint to avoid CORS issues
      const response = await fetch('/api/upload-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          b64: base64Data,
          ext: 'png'
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Image uploaded to URL generator:', {
          id: result.id,
          url: result.url,
          expires_in_seconds: result.expires_in_seconds
        });
        return result;
      } else {
        const errorData = await response.json();
        console.error('Failed to upload image to URL generator:', response.status, errorData);
        return null;
      }
    } catch (error) {
      console.error('Error uploading image to URL generator:', error);
      return null;
    }
  };

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('File selection event triggered');
    console.log('Event target files:', event.target.files);
    
    const file = event.target.files?.[0];
    console.log('Selected file:', file);
    
    if (file) {
      // Check if we already have 3 images
      if (uploadedImages.length >= 3) {
        setError('Maximum 3 images allowed. Please clear existing images first.');
        return;
      }
      
      console.log('File details:', {
        name: file.name,
        type: file.type,
        size: file.size,
        sizeInMB: (file.size / (1024 * 1024)).toFixed(2)
      });
      
      // Validate file type
      if (!['image/jpeg', 'image/jpg', 'image/png', 'image/gif'].includes(file.type)) {
        console.log('Invalid file type:', file.type);
        setError('Please select a valid image file (JPG, PNG, or GIF)');
        return;
      }
      
      // Validate file size (20MB)
      const fileSizeInMB = file.size / (1024 * 1024);
      if (fileSizeInMB > 20) {
        console.log('File too large:', fileSizeInMB.toFixed(2), 'MB');
        setError(`File size (${fileSizeInMB.toFixed(2)} MB) must be less than 20MB`);
        return;
      }

      console.log('File validation passed, setting state...');
      setUploadedImages(prev => [...prev, file]);
      setError(null);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        console.log('FileReader onload triggered');
        setUploadedImagePreviews(prev => [...prev, e.target?.result as string]);
      };
      reader.readAsDataURL(file);
      console.log('FileReader started reading file');
    } else {
      console.log('No file selected');
    }
  };

  // Handle image upload
  const handleImageUpload = async () => {
    if (!uploadedImages.length) {
      setError('Please select an image first');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const results = await Promise.all(uploadedImages.map(uploadImageToUrlGenerator));
      
      if (results.every(result => result)) {
        setGeneratedImageLinks(results.map(result => result.url));
        console.log('Images successfully uploaded and converted to links:', results.map(result => result.url));
      } else {
        setError('Failed to upload one or more images to URL generator');
      }
    } catch (error) {
      setError('Error uploading images');
      console.error('Upload error:', error);
    } finally {
      setIsUploading(false);
    }
  };

  // Handle clear uploaded image
  const handleClearUploadedImage = () => {
    setUploadedImages([]);
    setUploadedImagePreviews([]);
    setGeneratedImageLinks([]);
    setError(null);
  };

  // Loading Circle Component
  const LoadingCircle = ({ progress, size = 24 }: { progress: number, size?: number }) => {
    const radius = (size - 4) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDasharray = circumference;
    const strokeDashoffset = circumference - (progress / 100) * circumference;

    return (
      <div className="relative inline-flex items-center justify-center">
        <svg
          width={size}
          height={size}
          className="transform -rotate-90"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="rgba(255, 255, 255, 0.2)"
            strokeWidth="2"
            fill="none"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#8F42FF"
            strokeWidth="2"
            fill="none"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-300 ease-out"
          />
        </svg>
      </div>
    );
  };

  // Progress simulation function
  const simulateProgress = (platform: string, contentType: 'image' | 'caption', duration: number) => {
    const startTime = Date.now();
    const targetTime = startTime + (duration * 1000);
    
    const updateProgress = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const totalDuration = duration * 1000;
      
      if (elapsed >= totalDuration) {
        // Set to 90% and wait for actual completion
        setLoadingProgress(prev => ({
          ...prev,
          [platform]: { ...prev[platform], [contentType]: 90 }
        }));
        return;
      }
      
      const progress = Math.min((elapsed / totalDuration) * 90, 90);
      setLoadingProgress(prev => ({
        ...prev,
        [platform]: { ...prev[platform], [contentType]: progress }
      }));
      
      requestAnimationFrame(updateProgress);
    };
    
    updateProgress();
  };

  // Function to load existing analysis content
  const loadExistingAnalysis = async () => {
    try {
      const response = await fetch('/api/load-analysis');
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.analysis) {
          setAnalysisResult(data.analysis);
          setLastAnalysisTimestamp(data.timestamp);
        }
      }
    } catch (error) {
      console.log('No existing analysis found or error loading');
    }

    // Load existing additional context and check if it's active
    try {
      const contextResponse = await fetch('/api/load-context');
      if (contextResponse.ok) {
        const contextData = await contextResponse.json();
        if (contextData.success && contextData.context) {
          // Only set the context in UI if user has previously saved context
          // Don't automatically activate it - user needs to save it again if they want it active
          setAdditionalContext(contextData.context);
          setContextActive(contextData.isActive || false);
        }
      }
    } catch (error) {
      console.log('No existing additional context found or error loading');
    }
  };

  // Load existing analysis on page load
  useEffect(() => {
    loadExistingAnalysis();
  }, []);

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

  // Check for impersonation
  useEffect(() => {
    const storedImpersonation = localStorage.getItem('impersonationData')
    if (storedImpersonation) {
      setIsImpersonating(true)
    }
  }, []);

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

  // Function to save budget to database
  const handleSaveBudget = async () => {
    if (!budget || budget <= 0) {
      return;
    }

    setIsSavingBudget(true);
    setBudgetSaved(false);
    
    try {
      const response = await fetch('/api/save-budget', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          budget: Number(budget),
          userId: session?.user?.id,
        }),
      });

      if (response.ok) {
        setBudgetSaved(true);
        setTimeout(() => setBudgetSaved(false), 3000);
      } else {
        console.error('Failed to save budget');
      }
    } catch (error) {
      console.error('Error saving budget:', error);
    } finally {
      setIsSavingBudget(false);
    }
  }

  // Function to save campaign name
  const handleSaveCampaign = async () => {
    if (!campaignName.trim()) {
      return;
    }

    setIsSavingCampaign(true);
    setCampaignSaved(false);
    
    try {
      const response = await fetch('/api/save-campaign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          campaignName: campaignName.trim(),
          budget: budget || 0,
          platforms: selectedPlatforms,
          userId: session?.user?.id,
        }),
      });

      if (response.ok) {
        setCampaignSaved(true);
        setTimeout(() => setCampaignSaved(false), 3000);
      } else {
        console.error('Failed to save campaign');
      }
    } catch (error) {
      console.error('Error saving campaign:', error);
    } finally {
      setIsSavingCampaign(false);
    }
  }

  // Function to publish campaign
  const handlePublishCampaign = async () => {
    if (!campaignName.trim() || !budget || budget <= 0 || selectedPlatforms.length === 0) {
      alert('Please ensure campaign name, budget, and at least one platform are set before publishing.');
      return;
    }

    setIsPublishingCampaign(true);
    
    try {
      // First save/update the campaign
      const campaignResponse = await fetch('/api/save-campaign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          campaignName: campaignName.trim(),
          budget: Number(budget),
          platforms: selectedPlatforms,
          userId: session?.user?.id,
        }),
      });

      if (campaignResponse.ok) {
        // Then publish it (update status to active and set start date)
        const publishResponse = await fetch('/api/publish-campaign', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            campaignName: campaignName.trim(),
            userId: session?.user?.id,
          }),
        });

        if (publishResponse.ok) {
          alert('Campaign published successfully!');
          // Clear form
          setCampaignName('');
          setBudget('');
          setSelectedPlatforms(['facebook']);
        } else {
          console.error('Failed to publish campaign');
          alert('Failed to publish campaign. Please try again.');
        }
      } else {
        console.error('Failed to save campaign');
        alert('Failed to save campaign. Please try again.');
      }
    } catch (error) {
      console.error('Error publishing campaign:', error);
      alert('Error publishing campaign. Please try again.');
    } finally {
      setIsPublishingCampaign(false);
    }
  }

  // Function to save additional context
  const handleSaveAdditionalContext = async () => {
    // Only save if there's actual content
    if (!additionalContext.trim()) {
      return;
    }

    setIsSavingContext(true);
    setContextSaved(false);
    
    try {
      const response = await fetch('/api/save-context', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ additionalContext }),
      });

      if (response.ok) {
        console.log('Additional context saved successfully');
        setContextSaved(true);
        setContextActive(true);
        // Reset the saved state after 2 seconds
        setTimeout(() => setContextSaved(false), 2000);
      } else {
        console.error('Failed to save additional context');
      }
    } catch (error) {
      console.error('Error saving additional context:', error);
    } finally {
      setIsSavingContext(false);
    }
  };

  const handleAnalyzeWebsite = async () => {
    if (!websiteUrl.trim()) {
      setError('Please enter a website URL');
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setAnalysisResult(null);

    try {
      const response = await fetch('/api/analyze-website', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ websiteUrl: websiteUrl.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        setAnalysisResult(data.result);
        // Extract timestamp from the result if available
        if (data.timestamp) {
          setLastAnalysisTimestamp(data.timestamp);
        }
      } else {
        setError(data.error || 'Analysis failed');
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleGenerateContent = async (platform: string, contentType: 'image' | 'caption') => {
    // Check if analysis file exists and has content
    try {
      const response = await fetch('/api/check-analysis');
      const data = await response.json();
      
      if (!data.success || !data.hasAnalysis) {
        setError('Please run website analysis first');
        return;
      }
    } catch (error) {
      setError('Unable to verify analysis file. Please run website analysis first');
      return;
    }

    // Set loading state and initialize progress
    setIsGenerating(prev => ({
      ...prev,
      [platform]: { ...prev[platform], [contentType]: true }
    }));
    setLoadingProgress(prev => ({
      ...prev,
      [platform]: { ...prev[platform], [contentType]: 0 }
    }));

    // Start progress simulation
    const duration = contentType === 'caption' ? 30 : 60; // 30s for caption, 60s for image
    simulateProgress(platform, contentType, duration);

    try {
      console.log('Generating content with contextActive:', contextActive);
      console.log('Generating content with uploadedImage:', uploadedImages.length > 0 ? 'available' : 'not available');
      
      const response = await fetch('/api/generate-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform,
          contentType,
          includeContext: contextActive,
          imageUrls: uploadedImagePreviews // Pass the uploaded image preview URLs
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Update generated content
        setGeneratedContent(prev => ({
          ...prev,
          [platform]: {
            ...prev[platform],
            [contentType]: contentType === 'image' ? data.imagePath : data.caption
          }
        }));
      } else {
        setError(data.error || `${contentType} generation failed`);
      }
    } catch (err) {
      setError('Network error occurred');
    } finally {
      // Complete the progress to 100% and clear loading state
      setLoadingProgress(prev => ({
        ...prev,
        [platform]: { ...prev[platform], [contentType]: 100 }
      }));
      
      // Wait a moment to show 100% completion, then clear
      setTimeout(() => {
        setIsGenerating(prev => ({
          ...prev,
          [platform]: { ...prev[platform], [contentType]: false }
        }));
        setLoadingProgress(prev => ({
          ...prev,
          [platform]: { ...prev[platform], [contentType]: 0 }
        }));
      }, 500);
    }
  };

  return (
    <>
      <Head>
        <title>Vierra | Create Ads</title>
      </Head>
      <div className="min-h-screen bg-gray-100 flex">
        {/* Sidebar */}
        <div className="w-64 bg-[#2E0A4F] relative flex-shrink-0 min-h-screen">
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
                    Impersonating User
                  </div>
                  <button
                    onClick={() => {
                      localStorage.removeItem('impersonationData')
                      router.push('/manage-users')
                    }}
                    className="flex items-center w-full p-2 rounded bg-yellow-600 hover:bg-yellow-700 text-white transition-colors duration-200"
                  >
                    <FiArrowLeft className="w-4 h-4 mr-2" />
                    <span className="text-sm font-medium">
                      Back to Admin
                    </span>
                  </button>
                </div>
              )}
              {/* Dynamic navigation based on impersonation state or role */}
              {isImpersonating || dashboardHref !== "/panel" ? (
                // Client navigation (when impersonating or when dashboardHref is not /panel)
                <>
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
                  <button
                    onClick={() => router.push("/create-ads")}
                    className="flex items-center w-full p-3 rounded-lg text-white bg-white/10 transition-colors"
                  >
                    <FiPlus className="w-5 h-5" />
                    <span className="ml-3 text-sm font-medium">Create Ads</span>
                  </button>
                                <button
                onClick={() => router.push("/gallery")}
                className="flex items-center w-full p-3 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
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
                </>
              ) : (
                // Admin navigation (only when not impersonating and dashboardHref is /panel)
                <>
                  <button
                    onClick={() => setShowPDFModal(true)}
                    className="flex items-center w-full p-3 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <FiFileText className="w-5 h-5" />
                    <span className="ml-3 text-sm font-medium">PDF Signer</span>
                  </button>
                  <button
                    onClick={() => router.push("/panel")}
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
                    className="flex items-center w-full p-3 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <FiUsers className="w-5 h-5" />
                    <span className="ml-3 text-sm font-medium">Manage Users</span>
                  </button>
                  <button
                    onClick={() => router.push("/create-ads")}
                    className="flex items-center w-full p-3 rounded-lg text-white bg-white/10 transition-colors"
                  >
                    <FiPlus className="w-5 h-5" />
                    <span className="ml-3 text-sm font-medium">Create Ads</span>
                  </button>
                </>
              )}
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

          {/* Page Content */}
          <div className="flex-1 p-6 bg-white">
            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900">Create Ads</h1>
            </div>

            {/* Website Analysis Section */}
            <div className="bg-white border border-gray-200 rounded-lg p-8 mb-6">
              <h3 className="text-xl font-semibold mb-2 text-gray-900">Website Analysis</h3>
              <p className="text-gray-600 mb-6">
                Enter your website URL to analyze its content and generate optimized ad content.
              </p>
              
              <div className="flex gap-4">
                <input
                  type="url"
                  placeholder="https://example.com"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  className="flex-1 bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#2E0A4F] focus:border-transparent transition-colors"
                />
                <button
                  onClick={handleAnalyzeWebsite}
                  disabled={isAnalyzing}
                  className={`font-medium px-6 py-3 rounded-lg transition-colors duration-200 ${
                    isAnalyzing 
                      ? 'bg-gray-500 cursor-not-allowed' 
                      : 'bg-[#2E0A4F] hover:bg-[#3A1A5F]'
                  } text-white`}
                >
                  {isAnalyzing ? 'Analyzing...' : 'Run Analysis'}
                </button>
              </div>
              
              {error && (
                <div className="mt-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}
              
              {analysisResult && (
                <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-lg font-semibold text-gray-900">Last Analysis Result</h4>
                    {lastAnalysisTimestamp && (
                      <div className="text-sm text-gray-600">
                        Last updated: {new Date(lastAnalysisTimestamp).toLocaleString()}
                      </div>
                    )}
                  </div>
                  {isAnalysisExpanded && (
                    <div className="bg-white border border-gray-200 rounded-lg p-4 max-h-96 overflow-y-auto">
                      <pre className="text-gray-700 text-sm whitespace-pre-wrap font-mono">
                        {analysisResult}
                      </pre>
                    </div>
                  )}
                  <button
                    onClick={() => setIsAnalysisExpanded(!isAnalysisExpanded)}
                    className={`font-medium px-6 py-3 rounded-lg transition-colors duration-200 ${
                      isAnalysisExpanded 
                        ? 'bg-gray-500 hover:bg-gray-600' 
                        : 'bg-[#2E0A4F] hover:bg-[#3A1A5F]'
                    } text-white`}
                  >
                    {isAnalysisExpanded ? 'Collapse ↑' : 'Expand ↓'}
                  </button>
                </div>
              )}
            </div>

            {/* Platform Selection Section */}
            <div className="bg-white border border-gray-200 rounded-lg p-8 mb-6">
              <h3 className="text-xl font-semibold mb-2 text-gray-900">Select Platforms</h3>
              
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                
                <div className="grid grid-cols-2 gap-4">
                  {/* Facebook */}
                  <button
                    onClick={() => {
                      const newSelected = selectedPlatforms.includes('facebook') 
                        ? selectedPlatforms.filter(p => p !== 'facebook')
                        : [...selectedPlatforms, 'facebook'];
                      setSelectedPlatforms(newSelected);
                    }}
                    className={`relative p-4 rounded-lg border-2 transition-all duration-200 ${
                      selectedPlatforms.includes('facebook')
                        ? 'border-[#2E0A4F] bg-[#2E0A4F] text-white'
                        : 'border-gray-300 bg-white hover:border-gray-400 text-gray-900'
                    }`}
                  >
                    <div className="text-center">
                      <div className="font-medium">Facebook (connected)</div>
                    </div>
                    {selectedPlatforms.includes('facebook') && (
                      <div className="absolute bottom-2 right-2">
                        <FiCheck className="w-5 h-5 text-white" />
                      </div>
                    )}
                  </button>

                  {/* Instagram */}
                  <button
                    onClick={() => {
                      const newSelected = selectedPlatforms.includes('instagram') 
                        ? selectedPlatforms.filter(p => p !== 'instagram')
                        : [...selectedPlatforms, 'instagram'];
                      setSelectedPlatforms(newSelected);
                    }}
                    className={`relative p-4 rounded-lg border-2 transition-all duration-200 ${
                      selectedPlatforms.includes('instagram')
                        ? 'border-[#2E0A4F] bg-[#2E0A4F] text-white'
                        : 'border-gray-300 bg-white hover:border-gray-400 text-gray-900'
                    }`}
                  >
                    <div className="text-center">
                      <div className="font-medium">Instagram (connected)</div>
                    </div>
                    {selectedPlatforms.includes('instagram') && (
                      <div className="absolute bottom-2 right-2">
                        <FiCheck className="w-5 h-5 text-white" />
                      </div>
                    )}
                  </button>

                  {/* LinkedIn */}
                  <button
                    onClick={() => {
                      const newSelected = selectedPlatforms.includes('linkedin') 
                        ? selectedPlatforms.filter(p => p !== 'linkedin')
                        : [...selectedPlatforms, 'linkedin'];
                      setSelectedPlatforms(newSelected);
                    }}
                    className={`relative p-4 rounded-lg border-2 transition-all duration-200 ${
                      selectedPlatforms.includes('linkedin')
                        ? 'border-[#2E0A4F] bg-[#2E0A4F] text-white'
                        : 'border-gray-300 bg-white hover:border-gray-400 text-gray-900'
                    }`}
                  >
                    <div className="text-center">
                      <div className="font-medium">LinkedIn (connected)</div>
                    </div>
                    {selectedPlatforms.includes('linkedin') && (
                      <div className="absolute bottom-2 right-2">
                        <FiCheck className="w-5 h-5 text-white" />
                      </div>
                    )}
                  </button>

                  {/* Google Ads */}
                  <button
                    onClick={() => {
                      const newSelected = selectedPlatforms.includes('googleads') 
                        ? selectedPlatforms.filter(p => p !== 'googleads')
                        : [...selectedPlatforms, 'googleads'];
                      setSelectedPlatforms(newSelected);
                    }}
                    className={`relative p-4 rounded-lg border-2 transition-all duration-200 ${
                      selectedPlatforms.includes('googleads')
                        ? 'border-[#2E0A4F] bg-[#2E0A4F] text-white'
                        : 'border-gray-300 bg-white hover:border-gray-400 text-gray-900'
                    }`}
                  >
                    <div className="text-center">
                      <div className="font-medium">Google Ads (connected)</div>
                    </div>
                    {selectedPlatforms.includes('googleads') && (
                      <div className="absolute bottom-2 right-2">
                        <FiCheck className="w-5 h-5 text-white" />
                      </div>
                    )}
                  </button>
                </div>

                <div className="mt-4 text-sm text-gray-600">
                  Selected platforms: {selectedPlatforms.length > 0 ? selectedPlatforms.join(', ') : 'None'}
                </div>
              </div>
            </div>


            {/* Additional Context Section */}
            <div className="bg-white border border-gray-200 rounded-lg p-8 mb-6">
              <h3 className="text-xl font-semibold mb-2 text-gray-900">Additional Context</h3>
              
              <div className="flex gap-4">
                <textarea
                  placeholder="Enter any additional details you would like the ad to include (phone number, hours, location, etc.)"
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  className="flex-1 bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#2E0A4F] focus:border-transparent transition-colors min-h-[100px] resize-vertical"
                />
                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleSaveAdditionalContext}
                    disabled={isSavingContext}
                    className={`font-medium px-6 py-3 rounded-lg transition-colors duration-200 self-start flex items-center gap-2 ${
                      contextSaved 
                        ? 'bg-green-600 hover:bg-green-700' 
                        : isSavingContext 
                          ? 'bg-gray-500 cursor-not-allowed' 
                          : 'bg-[#2E0A4F] hover:bg-[#3A1A5F]'
                    } text-white`}
                  >
                    {contextSaved ? (
                      <>
                        <FiCheck className="w-4 h-4" />
                        Saved!
                      </>
                    ) : isSavingContext ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Saving...
                      </>
                    ) : (
                      'Save Context'
                    )}
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        const response = await fetch('/api/clear-context', {
                          method: 'POST',
                          headers: {
                            'Content-Type': 'application/json',
                          },
                        });

                        if (response.ok) {
                          setAdditionalContext('');
                          setContextActive(false);
                          setContextSaved(false);
                          console.log('Context cleared successfully');
                        } else {
                          console.error('Failed to clear context');
                        }
                      } catch (error) {
                        console.error('Error clearing context:', error);
                      }
                    }}
                    className="font-medium px-6 py-3 rounded-lg bg-gray-600 hover:bg-gray-700 text-white transition-colors duration-200 self-start"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>

            {/* Upload Image Panel */}
            <div className="bg-white border border-gray-200 rounded-lg p-8 mb-6">
              <h3 className="text-xl font-semibold mb-2 text-gray-900">Upload Image</h3>
              
              {/* Hidden file input */}
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/gif"
                onChange={handleFileSelect}
                className="hidden"
                id="image-upload-input"
              />
              
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                {/* Error display for upload panel */}
                {error && (
                  <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg">
                    <p className="text-red-400 text-sm">{error}</p>
                  </div>
                )}
                
                <div className="flex gap-4 mb-6">
                  <label
                    htmlFor="image-upload-input"
                    className={`font-medium px-6 py-3 rounded-lg transition-colors duration-200 cursor-pointer ${
                      uploadedImages.length >= 3
                        ? 'bg-gray-500 cursor-not-allowed'
                        : 'bg-[#2E0A4F] hover:bg-[#3A1A5F]'
                    } text-white`}
                  >
                    Choose File {uploadedImages.length > 0 && `(${uploadedImages.length}/3)`}
                  </label>
                  <button
                    onClick={handleImageUpload}
                    disabled={!uploadedImages.length || isUploading}
                    className={`font-medium px-6 py-3 rounded-lg transition-colors duration-200 ${
                      !uploadedImages.length || isUploading
                        ? 'bg-gray-500 cursor-not-allowed'
                        : 'bg-[#2E0A4F] hover:bg-[#3A1A5F]'
                    } text-white`}
                  >
                    {isUploading ? 'Uploading...' : 'Upload Images'}
                  </button>
                  <button
                    onClick={handleClearUploadedImage}
                    disabled={!uploadedImages.length}
                    className={`font-medium px-6 py-3 rounded-lg transition-colors duration-200 ${
                      !uploadedImages.length
                        ? 'bg-gray-500 cursor-not-allowed'
                        : 'bg-gray-600 hover:bg-gray-700'
                    } text-white`}
                  >
                    Clear All
                  </button>
                </div>
                
                <div className="bg-white border-2 border-dashed border-gray-300 rounded-lg p-4 text-center h-32 flex items-center justify-center">
                  {uploadedImagePreviews.length > 0 ? (
                    <div className={`grid gap-2 w-full h-full max-w-full max-h-full ${
                      uploadedImagePreviews.length === 1 ? 'grid-cols-1' :
                      uploadedImagePreviews.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
                    }`}>
                      {uploadedImagePreviews.map((preview, index) => (
                        <div key={index} className="relative w-full h-full flex items-center justify-center overflow-hidden">
                          <div className="relative w-full h-full flex items-center justify-center">
                            <img 
                              src={preview} 
                              alt={`Uploaded image preview ${index + 1}`}
                              className="w-full h-full object-contain rounded"
                            />
                            <button
                              onClick={() => {
                                setUploadedImages(prev => prev.filter((_, i) => i !== index));
                                setUploadedImagePreviews(prev => prev.filter((_, i) => i !== index));
                                setGeneratedImageLinks(prev => prev.filter((_, i) => i !== index));
                              }}
                              className="absolute top-0 right-0 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg hover:bg-red-600 z-10 border-2 border-white shadow-lg"
                              title="Remove image"
                            >
                              ×
                            </button>
                          </div>                                                  
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500">(Image upload placeholder)</p>
                  )}
                </div>
                
                <div className="mt-4 text-sm text-gray-600">
                  Supported formats: JPG, PNG, GIF (Max size: 20MB)
                </div>
              </div>
            </div>

            {/* Content Generation Preview Panels */}
            {selectedPlatforms.map((platform) => (
              <div key={platform} className="bg-white border border-gray-200 rounded-lg p-8 mb-6">
                <h3 className="text-xl font-semibold mb-2 text-gray-900">
                  {formatPlatformName(platform)} Content Preview
                </h3>
                
                {/* Show when uploaded image will be included */}
                {uploadedImagePreviews.length > 0 && (
                  <div className="mb-4 p-3 bg-blue-500/20 border border-blue-500/50 rounded-lg">
                    <p className="text-blue-400 text-sm">
                      📷 Uploaded images will be included in {formatPlatformName(platform)} content generation
                    </p>
                  </div>
                )}
                
                <div className="flex gap-4 mb-6">
                  <button
                    onClick={() => handleGenerateContent(platform, 'caption')}
                    disabled={isGenerating[platform]?.caption}
                    className={`font-medium px-6 py-3 rounded-lg transition-colors duration-200 flex items-center gap-2 ${
                      isGenerating[platform]?.caption 
                        ? 'bg-gray-500 cursor-not-allowed' 
                        : 'bg-[#2E0A4F] hover:bg-[#3A1A5F]'
                    } text-white`}
                  >
                    {isGenerating[platform]?.caption ? (
                      <>
                        <LoadingCircle progress={loadingProgress[platform]?.caption || 0} size={20} />
                        Generating Caption...
                      </>
                    ) : (
                      'Generate Caption'
                    )}
                  </button>
                  <button
                    onClick={() => handleGenerateContent(platform, 'image')}
                    disabled={isGenerating[platform]?.image}
                    className={`font-medium px-6 py-3 rounded-lg transition-colors duration-200 flex items-center gap-2 ${
                      isGenerating[platform]?.image 
                        ? 'bg-gray-500 cursor-not-allowed' 
                        : 'bg-[#2E0A4F] hover:bg-[#3A1A5F]'
                    } text-white`}
                  >
                    {isGenerating[platform]?.image ? (
                      <>
                        <LoadingCircle progress={loadingProgress[platform]?.image || 0} size={20} />
                        Generating Media...
                      </>
                    ) : (
                      'Generate Media'
                    )}
                  </button>
                </div>

                {/* Media Preview Section */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
                  <h4 className="text-lg font-semibold mb-4 text-gray-900">Media Preview</h4>
                  <div className="bg-gray-100 border border-gray-300 rounded-lg p-4 text-center h-64 flex items-center justify-center">
                    {generatedContent[platform]?.image ? (
                      <img 
                        src={generatedContent[platform].image} 
                        alt={`Generated ${platform} ad image`}
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <p className="text-gray-500">(Placeholder for generated media)</p>
                    )}
                  </div>
                </div>

                {/* Generated Caption Section */}
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-lg font-semibold text-gray-900">Generated Caption</h4>
                    <button
                      onClick={() => handleGenerateContent(platform, 'caption')}
                      disabled={isGenerating[platform]?.caption}
                      className={`text-sm font-medium flex items-center gap-2 ${
                        isGenerating[platform]?.caption 
                          ? 'text-gray-500 cursor-not-allowed' 
                          : 'text-[#8F42FF] hover:text-[#701CC0]'
                      }`}
                    >
                      {isGenerating[platform]?.caption ? (
                        <>
                          <LoadingCircle progress={loadingProgress[platform]?.caption || 0} size={16} />
                          Generating...
                        </>
                      ) : (
                        'Regenerate'
                      )}
                    </button>
                  </div>
                  <div className="bg-white border border-gray-300 rounded-lg p-4">
                    {generatedContent[platform]?.caption ? (
                      <p className="text-gray-700 text-sm whitespace-pre-wrap">
                        {generatedContent[platform].caption}
                      </p>
                    ) : (
                      <p className="text-gray-500 text-sm">
                        Generated caption for {formatPlatformName(platform)} campaign. This is a placeholder for the actual generated content.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Budget and Campaign Management Section - Bottom of Page */}
            <div className="bg-white border border-gray-200 rounded-lg p-8 mb-6">
              <h3 className="text-xl font-semibold mb-4 text-gray-900">Campaign Management</h3>
              
              {/* Campaign Name Section */}
              <div className="flex gap-4 items-end mb-6">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Campaign Name
                  </label>
                  <input
                    type="text"
                    placeholder="Enter campaign name"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#2E0A4F] focus:border-transparent transition-colors"
                  />
                </div>
                
                {/* Save Campaign Button */}
                <button
                  onClick={handleSaveCampaign}
                  disabled={isSavingCampaign || !campaignName.trim()}
                  className={`font-medium px-6 py-3 rounded-lg transition-colors duration-200 flex items-center gap-2 ${
                    campaignSaved 
                      ? 'bg-green-600 hover:bg-green-700' 
                      : isSavingCampaign 
                        ? 'bg-gray-500 cursor-not-allowed' 
                        : 'bg-[#2E0A4F] hover:bg-[#3A1A5F]'
                  } text-white`}
                >
                  {campaignSaved ? (
                    <>
                      <FiCheck className="w-4 h-4" />
                      Saved!
                    </>
                  ) : isSavingCampaign ? (
                    'Saving...'
                  ) : (
                    'Save Campaign'
                  )}
                </button>
              </div>
              
              <div className="flex gap-4 items-end">
                {/* Budget Input */}
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Campaign Budget ($)
                  </label>
                  <input
                    type="number"
                    placeholder="Enter budget amount"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value ? Number(e.target.value) : '')}
                    className="w-full bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#2E0A4F] focus:border-transparent transition-colors"
                    min="0"
                    step="0.01"
                  />
                </div>
                
                {/* Save Budget Button */}
                <button
                  onClick={handleSaveBudget}
                  disabled={isSavingBudget || !budget || budget <= 0}
                  className={`font-medium px-6 py-3 rounded-lg transition-colors duration-200 flex items-center gap-2 ${
                    budgetSaved 
                      ? 'bg-green-600 hover:bg-green-700' 
                      : isSavingBudget 
                        ? 'bg-gray-500 cursor-not-allowed' 
                        : 'bg-[#2E0A4F] hover:bg-[#3A1A5F]'
                  } text-white`}
                >
                  {budgetSaved ? (
                    <>
                      <FiCheck className="w-4 h-4" />
                      Saved!
                    </>
                  ) : isSavingBudget ? (
                    'Saving...'
                  ) : (
                    'Save Budget'
                  )}
                </button>
                
                {/* Publish Campaign Button */}
                <button
                  onClick={handlePublishCampaign}
                  disabled={isPublishingCampaign}
                  className={`font-medium px-6 py-3 rounded-lg transition-colors duration-200 flex items-center gap-2 ${
                    isPublishingCampaign 
                      ? 'bg-gray-500 cursor-not-allowed' 
                      : 'bg-green-600 hover:bg-green-700'
                  } text-white`}
                >
                  {isPublishingCampaign ? (
                    'Publishing...'
                  ) : (
                    <>
                      <FiTarget className="w-4 h-4" />
                      Publish Campaign
                    </>
                  )}
                </button>
              </div>
              
              {campaignName && (
                <div className="mt-3 text-sm text-gray-600">
                  Campaign: {campaignName}
                </div>
              )}
              {budget && budget > 0 && (
                <div className="mt-1 text-sm text-gray-600">
                  Budget: ${budget.toLocaleString()}
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
    </>
  )
}

export const getServerSideProps: GetServerSideProps = async (ctx) => {
  const session = await getServerSession(ctx.req, ctx.res, authOptions)

  if (!session) {
    return { redirect: { destination: "/login", permanent: false } }
  }
  const role = (session.user as any).role
  return { props: { dashboardHref: role === "user" ? "/client" : "/panel" } }
}

export default CreateAdsPage
