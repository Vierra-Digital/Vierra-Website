import React, { useState, useEffect } from "react"
import Head from "next/head"
import { Inter } from "next/font/google"
import Image from "next/image"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { FiLogOut, FiFileText, FiUsers, FiPlus, FiCheck } from "react-icons/fi"
import { useSession, signOut } from "next-auth/react"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/pages/api/auth/[...nextauth]"
import type { GetServerSideProps } from "next"

const inter = Inter({ subsets: ["latin"] })

type PageProps = { dashboardHref: string }

const CreateAdsPage = ({ dashboardHref }: PageProps) => {
  const router = useRouter()
  const { data: session } = useSession()
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

  const formatPlatformName = (platform: string) => {
    if (platform === 'googleads') return 'Google Ads';
    return platform.charAt(0).toUpperCase() + platform.slice(1);
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
        if (data.hasContent) {
          setAnalysisResult(data.content);
          setLastAnalysisTimestamp(data.timestamp);
        }
      }
    } catch (error) {
      console.log('No existing analysis found or error loading');
    }

    // Load existing additional context (but don't activate it)
    try {
      const contextResponse = await fetch('/api/load-context');
      if (contextResponse.ok) {
        const contextData = await contextResponse.json();
        if (contextData.hasContent) {
          // Store the loaded context but don't activate it
          // User needs to click Save Context to activate it
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
      
      if (!data.hasContent) {
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
      const response = await fetch('/api/generate-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform,
          contentType,
          includeContext: contextActive
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
              className={`flex items-center w-full p-2 rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors duration-200`}
              aria-label="Go to Dashboard"
            >
              <FiFileText className="w-5 h-5" />
              <span className={`ml-3 text-sm font-medium ${inter.className}`}>
                Dashboard
              </span>
            </button>
            <button
              onClick={() => router.push("/panel")}
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
              onClick={() => router.push("/panel")}
              className={`flex items-center w-full p-2 rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors duration-200`}
              aria-label="Add Clients"
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

            <button
              onClick={() => router.push("/create-ads")}
              className={`flex items-center w-full p-2 rounded text-white bg-white/10 transition-colors duration-200`}
              aria-label="Create Ads"
            >
              <FiPlus className="w-5 h-5" />
              <span className={`ml-3 text-sm font-medium ${inter.className}`}>
                Create Ads
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
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Create Ads</h2>
            </div>

            {/* Website Analysis Section */}
            <div className="bg-[#2E0A4F] rounded-lg p-8 mb-6">
              <h3 className="text-xl font-semibold mb-2 text-white">Website Analysis</h3>
              <p className="text-white/70 mb-6">
                Enter your website URL to analyze its content and generate optimized ad content.
              </p>
              
              <div className="flex gap-4">
                <input
                  type="url"
                  placeholder="https://example.com"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  className="flex-1 bg-[#18042A] border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/50 focus:outline-none focus:border-[#8F42FF] transition-colors"
                />
                <button
                  onClick={handleAnalyzeWebsite}
                  disabled={isAnalyzing}
                  className={`font-medium px-6 py-3 rounded-lg transition-colors duration-200 ${
                    isAnalyzing 
                      ? 'bg-gray-500 cursor-not-allowed' 
                      : 'bg-[#8F42FF] hover:bg-[#701CC0]'
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
                <div className="mt-6 bg-[#18042A] border border-white/20 rounded-lg p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-lg font-semibold text-white">Last Analysis Result</h4>
                    {lastAnalysisTimestamp && (
                      <div className="text-sm text-white/60">
                        Last updated: {new Date(lastAnalysisTimestamp).toLocaleString()}
                      </div>
                    )}
                  </div>
                  {isAnalysisExpanded && (
                    <div className="bg-[#2E0A4F] rounded-lg p-4 max-h-96 overflow-y-auto">
                      <pre className="text-white/90 text-sm whitespace-pre-wrap font-mono">
                        {analysisResult}
                      </pre>
                    </div>
                  )}
                  <button
                    onClick={() => setIsAnalysisExpanded(!isAnalysisExpanded)}
                    className={`font-medium px-6 py-3 rounded-lg transition-colors duration-200 ${
                      isAnalysisExpanded 
                        ? 'bg-gray-500 hover:bg-gray-600' 
                        : 'bg-[#8F42FF] hover:bg-[#701CC0]'
                    } text-white`}
                  >
                    {isAnalysisExpanded ? 'Collapse ↑' : 'Expand ↓'}
                  </button>
                </div>
              )}
            </div>

            {/* Platform Selection Section */}
            <div className="bg-[#2E0A4F] rounded-lg p-8 mb-6">
              <h3 className="text-xl font-semibold mb-2 text-white">Select Platforms</h3>
              
              <div className="bg-[#18042A] border border-white/20 rounded-lg p-6">
                
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
                        ? 'border-[#8F42FF] bg-[#2E0A4F]'
                        : 'border-white/20 bg-[#18042A] hover:border-white/40'
                    }`}
                  >
                    <div className="text-center">
                      <div className="font-medium text-white">Facebook (connected)</div>
                    </div>
                    {selectedPlatforms.includes('facebook') && (
                      <div className="absolute bottom-2 right-2">
                        <FiCheck className="w-5 h-5 text-[#8F42FF]" />
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
                        ? 'border-[#8F42FF] bg-[#2E0A4F]'
                        : 'border-white/20 bg-[#18042A] hover:border-white/40'
                    }`}
                  >
                    <div className="text-center">
                      <div className="font-medium text-white">Instagram (connected)</div>
                    </div>
                    {selectedPlatforms.includes('instagram') && (
                      <div className="absolute bottom-2 right-2">
                        <FiCheck className="w-5 h-5 text-[#8F42FF]" />
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
                        ? 'border-[#8F42FF] bg-[#2E0A4F]'
                        : 'border-white/20 bg-[#18042A] hover:border-white/40'
                    }`}
                  >
                    <div className="text-center">
                      <div className="font-medium text-white">LinkedIn (connected)</div>
                    </div>
                    {selectedPlatforms.includes('linkedin') && (
                      <div className="absolute bottom-2 right-2">
                        <FiCheck className="w-5 h-5 text-[#8F42FF]" />
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
                        ? 'border-[#8F42FF] bg-[#2E0A4F]'
                        : 'border-white/20 bg-[#18042A] hover:border-white/40'
                    }`}
                  >
                    <div className="text-center">
                      <div className="font-medium text-white">Google Ads (connected)</div>
                    </div>
                    {selectedPlatforms.includes('googleads') && (
                      <div className="absolute bottom-2 right-2">
                        <FiCheck className="w-5 h-5 text-[#8F42FF]" />
                      </div>
                    )}
                  </button>
                </div>

                <div className="mt-4 text-sm text-white/60">
                  Selected platforms: {selectedPlatforms.length > 0 ? selectedPlatforms.join(', ') : 'None'}
                </div>
              </div>
            </div>

            {/* Additional Context Section */}
            <div className="bg-[#2E0A4F] rounded-lg p-8 mb-6">
              <h3 className="text-xl font-semibold mb-2 text-white">Additional Context</h3>
              
              <div className="flex gap-4">
                <textarea
                  placeholder="Enter any additional details you would like the ad to include (phone number, hours, location, etc.)"
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  className="flex-1 bg-[#18042A] border border-white/20 rounded-lg px-4 py-3 text-white placeholder-white/50 focus:outline-none focus:border-[#8F42FF] transition-colors min-h-[100px] resize-vertical"
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
                          : 'bg-[#8F42FF] hover:bg-[#701CC0]'
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
                    onClick={() => {
                      setAdditionalContext('');
                      setContextActive(false);
                      setContextSaved(false);
                    }}
                    className="font-medium px-6 py-3 rounded-lg bg-gray-600 hover:bg-gray-700 text-white transition-colors duration-200 self-start"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>

            {/* Content Generation Preview Panels */}
            {selectedPlatforms.map((platform) => (
              <div key={platform} className="bg-[#2E0A4F] rounded-lg p-8 mb-6">
                <h3 className="text-xl font-semibold mb-2 text-white">
                  {formatPlatformName(platform)} Content Preview
                </h3>
                
                <div className="flex gap-4 mb-6">
                  <button
                    onClick={() => handleGenerateContent(platform, 'caption')}
                    disabled={isGenerating[platform]?.caption}
                    className={`font-medium px-6 py-3 rounded-lg transition-colors duration-200 flex items-center gap-2 ${
                      isGenerating[platform]?.caption 
                        ? 'bg-gray-500 cursor-not-allowed' 
                        : 'bg-[#8F42FF] hover:bg-[#701CC0]'
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
                        : 'bg-[#8F42FF] hover:bg-[#701CC0]'
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
                <div className="bg-[#18042A] border border-white/20 rounded-lg p-6 mb-6">
                  <h4 className="text-lg font-semibold mb-4 text-white">Media Preview</h4>
                  <div className="bg-[#2E0A4F] rounded-lg p-4 text-center h-64 flex items-center justify-center">
                    {generatedContent[platform]?.image ? (
                      <img 
                        src={generatedContent[platform].image} 
                        alt={`Generated ${platform} ad image`}
                        className="max-w-full max-h-full object-contain"
                      />
                    ) : (
                      <p className="text-white/70">(Placeholder for generated media)</p>
                    )}
                  </div>
                </div>

                {/* Generated Caption Section */}
                <div className="bg-[#18042A] border border-white/20 rounded-lg p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="text-lg font-semibold text-white">Generated Caption</h4>
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
                  <div className="bg-[#2E0A4F] rounded-lg p-4">
                    {generatedContent[platform]?.caption ? (
                      <p className="text-white/90 text-sm whitespace-pre-wrap">
                        {generatedContent[platform].caption}
                      </p>
                    ) : (
                      <p className="text-white/70 text-sm">
                        Generated caption for {formatPlatformName(platform)} campaign. This is a placeholder for the actual generated content.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
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
