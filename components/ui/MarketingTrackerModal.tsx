import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import Image from "next/image";

interface MarketingTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MonthlyData {
  month: number;
  attempt: number;
  meetingsSet: number;
  clientsClosed: number;
  revenue: number;
  attemptsToMeetingsPct?: number;
  meetingsToClientsPct?: number;
}

interface YearlySummaryData {
  totalAttempt: number;
  totalMeetingsSet: number;
  totalClientsLosed: number;
  totalRevenue: number;
  attemptsToMeetingsPct: number;
  meetingsToClientsPct: number;
}

const months = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
];

const MarketingTrackerModal: React.FC<MarketingTrackerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [data, setData] = useState<MonthlyData[]>([]);
  const [originalData, setOriginalData] = useState<MonthlyData[]>([]);
  const [yearlySummaryData, setYearlySummaryData] = useState<YearlySummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [currentMonth] = useState(new Date().getMonth() + 1);

  useEffect(() => {
    if (isOpen) {
      fetchData();
      fetchYearlySummary();
    }
  }, [isOpen]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/marketing-tracker');
      if (response.ok) {
        const result = await response.json();
        setData(result);
        setOriginalData(result);
        setHasUnsavedChanges(false);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchYearlySummary = async () => {
    try {
      const response = await fetch('/api/marketing-tracker/yearly-summary');
      if (response.ok) {
        const result = await response.json();
        setYearlySummaryData(result);
      }
    } catch (error) {
      console.error('Failed to fetch yearly summary:', error);
    }
  };

  const updateData = (month: number, field: keyof MonthlyData, value: number) => {
    // Only allow editing current month
    if (month !== currentMonth) {
      return;
    }

    // Update local state immediately
    setData(prev => prev.map(item => 
      item.month === month 
        ? { ...item, [field]: value }
        : item
    ));
    setHasUnsavedChanges(true);
  };

  const saveChanges = async () => {
    setSaving(true);
    try {
      // Find the current month's data
      const currentMonthData = data.find(item => item.month === currentMonth);
      if (!currentMonthData) return;

      // Save each field for the current month
      const fields = ['attempt', 'meetingsSet', 'clientsClosed', 'revenue'] as const;
      
      for (const field of fields) {
        await fetch('/api/marketing-tracker', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            month: currentMonth, 
            field, 
            value: currentMonthData[field] 
          })
        });
      }

      // Refresh data and yearly summary
      await fetchData();
      await fetchYearlySummary();
      
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Failed to save changes:', error);
    } finally {
      setSaving(false);
    }
  };

  const discardChanges = () => {
    setData(originalData);
    setHasUnsavedChanges(false);
  };

  const calculatePercentage = (numerator: number, denominator: number) => {
    if (denominator === 0) return 0;
    return Math.round(((numerator + denominator)/2) * 100);
  };

  const calculateYearlySummary = () => {
    return data.reduce((acc, month) => {
      acc.attempt += month.attempt;
      acc.meetingsSet += month.meetingsSet;
      acc.clientsClosed += month.clientsClosed;
      acc.revenue += month.revenue;
      return acc;
    }, { attempt: 0, meetingsSet: 0, clientsClosed: 0, revenue: 0 });
  };

  const getMonthData = (monthIndex: number) => {
    return data.find(d => d.month === monthIndex + 1) || {
      month: monthIndex + 1,
      attempt: 0,
      meetingsSet: 0,
      clientsClosed: 0,
      revenue: 0,
      attemptsToMeetingsPct: 0,
      meetingsToClientsPct: 0
    };
  };

  const isEditable = (monthIndex: number) => {
    return (monthIndex + 1) === currentMonth;
  };

  const getComparisonWithPreviousMonth = (currentMonthIndex: number, field: keyof MonthlyData) => {
    if (currentMonthIndex === 0) return 'stable'; 
    
    const currentData = getMonthData(currentMonthIndex);
    const previousData = getMonthData(currentMonthIndex - 1);
    
    const currentValue = currentData[field] || 0;
    const previousValue = previousData[field] || 0;
    
    if (currentValue > previousValue) return 'increase';
    if (currentValue < previousValue) return 'decrease';
    return 'stable';
  };

  const getComparisonIcon = (comparison: string) => {
    switch (comparison) {
      case 'increase': return '▲';
      case 'decrease': return '▼';
      default: return '■';
    }
  };

  const getComparisonColor = (comparison: string) => {
    switch (comparison) {
      case 'increase': return 'text-green-400';
      case 'decrease': return 'text-red-400';
      default: return 'text-yellow-400';
    }
  };

  const getComparisonBoxStyle = (monthIndex: number, field: keyof MonthlyData) => {
    const comparison = getComparisonWithPreviousMonth(monthIndex, field);
    
    switch (comparison) {
      case 'increase': return 'border-l-4 border-l-green-400 bg-green-900/10';
      case 'decrease': return 'border-l-4 border-l-red-400 bg-red-900/10';
      default: return 'border-l-4 border-l-yellow-400 bg-yellow-900/10';
    }
  };

  if (!isOpen) return null;

  const yearlySummary = calculateYearlySummary();

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] p-4 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-[#2E0A4F] via-[#3D1A78] to-[#1a0633] rounded-lg w-full max-w-6xl max-h-[90vh] overflow-auto shadow-2xl border border-purple-500/20">
        <div className="flex items-center justify-between p-6 border-b border-purple-500/20">
          <div className="flex items-center gap-3">
            <Image
              src="/assets/vierra-logo.png"
              alt="Vierra Logo"
              width={32}
              height={32}
              className="h-8 w-auto"
            />
            <h2 className="text-xl font-bold text-white">Marketing Tracker</h2>
          </div>
          <div className="flex items-center gap-3">
            {hasUnsavedChanges && (
              <div className="flex items-center gap-2">
                <button
                  onClick={discardChanges}
                  className="px-4 py-2 text-sm bg-gray-600 hover:bg-gray-700 text-white rounded-md transition-colors"
                  disabled={saving}
                >
                  Discard
                </button>
                <button
                  onClick={saveChanges}
                  disabled={saving}
                  className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-md transition-colors disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}
            <button
              onClick={onClose}
              className="text-white/70 hover:text-white transition-colors p-1"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="p-6 text-center text-white">Loading...</div>
        ) : (
          <div className="p-6 space-y-8">
            {hasUnsavedChanges && (
              <div className="bg-yellow-900/20 border border-yellow-500/20 rounded-lg p-3 text-center">
                <span className="text-yellow-300 text-sm font-medium">
                  You have unsaved changes. Don't forget to save!
                </span>
              </div>
            )}

            <div className="space-y-6">
              <div className="grid grid-cols-7 gap-3">
                <div className="text-white/70 font-medium text-sm"></div>
                {months.slice(0, 6).map((month, index) => (
                  <div key={month} className={`p-3 text-center text-sm font-bold rounded-md ${
                    isEditable(index) ? 'bg-green-600' : 'bg-black'
                  } text-white`}>
                    {month}
                    {isEditable(index) && <div className="text-xs text-green-200">Editable</div>}
                  </div>
                ))}
              </div>

              <div className="space-y-4">
                {(['attempt', 'meetingsSet', 'clientsClosed', 'revenue'] as const).map(field => (
                  <div key={field} className="grid grid-cols-7 gap-3 items-center">
                    <div className="text-white font-medium text-sm capitalize">
                      {field === 'meetingsSet' ? 'Meetings Set' : 
                       field === 'clientsClosed' ? 'Clients Closed' : field}
                    </div>
                    {months.slice(0, 6).map((month, index) => {
                      const monthData = getMonthData(index);
                      const editable = isEditable(index);
                      const comparisonStyle = getComparisonBoxStyle(index, field);
                      
                      return (
                        <div key={month} className={comparisonStyle}>
                          <input
                            type="number"
                            value={monthData[field] || ''}
                            onChange={(e) => updateData(monthData.month, field, parseFloat(e.target.value) || 0)}
                            disabled={!editable || saving}
                            className={`w-full border rounded-md px-3 py-2 text-center text-sm focus:outline-none focus:ring-1 bg-transparent ${
                              editable && !saving
                                ? 'border-green-500/30 text-white focus:border-green-400 focus:ring-green-400' 
                                : 'border-gray-600/50 text-gray-400 cursor-not-allowed'
                            }`}
                            placeholder={field === 'revenue' ? '$0' : '0'}
                          />
                        </div>
                      );
                    })}
                  </div>
                ))}

                <div className="grid grid-cols-7 gap-3 items-center">
                  <div className="text-white/70 font-medium text-sm">Attempts To Meetings %</div>
                  {months.slice(0, 6).map((month, index) => {
                    const monthData = getMonthData(index);
                    return (
                      <div key={month} className="bg-purple-800/30 p-2 text-center text-white/90 text-sm rounded-md">
                        {calculatePercentage(monthData.meetingsSet, monthData.attempt)}%
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-7 gap-3 items-center">
                  <div className="text-white/70 font-medium text-sm">Meetings To Clients %</div>
                  {months.slice(0, 6).map((month, index) => {
                    const monthData = getMonthData(index);
                    return (
                      <div key={month} className="bg-purple-800/30 p-2 text-center text-white/90 text-sm rounded-md">
                        {calculatePercentage(monthData.clientsClosed, monthData.meetingsSet)}%
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="grid grid-cols-7 gap-3">
                <div className="text-white/70 font-medium text-sm"></div>
                {months.slice(6).map((month, index) => {
                  const monthIndex = index + 6;
                  return (
                    <div key={month} className={`p-3 text-center text-sm font-bold rounded-md ${
                      isEditable(monthIndex) ? 'bg-green-600' : 'bg-black'
                    } text-white`}>
                      {month}
                      {isEditable(monthIndex) && <div className="text-xs text-green-200">Editable</div>}
                    </div>
                  );
                })}
              </div>

              <div className="space-y-4">
                {(['attempt', 'meetingsSet', 'clientsClosed', 'revenue'] as const).map(field => (
                  <div key={field} className="grid grid-cols-7 gap-3 items-center">
                    <div className="text-white font-medium text-sm capitalize">
                      {field === 'meetingsSet' ? 'Meetings Set' : 
                       field === 'clientsClosed' ? 'Clients Closed' : field}
                    </div>
                    {months.slice(6).map((month, index) => {
                      const monthIndex = index + 6;
                      const monthData = getMonthData(monthIndex);
                      const editable = isEditable(monthIndex);
                      const comparisonStyle = getComparisonBoxStyle(monthIndex, field);
                      
                      return (
                        <div key={month} className={comparisonStyle}>
                          <input
                            type="number"
                            value={monthData[field] || ''}
                            onChange={(e) => updateData(monthData.month, field, parseFloat(e.target.value) || 0)}
                            disabled={!editable || saving}
                            className={`w-full border rounded-md px-3 py-2 text-center text-sm focus:outline-none focus:ring-1 bg-transparent ${
                              editable && !saving
                                ? 'border-green-500/30 text-white focus:border-green-400 focus:ring-green-400' 
                                : 'border-gray-600/50 text-gray-400 cursor-not-allowed'
                            }`}
                            placeholder={field === 'revenue' ? '$0' : '0'}
                          />
                        </div>
                      );
                    })}
                  </div>
                ))}

                <div className="grid grid-cols-7 gap-3 items-center">
                  <div className="text-white/70 font-medium text-sm">Attempts To Meetings %</div>
                  {months.slice(6).map((month, index) => {
                    const monthIndex = index + 6;
                    const monthData = getMonthData(monthIndex);
                    return (
                      <div key={month} className="bg-purple-800/30 p-2 text-center text-white/90 text-sm rounded-md">
                        {calculatePercentage(monthData.meetingsSet, monthData.attempt)}%
                      </div>
                    );
                  })}
                </div>

                <div className="grid grid-cols-7 gap-3 items-center">
                  <div className="text-white/70 font-medium text-sm">Meetings To Clients %</div>
                  {months.slice(6).map((month, index) => {
                    const monthIndex = index + 6;
                    const monthData = getMonthData(monthIndex);
                    return (
                      <div key={month} className="bg-purple-800/30 p-2 text-center text-white/90 text-sm rounded-md">
                        {calculatePercentage(monthData.clientsClosed, monthData.meetingsSet)}%
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Yearly Summary */}
            <div className="bg-purple-900/20 border border-purple-500/20 rounded-lg p-6">
              <h3 className="text-lg font-bold mb-6 text-white">YEARLY SUMMARY</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-red-400 font-bold">ATTEMPT</span>
                    <span className="text-white font-bold">{yearlySummaryData?.totalAttempt || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-green-400 font-bold">MEETINGS SET</span>
                    <span className="text-white font-bold">{yearlySummaryData?.totalMeetingsSet || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-blue-400 font-bold">CLIENTS CLOSED</span>
                    <span className="text-white font-bold">{yearlySummaryData?.totalClientsLosed || 0}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white font-bold">REVENUE</span>
                    <span className="text-white font-bold">${yearlySummaryData?.totalRevenue?.toLocaleString() || '0'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white font-bold">ATTEMPTS TO MEETING %</span>
                    <span className="text-white font-bold">{yearlySummaryData?.attemptsToMeetingsPct || 0}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white font-bold">MEETING TO CLIENT %</span>
                    <span className="text-white font-bold">{yearlySummaryData?.meetingsToClientsPct || 0}%</span>
                  </div>
                </div>

                {/* Comparisons With Previous Month */}
                <div className="bg-purple-800/20 border border-purple-500/10 rounded-lg p-4">
                  <h4 className="text-white font-bold text-center mb-4">Legend</h4>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 border-l-4 border-l-green-400 bg-green-900/10"></div>
                      <span className="text-white/80 text-sm">Increase from previous month</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 border-l-4 border-l-yellow-400 bg-yellow-900/10"></div>
                      <span className="text-white/80 text-sm">Stable (no change)</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-4 h-4 border-l-4 border-l-red-400 bg-red-900/10"></div>
                      <span className="text-white/80 text-sm">Decrease from previous month</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketingTrackerModal;