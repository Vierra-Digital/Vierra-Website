import React, { useState } from "react"
import { Inter } from "next/font/google"
const inter = Inter({ subsets: ["latin"] })

export default function ProjectManagement() {
  const [team, setTeam] = useState<string>("Design")

  return (
    <div className={`w-full h-full bg-white text-[#111014] flex flex-col ${inter.className}`}>
        <div className="flex-1 flex justify-center px-6 pt-2">
            <div className="w-full max-w-6xl flex flex-col h-full">
                <div className="w-full flex justify-between items-center mb-2">
                    <div>
                        <h1 className="text-2xl font-semibold text-[#111827] mt-6 mb-6">{team} Project Tasks</h1>
                    </div>
                    <div>
                        <label htmlFor="team-select" className="sr-only">Select team</label>
                        <select
                            id="team-select"
                            value={team}
                            onChange={(e) => setTeam(e.target.value)}
                            className="w-48 p-2 border border-[#D1D5DB] rounded bg-white text-sm text-[#111827]"
                        >
                            <option value="Design">Design</option>
                            <option value="Development">Development</option>
                            <option value="Outreach">Outreach</option>
                            <option value="Leadership">Leadership</option>
                        </select>
                    </div>
                </div>

                <div className="mt-6">
                    {/* Tasks table with status columns */}
                    <div className="overflow-x-auto w-full pr-6">
                        <table className="min-w-full text-left border-separate border-spacing-y-3">
                            <thead>
                                <tr className="bg-[#F8F0FF] text-black text-sm">
                                    <th className="px-6 py-3 font-semibold text-sm">Not Started</th>
                                    <th className="px-6 py-3 font-semibold text-sm">Ongoing</th>
                                    <th className="px-6 py-3 font-semibold text-sm">Under Review</th>
                                    <th className="px-6 py-3 font-semibold text-sm">Completed</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td className="px-4 py-6 text-sm text-gray-500" colSpan={4}>No tasks yet</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    </div>
  )
}
