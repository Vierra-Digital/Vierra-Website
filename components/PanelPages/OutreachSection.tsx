import React, { useState, useEffect } from "react"
import { Inter } from "next/font/google"
import Image from "next/image"
const inter = Inter({ subsets: ["latin"] })

const OutreachSection = () => {
    return (
        <div className="w-full h-full bg-[#F8F0FF] p-8 overflow-y-auto">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <h1 className="text-2xl font-semibold text-[#111827]">Dashboard</h1>
                    <select className="border border-[#D1D5DB] rounded-lg px-3 py-2 text-sm bg-white">
                        <option>September</option>
                    </select>
                </div>
                {/* Social Media Platforms Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                    {/* LinkedIn */}
                    <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB] overflow-hidden">
                        <div className="bg-[#D1F0FF] text-black text-center py-3 rounded-t-lg rounded-b-[10px] mx-2 mt-2 mb-4">
                            <h3 className="font-medium flex items-center justify-center gap-2">
                                <Image src="/assets/Socials/LinkedIn.png" alt="LinkedIn" width={20} height={20} className="w-5 h-5" />
                                LinkedIn
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Attempts</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>0</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Meetings Set</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>0</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Clients Closed</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>0</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Revenue</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>$0</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Attempts to Meetings %</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>0%</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Meetings to Clients %</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>0%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Instagram */}
                    <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB] overflow-hidden">
                        <div className="bg-[#D1F0FF] text-black text-center py-3 rounded-t-lg rounded-b-[10px] mx-2 mt-2 mb-4">
                            <h3 className="font-medium flex items-center justify-center gap-2">
                                <Image src="/assets/Socials/Instagram.png" alt="Instagram" width={20} height={20} className="w-5 h-5" />
                                Instagram
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Attempts</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>0</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Meetings Set</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>0</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Clients Closed</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>0</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Revenue</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>$0</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Attempts to Meetings %</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>0%</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Meetings to Clients %</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>0%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Facebook */}
                    <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB] overflow-hidden">
                        <div className="bg-[#D1F0FF] text-black text-center py-3 rounded-t-lg rounded-b-[10px] mx-2 mt-2 mb-4">
                            <h3 className="font-medium flex items-center justify-center gap-2">
                                <Image src="/assets/Socials/Facebook.png" alt="Facebook" width={20} height={20} className="w-5 h-5" />
                                Facebook
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Attempts</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>0</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Meetings Set</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>0</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Clients Closed</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>0</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Revenue</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>$0</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Attempts to Meetings %</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>0%</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Meetings to Clients %</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>0%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                {/* Additional Outreach Methods */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                    {/* Cold Call */}
                    <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB] overflow-hidden">
                        <div className="bg-[#FBD3FF] text-black text-center py-3 rounded-t-lg rounded-b-[10px] mx-2 mt-2 mb-4">
                            <h3 className="font-medium flex items-center justify-center gap-2">
                                <Image src="/assets/Outreach/ColdCall.png" alt="Cold Call" width={20} height={20} className="w-5 h-5" />
                                Cold Call
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Attempts</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>0</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Meetings Set</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>0</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Clients Closed</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>0</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Revenue</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>$0</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Attempts to Meetings %</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>0%</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Meetings to Clients %</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>0%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Cold Mail */}
                    <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB] overflow-hidden">
                        <div className="bg-[#FBD3FF] text-black text-center py-3 rounded-t-lg rounded-b-[10px] mx-2 mt-2 mb-4">
                            <h3 className="font-medium flex items-center justify-center gap-2">
                                <Image src="/assets/Outreach/ColdMail.png" alt="Cold Mail" width={20} height={20} className="w-5 h-5" />
                                Cold Mail
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Attempts</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>0</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Meetings Set</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>0</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Clients Closed</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>0</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Revenue</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>$0</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Attempts to Meetings %</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>0%</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Meetings to Clients %</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>0%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Cold Messaging */}
                    <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB] overflow-hidden">
                        <div className="bg-[#FBD3FF] text-black text-center py-3 rounded-t-lg rounded-b-[10px] mx-2 mt-2 mb-4">
                            <h3 className="font-medium flex items-center justify-center gap-2">
                                <Image src="/assets/Outreach/ColdMessage.png" alt="Cold Messaging" width={20} height={20} className="w-5 h-5" />
                                Cold Messaging
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Attempts</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>0</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Meetings Set</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>0</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Clients Closed</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>0</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Revenue</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>$0</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Attempts to Meetings %</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>0%</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Meetings to Clients %</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>0%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                {/* Final Row */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                    {/* Walk In Networking */}
                    <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB] overflow-hidden">
                        <div className="bg-[#D3FFD6] text-black text-center py-3 rounded-t-lg rounded-b-[10px] mx-2 mt-2 mb-4">
                            <h3 className="font-medium flex items-center justify-center gap-2">
                                <Image src="/assets/Outreach/WalkInNetworking.png" alt="Walk In Networking" width={20} height={20} className="w-5 h-5" />
                                Walk In Networking
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Attempts</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>0</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Meetings Set</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>0</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Clients Closed</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>0</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Revenue</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>$0</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Attempts to Meetings %</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>0%</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Meetings to Clients %</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>0%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Auto Responder */}
                    <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB] overflow-hidden">
                        <div className="bg-[#D3FFD6] text-black text-center py-3 rounded-t-lg rounded-b-[10px] mx-2 mt-2 mb-4">
                            <h3 className="font-medium flex items-center justify-center gap-2">
                                <Image src="/assets/Outreach/AutoResponder.png" alt="Auto Responder" width={20} height={20} className="w-5 h-5" />
                                Auto Responder
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Attempts</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>0</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Meetings Set</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>0</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Clients Closed</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>0</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Revenue</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>$0</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Attempts to Meetings %</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>0%</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Meetings to Clients %</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>0%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    {/* Cold (Other) */}
                    <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB] overflow-hidden">
                        <div className="bg-[#D3FFD6] text-black text-center py-3 rounded-t-lg rounded-b-[10px] mx-2 mt-2 mb-4">
                            <h3 className="font-medium flex items-center justify-center gap-2">
                                <Image src="/assets/Outreach/Other.png" alt="Cold (Other)" width={20} height={20} className="w-5 h-5" />
                                Cold (Other)
                            </h3>
                        </div>
                        <div className="p-6">
                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Attempts</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>0</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Meetings Set</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>0</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Clients Closed</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>0</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Revenue</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>$0</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Attempts to Meetings %</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>0%</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-sm text-[#6B7280]">Meetings to Clients %</span>
                                    <span className={`text-sm font-bold text-black ${inter.className}`}>0%</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                {/* Summary Section */}
                <div className="bg-white rounded-lg shadow-sm border border-[#E5E7EB] overflow-hidden">
                    <div className="bg-[#3B82F6] text-white text-center py-3">
                        <h3 className="font-medium">SUMMARY</h3>
                    </div>
                    <div className="p-6">
                        <div className="space-y-4">
                            <div className="flex justify-between">
                                <span className="text-sm text-[#6B7280]">Attempts</span>
                                <span className={`text-sm font-bold text-black ${inter.className}`}>0</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-[#6B7280]">Meetings Set</span>
                                <span className={`text-sm font-bold text-black ${inter.className}`}>0</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-[#6B7280]">Clients Closed</span>
                                <span className={`text-sm font-bold text-black ${inter.className}`}>0</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-[#6B7280]">Revenue</span>
                                <span className={`text-sm font-bold text-black ${inter.className}`}>$0</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-[#6B7280]">Attempts to Meetings %</span>
                                <span className={`text-sm font-bold text-black ${inter.className}`}>0%</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-sm text-[#6B7280]">Meetings to Clients %</span>
                                <span className={`text-sm font-bold text-black ${inter.className}`}>0%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
export default OutreachSection;