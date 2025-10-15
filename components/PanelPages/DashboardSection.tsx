import React, { useState, useEffect } from "react"
import { RiArrowDropDownLine } from "react-icons/ri"
import { FiTrendingUp, FiCalendar, FiClock } from "react-icons/fi"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts'

const DashboardSection = () => {
    const [platformFilter, setPlatformFilter] = useState("Overall")
    const [monthFilter] = useState("March")
    const [activeClientsCount, setActiveClientsCount] = useState(0)
    const [loading, setLoading] = useState(true)

    // Get current month and year for default calendar
    const currentDate = new Date()
    const currentMonth = currentDate.toLocaleString('default', { month: 'long' })
    const currentYear = currentDate.getFullYear().toString()
    
    const [calendarMonth, setCalendarMonth] = useState(currentMonth)
    const [calendarYear, setCalendarYear] = useState(currentYear)

    // Generate week options dynamically
    const generateWeekOptions = () => {
        const options = []
        const today = new Date()
        const currentWeekStart = new Date(today)
        
        // Find Monday of current week
        const dayOfWeek = today.getDay()
        const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
        currentWeekStart.setDate(today.getDate() + daysToMonday)
        
        // Generate past 3 weeks, current week, and future 3 weeks
        for (let i = -3; i <= 3; i++) {
            const weekDate = new Date(currentWeekStart)
            weekDate.setDate(currentWeekStart.getDate() + (i * 7))
            
            const month = weekDate.getMonth() + 1
            const day = weekDate.getDate()
            const formattedDate = `${month.toString().padStart(2, '0')}/${day.toString().padStart(2, '0')}`
            
            let label
            if (i === 0) {
                label = "This Week"
            } else if (i < 0) {
                label = `${Math.abs(i)} Week${Math.abs(i) > 1 ? 's' : ''} Ago`
            } else {
                label = `In ${i} Week${i > 1 ? 's' : ''}`
            }
            
            options.push({
                value: formattedDate,
                label: label,
                date: formattedDate
            })
        }
        
        return options
    }

    // Fetch active clients count
    useEffect(() => {
        const fetchActiveClients = async () => {
            try {
                const response = await fetch('/api/admin/clients')
                if (response.ok) {
                    const clients = await response.json()
                    const activeCount = clients.filter((client: any) => 
                        client.status === 'completed' || client.status === 'in_progress'
                    ).length
                    setActiveClientsCount(activeCount)
                }
            } catch (error) {
                console.error('Error fetching clients:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchActiveClients()
    }, [])

    const weekOptions = generateWeekOptions()
    const currentWeekValue = weekOptions.find(option => option.label === "This Week")?.value || weekOptions[3]?.value || ""
    const [timeFilter, setTimeFilter] = useState(currentWeekValue)

    // Generate calendar days for selected month/year
    const generateCalendarDays = () => {
        const monthNames = [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"
        ]
        
        const monthIndex = monthNames.indexOf(calendarMonth)
        const year = parseInt(calendarYear)
        
        // Get first day of month and number of days
        const firstDay = new Date(year, monthIndex, 1)
        const lastDay = new Date(year, monthIndex + 1, 0)
        const daysInMonth = lastDay.getDate()
        
        // Convert Sunday=0 to Monday=0 system
        let startingDayOfWeek = firstDay.getDay()
        startingDayOfWeek = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1 // Monday=0, Sunday=6
        
        const days = []
        
        // Add empty cells for days before the first day of the month
        for (let i = 0; i < startingDayOfWeek; i++) {
            days.push(null)
        }
        
        // Add days of the month
        for (let day = 1; day <= daysInMonth; day++) {
            days.push(day)
        }
        
        return days
    }

    // Get highlighted days based on selected week
    const getHighlightedDays = () => {
        if (!timeFilter) return []
        
        // Parse the selected week date (format: MM/DD)
        const [month, day] = timeFilter.split('/').map(Number)
        const year = parseInt(calendarYear)
        
        // Create date for the Monday of the selected week
        const selectedDate = new Date(year, month - 1, day)
        
        // Check if the selected week is in the current calendar month
        const selectedMonth = selectedDate.getMonth()
        const calendarMonthIndex = ["January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December"].indexOf(calendarMonth)
        
        if (selectedMonth !== calendarMonthIndex) {
            return [] // Selected week is not in the current calendar month
        }
        
        // Get all days in the selected week (Monday to Sunday)
        const highlightedDays = []
        for (let i = 0; i < 7; i++) {
            const weekDay = new Date(selectedDate)
            weekDay.setDate(selectedDate.getDate() + i)
            
            // Only highlight days that are in the current calendar month
            if (weekDay.getMonth() === calendarMonthIndex) {
                highlightedDays.push(weekDay.getDate())
            }
        }
        
        return highlightedDays
    }

    const calendarDays = generateCalendarDays()
    const highlightedDays = getHighlightedDays()
    const platformOptions = ["Overall", "Clients", "Revenue", "Marketing"]
    const monthOptions = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ]
    const yearOptions = Array.from({ length: 5 }, (_, i) => (2022 + i).toString())

    // Sample data for charts
    const websiteVisitsData = [
        { week: "Week 1", visits: 20000 },
        { week: "Week 2", visits: 10000 },
        { week: "Week 3", visits: 22000 },
        { week: "Week 4", visits: 20000 }
    ]

    const trafficByDeviceData = [
        { device: "Linux", traffic: 18000 },
        { device: "Mac", traffic: 30000 },
        { device: "iOS", traffic: 22000 },
        { device: "Windows", traffic: 30000 },
        { device: "Android", traffic: 13000 },
        { device: "Other", traffic: 25000 }
    ]

    const outreachData = [
        { name: "Instagram", value: 52.1, color: "#6B7280" },
        { name: "Tiktok", value: 22.8, color: "#3B82F6" },
        { name: "Linkedin", value: 13.9, color: "#10B981" },
        { name: "Facebook", value: 11.2, color: "#8B5CF6" }
    ]

    const upcomingMeetings = [
        { name: "Jane Doe", email: "janed@gtech.com", date: "12/12/2025", time: "17:00 GMT", avatar: "/assets/Team/team-member-1.png" },
        { name: "Jane Doe", email: "janed@gtech.com", date: "12/12/2025", time: "17:00 GMT", avatar: "/assets/Team/team-member-1.png" },
        { name: "Jane Doe", email: "janed@gtech.com", date: "12/12/2025", time: "17:00 GMT", avatar: "/assets/Team/team-member-1.png" }
    ]

    return (
        <div className="w-full h-full bg-white text-[#111014] flex flex-col p-6 pb-16">
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-[#111827]">Dashboard</h1>
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <select 
                            value={timeFilter} 
                            onChange={(e) => setTimeFilter(e.target.value)}
                            className="appearance-none bg-white rounded-lg px-3 py-2 shadow-sm border border-gray-200 text-sm text-[#6B7280] pr-8 cursor-pointer hover:bg-gray-50"
                        >
                            {weekOptions.map((option, index) => (
                                <option key={index} value={option.value}>
                                    {option.label} - {option.date}
                                </option>
                            ))}
                        </select>
                        <RiArrowDropDownLine className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#6B7280] pointer-events-none" />
                    </div>
                    <div className="relative">
                        <select 
                            value={platformFilter} 
                            onChange={(e) => setPlatformFilter(e.target.value)}
                            className="appearance-none bg-white rounded-lg px-3 py-2 shadow-sm border border-gray-200 text-sm text-[#6B7280] pr-8 cursor-pointer hover:bg-gray-50"
                        >
                            {platformOptions.map((option, index) => (
                                <option key={index} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                        <RiArrowDropDownLine className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#6B7280] pointer-events-none" />
                    </div>
                </div>
            </div>

            {/* Main Layout */}
            <div className="flex gap-6">
                {/* Left Content */}
                <div className="flex-1">
                    {/* Metrics Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                            <div className="mb-2">
                                <h3 className="text-sm font-medium text-[#6B7280]">LEADS GENERATED</h3>
                            </div>
                            <div className="text-2xl font-bold text-green-600 mb-1">5,000</div>
                            <div className="flex items-center text-sm text-green-600">
                                <FiTrendingUp className="w-3 h-3 mr-1" />
                                8.5%
                            </div>
                        </div>

                        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                            <div className="mb-2">
                                <h3 className="text-sm font-medium text-[#6B7280]">CAMPAIGNS</h3>
                            </div>
                            <div className="text-2xl font-bold text-purple-600 mb-1">500</div>
                            <div className="flex items-center text-sm text-green-600">
                                <FiTrendingUp className="w-3 h-3 mr-1" />
                                8.5%
                            </div>
                        </div>

                        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                            <div className="mb-2">
                                <h3 className="text-sm font-medium text-[#6B7280]">CLIENTS</h3>
                            </div>
                            <div className="text-2xl font-bold text-blue-600 mb-1">
                                {loading ? "..." : activeClientsCount}
                            </div>
                            <div className="flex items-center text-sm text-green-600">
                                <FiTrendingUp className="w-3 h-3 mr-1" />
                                8.5%
                            </div>
                        </div>

                        <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                            <div className="mb-2">
                                <h3 className="text-sm font-medium text-[#6B7280]">MEETINGS</h3>
                            </div>
                            <div className="text-2xl font-bold text-orange-600 mb-1">500</div>
                            <div className="flex items-center text-sm text-green-600">
                                <FiTrendingUp className="w-3 h-3 mr-1" />
                                8.5%
                            </div>
                        </div>
                    </div>

                    {/* Website Visits Chart - Same width as metrics cards */}
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-8">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-semibold text-[#111827]">Website Visits</h3>
                            <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm border border-gray-200">
                                <span className="text-sm text-[#6B7280]">{monthFilter}</span>
                                <RiArrowDropDownLine className="w-4 h-4 text-[#6B7280]" />
                            </div>
                        </div>
                        <div className="h-80 bg-gray-50 rounded-lg p-4 shadow-inner">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={websiteVisitsData}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                    <XAxis dataKey="week" stroke="#6B7280" fontSize={12} />
                                    <YAxis stroke="#6B7280" fontSize={12} />
                                    <Tooltip 
                                        contentStyle={{ 
                                            backgroundColor: 'white', 
                                            border: '1px solid #E5E7EB', 
                                            borderRadius: '8px',
                                            fontSize: '12px'
                                        }} 
                                    />
                                    <Line 
                                        type="monotone" 
                                        dataKey="visits" 
                                        stroke="#701CC0" 
                                        strokeWidth={3}
                                        dot={{ fill: '#701CC0', strokeWidth: 2, r: 4 }}
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Bottom Row - Traffic by Device and Outreach */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Traffic by Device Chart */}
                        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-semibold text-[#111827]">Traffic by Device</h3>
                            </div>
                            <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={trafficByDeviceData}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                                        <XAxis dataKey="device" stroke="#6B7280" fontSize={12} />
                                        <YAxis stroke="#6B7280" fontSize={12} />
                                        <Tooltip 
                                            contentStyle={{ 
                                                backgroundColor: 'white', 
                                                border: '1px solid #E5E7EB', 
                                                borderRadius: '8px',
                                                fontSize: '12px'
                                            }} 
                                        />
                                        <Bar dataKey="traffic" fill="#701CC0" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        {/* Outreach Donut Chart */}
                        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-lg font-semibold text-[#111827]">Outreach</h3>
                                <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 shadow-sm border border-gray-200">
                                    <span className="text-sm text-[#6B7280]">{monthFilter}</span>
                                    <RiArrowDropDownLine className="w-4 h-4 text-[#6B7280]" />
                                </div>
                            </div>
                            <div className="flex items-center justify-center">
                                <div className="h-48 w-48">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={outreachData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={2}
                                                dataKey="value"
                                            >
                                                {outreachData.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            <div className="mt-4 space-y-2">
                                {outreachData.map((item, index) => (
                                    <div key={index} className="flex items-center justify-between text-sm">
                                        <div className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }}></div>
                                            <span className="text-[#6B7280]">{item.name}</span>
                                        </div>
                                        <span className="font-medium">{item.value}%</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Right Sidebar - Calendar and Meetings */}
                <div className="w-80 space-y-6">
                    {/* Calendar */}
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                        <div className="mb-6">
                            <h3 className="text-lg font-semibold text-[#111827] mb-4">Calendar</h3>
                            <div className="flex items-center gap-2">
                                <div className="relative">
                                    <select 
                                        value={calendarMonth} 
                                        onChange={(e) => setCalendarMonth(e.target.value)}
                                        className="appearance-none bg-white rounded-lg px-3 py-2 shadow-sm border border-gray-200 text-sm text-[#6B7280] pr-8 cursor-pointer hover:bg-gray-50"
                                    >
                                        {monthOptions.map((month, index) => (
                                            <option key={index} value={month}>
                                                {month}
                                            </option>
                                        ))}
                                    </select>
                                    <RiArrowDropDownLine className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#6B7280] pointer-events-none" />
                                </div>
                                <div className="relative">
                                    <select 
                                        value={calendarYear} 
                                        onChange={(e) => setCalendarYear(e.target.value)}
                                        className="appearance-none bg-white rounded-lg px-3 py-2 shadow-sm border border-gray-200 text-sm text-[#6B7280] pr-8 cursor-pointer hover:bg-gray-50"
                                    >
                                        {yearOptions.map((year, index) => (
                                            <option key={index} value={year}>
                                                {year}
                                            </option>
                                        ))}
                                    </select>
                                    <RiArrowDropDownLine className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#6B7280] pointer-events-none" />
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-7 gap-1 text-center text-xs">
                            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(day => (
                                <div key={day} className="p-2 text-[#6B7280] font-medium">{day}</div>
                            ))}
                            {calendarDays.map((day, index) => (
                                <div 
                                    key={index} 
                                    className={`p-2 text-sm cursor-pointer hover:bg-gray-100 rounded ${
                                        day === null ? 'invisible' : 
                                        highlightedDays.includes(day) ? 'bg-blue-500 text-white' : 'text-[#111827]'
                                    }`}
                                >
                                    {day}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Upcoming Meetings */}
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-lg font-semibold text-[#111827]">Upcoming Meetings</h3>
                        </div>
                        <div className="space-y-4">
                            {upcomingMeetings.map((meeting, index) => (
                                <div key={index} className="flex items-start gap-3 p-4 bg-gray-50 rounded-lg">
                                    <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                                        <span className="text-sm font-medium text-gray-600">JD</span>
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-sm mb-1">{meeting.name}</div>
                                        <div className="text-xs text-[#6B7280] mb-2">{meeting.email}</div>
                                        <div className="flex items-center gap-4 mb-3">
                                            <div className="flex items-center gap-1 text-xs text-[#6B7280]">
                                                <FiCalendar className="w-3 h-3" />
                                                {meeting.date}
                                            </div>
                                            <div className="flex items-center gap-1 text-xs text-[#6B7280]">
                                                <FiClock className="w-3 h-3" />
                                                {meeting.time}
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <button className="w-full px-3 py-2 text-xs bg-white text-[#701CC0] border border-[#701CC0] rounded hover:bg-[#701CC0] hover:text-white transition">
                                                Send Reminder
                                            </button>
                                            <button className="w-full px-3 py-2 text-xs bg-[#701CC0] text-white rounded hover:bg-[#5f17a5] transition">
                                                Join Meeting
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default DashboardSection;