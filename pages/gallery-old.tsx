import React, { useState, useEffect } from "react"
import Head from "next/head"
import { Inter } from "next/font/google"
import Image from "next/image"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { FiLogOut, FiFileText, FiUsers, FiPlus, FiCheck, FiLink, FiImage, FiArrowLeft } from "react-icons/fi"
import { useSession, signOut } from "next-auth/react"
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

  useEffect(() => {
    if (status === "loading") return
    if (!session) router.replace("/login")
  }, [session, status, router])

  useEffect(() => {
    if (session) {
      loadGalleryImages()
    }
  }, [session])

  const loadGalleryImages = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/gallery/images')
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
      <div className="relative min-h-screen bg-gradient-to-br from-[#4F1488] via-[#2E0A4F] to-[#18042A] flex items-center justify-center">
        <p className="text-white text-xl">Loading...</p>
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

      <div className="relative min-h-screen bg-[#18042A] text-white flex">
        {/* Logo top-left */}
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

        {/* Sidebar */}
        <div className="w-56 bg-[#2E0A4F] h-screen flex flex-col justify-between pt-20 pb-4 px-4">
          <div className="flex flex-col space-y-2">
            <button
              onClick={() => router.push("/client")}
              className="flex items-center w-full p-2 rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors duration-200"
            >
              <FiFileText className="w-5 h-5" />
              <span className={`ml-3 text-sm font-medium ${inter.className}`}>
                Dashboard
              </span>
            </button>
            <button
              onClick={() => router.push("/connect")}
              className="flex items-center w-full p-2 rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors duration-200"
            >
              <FiLink className="w-5 h-5" />
              <span className={`ml-3 text-sm font-medium ${inter.className}`}>
                Connect
              </span>
            </button>
            <button
              onClick={() => router.push("/create-ads")}
              className="flex items-center w-full p-2 rounded text-white/70 hover:text-white hover:bg-white/10 transition-colors duration-200"
            >
              <FiPlus className="w-5 h-5" />
              <span className={`ml-3 text-sm font-medium ${inter.className}`}>
                Create Ads
              </span>
            </button>
            <button
              onClick={() => router.push("/gallery")}
              className="flex items-center w-full p-2 rounded text-white bg-white/10 transition-colors duration-200"
            >
              <FiImage className="w-5 h-5" />
              <span className={`ml-3 text-sm font-medium ${inter.className}`}>
                Gallery
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

        {/* Main content */}
        <div className="flex-1 flex flex-col">
          {/* Top bar */}
          <div className="bg-[#2E0A4F] px-6 py-4 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => router.push("/create-ads")}
                  className="flex items-center text-white/70 hover:text-white transition-colors"
                >
                  <FiArrowLeft className="w-5 h-5 mr-2" />
                  Back to Create Ads
                </button>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-white/70 text-sm">
                  {session.user?.email}
                </span>
                <div className="w-8 h-8 bg-white/10 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm font-medium">
                    {session.user?.email?.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Gallery content */}
          <div className="flex-1 p-6">
            <div className="max-w-7xl mx-auto">
              <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Image Gallery</h1>
                <p className="text-white/70">
                  View all your generated ad images organized by platform
                </p>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-white/70">Loading gallery images...</div>
                </div>
              ) : error ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-red-400">{error}</div>
                </div>
              ) : getTotalImages() === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <FiImage className="w-16 h-16 text-white/30 mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">No images yet</h3>
                  <p className="text-white/70 mb-6">Generate some ad images to see them here</p>
                  <button
                    onClick={() => router.push("/create-ads")}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg transition-colors"
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
                          ? 'bg-white text-black'
                          : 'bg-white/10 text-white/70 hover:text-white hover:bg-white/20'
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
                            ? 'bg-white text-black'
                            : 'bg-white/10 text-white/70 hover:text-white hover:bg-white/20'
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
                          className="bg-[#2E0A4F] rounded-lg overflow-hidden hover:bg-[#3A1A5F] transition-colors"
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
                            <div className="text-sm text-white/70">
                              {new Date(image.createdAt).toLocaleDateString()}
                            </div>
                            {image.urlLink && (
                              <a
                                href={image.urlLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-purple-400 hover:text-purple-300 text-sm mt-1 block"
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
