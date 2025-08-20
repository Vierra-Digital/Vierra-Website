import React, { useState } from "react";
import { X } from "lucide-react";
import Image from "next/image";

interface MarketingTrackerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface MonthlyData {
  attempt: number;
  meetingsSet: number;
  clientsClosed: number;
  revenue: number;
}

const months = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'
];

const MarketingTrackerModal: React.FC<MarketingTrackerModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [data, setData] = useState<{ [month: string]: MonthlyData }>(() => {
    const initialData: { [month: string]: MonthlyData } = {};
    months.forEach(month => {
      initialData[month] = {
        attempt: 0,
        meetingsSet: 0,
        clientsClosed: 0,
        revenue: 0
      };
    });
    return initialData;
  });

  if (!isOpen) return null;

  const updateData = (month: string, field: keyof MonthlyData, value: number) => {
    setData(prev => ({
      ...prev,
      [month]: {
        ...prev[month],
        [field]: value
      }
    }));
  };

  const calculatePercentage = (numerator: number, denominator: number) => {
    if (denominator === 0) return 0;
    return Math.round((numerator / denominator) * 100);
  };

  const calculateYearlySummary = () => {
    const totals = months.reduce((acc, month) => {
      acc.attempt += data[month].attempt;
      acc.meetingsSet += data[month].meetingsSet;
      acc.clientsClosed += data[month].clientsClosed;
      acc.revenue += data[month].revenue;
      return acc;
    }, { attempt: 0, meetingsSet: 0, clientsClosed: 0, revenue: 0 });

    return {
      ...totals,
      attemptToMeetingPercent: calculatePercentage(totals.meetingsSet, totals.attempt),
      meetingToClientPercent: calculatePercentage(totals.clientsClosed, totals.meetingsSet)
    };
  };

  const yearlySummary = calculateYearlySummary();

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[200] p-4 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-[#2E0A4F] via-[#3D1A78] to-[#1a0633] rounded-lg w-full max-w-6xl max-h-[90vh] overflow-auto shadow-2xl border border-purple-500/20">
        {/* Header */}
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
          <button
            onClick={onClose}
            className="text-white/70 hover:text-white transition-colors p-1"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* First Half - January to June */}
          <div className="space-y-6">
            <div className="grid grid-cols-7 gap-3">
              <div className="text-white/70 font-medium text-sm"></div>
              {months.slice(0, 6).map(month => (
                <div key={month} className="bg-black text-white p-3 text-center text-sm font-bold rounded-md">
                  {month}
                </div>
              ))}
            </div>

            {/* Data input fields for first half */}
            <div className="space-y-4">
              <div className="grid grid-cols-7 gap-3 items-center">
                <div className="text-white font-medium text-sm">Attempt</div>
                {months.slice(0, 6).map(month => (
                  <div key={month}>
                    <input
                      type="number"
                      value={data[month].attempt || ''}
                      onChange={(e) => updateData(month, 'attempt', parseInt(e.target.value) || 0)}
                      className="w-full bg-purple-900/30 border border-purple-500/30 rounded-md px-3 py-2 text-white text-center text-sm focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-3 items-center">
                <div className="text-white font-medium text-sm">Meetings Set</div>
                {months.slice(0, 6).map(month => (
                  <div key={month}>
                    <input
                      type="number"
                      value={data[month].meetingsSet || ''}
                      onChange={(e) => updateData(month, 'meetingsSet', parseInt(e.target.value) || 0)}
                      className="w-full bg-purple-900/30 border border-purple-500/30 rounded-md px-3 py-2 text-white text-center text-sm focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-3 items-center">
                <div className="text-white font-medium text-sm">Clients Closed</div>
                {months.slice(0, 6).map(month => (
                  <div key={month}>
                    <input
                      type="number"
                      value={data[month].clientsClosed || ''}
                      onChange={(e) => updateData(month, 'clientsClosed', parseInt(e.target.value) || 0)}
                      className="w-full bg-purple-900/30 border border-purple-500/30 rounded-md px-3 py-2 text-white text-center text-sm focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-3 items-center">
                <div className="text-white font-medium text-sm">Revenue</div>
                {months.slice(0, 6).map(month => (
                  <div key={month}>
                    <input
                      type="number"
                      value={data[month].revenue || ''}
                      onChange={(e) => updateData(month, 'revenue', parseFloat(e.target.value) || 0)}
                      className="w-full bg-purple-900/30 border border-purple-500/30 rounded-md px-3 py-2 text-white text-center text-sm focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
                      placeholder="$0"
                    />
                  </div>
                ))}
              </div>

              {/* Calculated percentages for first half */}
              <div className="grid grid-cols-7 gap-3 items-center">
                <div className="text-white/70 font-medium text-sm">Attempts To Meetings %</div>
                {months.slice(0, 6).map(month => (
                  <div key={month} className="bg-purple-800/30 p-2 text-center text-white/90 text-sm rounded-md">
                    {calculatePercentage(data[month].meetingsSet, data[month].attempt)}%
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-3 items-center">
                <div className="text-white/70 font-medium text-sm">Meetings To Clients %</div>
                {months.slice(0, 6).map(month => (
                  <div key={month} className="bg-purple-800/30 p-2 text-center text-white/90 text-sm rounded-md">
                    {calculatePercentage(data[month].clientsClosed, data[month].meetingsSet)}%
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Second Half - July to December */}
          <div className="space-y-6">
            <div className="grid grid-cols-7 gap-3">
              <div className="text-white/70 font-medium text-sm"></div>
              {months.slice(6).map(month => (
                <div key={month} className="bg-black text-white p-3 text-center text-sm font-bold rounded-md">
                  {month}
                </div>
              ))}
            </div>

            {/* Data input fields for second half */}
            <div className="space-y-4">
              <div className="grid grid-cols-7 gap-3 items-center">
                <div className="text-white font-medium text-sm">Attempt</div>
                {months.slice(6).map(month => (
                  <div key={month}>
                    <input
                      type="number"
                      value={data[month].attempt || ''}
                      onChange={(e) => updateData(month, 'attempt', parseInt(e.target.value) || 0)}
                      className="w-full bg-purple-900/30 border border-purple-500/30 rounded-md px-3 py-2 text-white text-center text-sm focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-3 items-center">
                <div className="text-white font-medium text-sm">Meetings Set</div>
                {months.slice(6).map(month => (
                  <div key={month}>
                    <input
                      type="number"
                      value={data[month].meetingsSet || ''}
                      onChange={(e) => updateData(month, 'meetingsSet', parseInt(e.target.value) || 0)}
                      className="w-full bg-purple-900/30 border border-purple-500/30 rounded-md px-3 py-2 text-white text-center text-sm focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-3 items-center">
                <div className="text-white font-medium text-sm">Clients Closed</div>
                {months.slice(6).map(month => (
                  <div key={month}>
                    <input
                      type="number"
                      value={data[month].clientsClosed || ''}
                      onChange={(e) => updateData(month, 'clientsClosed', parseInt(e.target.value) || 0)}
                      className="w-full bg-purple-900/30 border border-purple-500/30 rounded-md px-3 py-2 text-white text-center text-sm focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-3 items-center">
                <div className="text-white font-medium text-sm">Revenue</div>
                {months.slice(6).map(month => (
                  <div key={month}>
                    <input
                      type="number"
                      value={data[month].revenue || ''}
                      onChange={(e) => updateData(month, 'revenue', parseFloat(e.target.value) || 0)}
                      className="w-full bg-purple-900/30 border border-purple-500/30 rounded-md px-3 py-2 text-white text-center text-sm focus:border-purple-400 focus:outline-none focus:ring-1 focus:ring-purple-400"
                      placeholder="$0"
                    />
                  </div>
                ))}
              </div>

              {/* Calculated percentages for second half */}
              <div className="grid grid-cols-7 gap-3 items-center">
                <div className="text-white/70 font-medium text-sm">Attempts To Meetings %</div>
                {months.slice(6).map(month => (
                  <div key={month} className="bg-purple-800/30 p-2 text-center text-white/90 text-sm rounded-md">
                    {calculatePercentage(data[month].meetingsSet, data[month].attempt)}%
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-3 items-center">
                <div className="text-white/70 font-medium text-sm">Meetings To Clients %</div>
                {months.slice(6).map(month => (
                  <div key={month} className="bg-purple-800/30 p-2 text-center text-white/90 text-sm rounded-md">
                    {calculatePercentage(data[month].clientsClosed, data[month].meetingsSet)}%
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Yearly Summary */}
          <div className="bg-purple-900/20 border border-purple-500/20 rounded-lg p-6">
            <h3 className="text-lg font-bold mb-6 text-white">YEARLY SUMMARY</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-white font-medium">Lifetime Value:</span>
                    <span className="text-white font-bold">${yearlySummary.revenue.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-white font-medium">Retainer Pricing:</span>
                    <span className="text-white font-bold">${Math.round(yearlySummary.revenue / 12).toLocaleString()}</span>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <label className="block text-white/70 text-sm font-medium mb-2">
                      Total Attempts
                    </label>
                    <div className="bg-purple-900/30 border border-purple-500/30 rounded-md px-3 py-2 text-white">
                      {yearlySummary.attempt}
                    </div>
                  </div>
                  <div>
                    <label className="block text-white/70 text-sm font-medium mb-2">
                      Total Meetings Set
                    </label>
                    <div className="bg-purple-900/30 border border-purple-500/30 rounded-md px-3 py-2 text-white">
                      {yearlySummary.meetingsSet}
                    </div>
                  </div>
                  <div>
                    <label className="block text-white/70 text-sm font-medium mb-2">
                      Total Clients Closed
                    </label>
                    <div className="bg-purple-900/30 border border-purple-500/30 rounded-md px-3 py-2 text-white">
                      {yearlySummary.clientsClosed}
                    </div>
                  </div>
                  <div>
                    <label className="block text-white/70 text-sm font-medium mb-2">
                      Conversion Rate (Attempts → Meetings)
                    </label>
                    <div className="bg-purple-900/30 border border-purple-500/30 rounded-md px-3 py-2 text-white">
                      {yearlySummary.attemptToMeetingPercent}%
                    </div>
                  </div>
                  <div>
                    <label className="block text-white/70 text-sm font-medium mb-2">
                      Close Rate (Meetings → Clients)
                    </label>
                    <div className="bg-purple-900/30 border border-purple-500/30 rounded-md px-3 py-2 text-white">
                      {yearlySummary.meetingToClientPercent}%
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketingTrackerModal;