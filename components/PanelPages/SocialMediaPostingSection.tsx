import React, { useState, useEffect } from "react";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

interface Client {
  id: string;
  name: string;
  email: string;
  businessName: string;
  onboardingSessions: {
    id: string;
    tokens: {
      platform: string;
      accessToken: string;
    }[];
  }[];
}

const SocialMediaPostingSection: React.FC = () => {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [message, setMessage] = useState("Hello World");
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    fetchClientsWithSocialConnections();
  }, []);

  const fetchClientsWithSocialConnections = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/admin/clients-with-social");
      if (response.ok) {
        const data = await response.json();
        setClients(data);
      } else {
        setStatus("Failed to fetch clients");
      }
    } catch (error) {
      setStatus("Error fetching clients");
      console.error("Error fetching clients:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleClientSelect = (client: Client) => {
    setSelectedClient(client);
    // Reset platform selection when client changes
    setSelectedPlatforms([]);
    setStatus("");
  };

  const handlePlatformToggle = (platform: string) => {
    setSelectedPlatforms(prev => 
      prev.includes(platform) 
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  const postToSocialMedia = async () => {
    if (!selectedClient || selectedPlatforms.length === 0) {
      setStatus("Please select a client and at least one platform");
      return;
    }

    setPosting(true);
    setStatus("Posting to social media...");

    try {
      const response = await fetch("/api/social-media/post", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientId: selectedClient.id,
          platforms: selectedPlatforms,
          message: message,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setStatus(`Successfully posted to: ${result.successful.join(", ")}`);
        if (result.failed.length > 0) {
          setStatus(prev => prev + ` | Failed: ${result.failed.join(", ")}`);
        }
      } else {
        const error = await response.json();
        setStatus(`Error: ${error.message}`);
      }
    } catch (error) {
      setStatus("Error posting to social media");
      console.error("Error posting:", error);
    } finally {
      setPosting(false);
    }
  };

  const getConnectedPlatforms = (client: Client) => {
    const platforms: string[] = [];
    client.onboardingSessions.forEach(session => {
      session.tokens.forEach(token => {
        if (!platforms.includes(token.platform)) {
          platforms.push(token.platform);
        }
      });
    });
    return platforms;
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className={`text-2xl font-bold text-gray-900 mb-2 ${inter.className}`}>
          Social Media Posting
        </h1>
        <p className="text-gray-600">
          Select a client and post to their connected social media accounts
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7A13D0]"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Client Selection */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className={`text-lg font-semibold text-gray-900 mb-4 ${inter.className}`}>
              Select Client
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {clients.map((client) => {
                const connectedPlatforms = getConnectedPlatforms(client);
                return (
                  <div
                    key={client.id}
                    onClick={() => handleClientSelect(client)}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedClient?.id === client.id
                        ? "border-[#7A13D0] bg-purple-50"
                        : "border-gray-200 hover:border-gray-300"
                    }`}
                  >
                    <h3 className="font-medium text-gray-900">{client.name}</h3>
                    <p className="text-sm text-gray-600">{client.businessName}</p>
                    <p className="text-xs text-gray-500">{client.email}</p>
                    <div className="mt-2">
                      <span className="text-xs text-gray-500">Connected platforms:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {connectedPlatforms.map((platform) => (
                          <span
                            key={platform}
                            className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded"
                          >
                            {platform}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Platform Selection */}
          {selectedClient && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className={`text-lg font-semibold text-gray-900 mb-4 ${inter.className}`}>
                Select Platforms
              </h2>
              <div className="flex flex-wrap gap-3">
                {getConnectedPlatforms(selectedClient).map((platform) => (
                  <label
                    key={platform}
                    className="flex items-center space-x-2 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPlatforms.includes(platform)}
                      onChange={() => handlePlatformToggle(platform)}
                      className="rounded border-gray-300 text-[#7A13D0] focus:ring-[#7A13D0]"
                    />
                    <span className="text-sm font-medium text-gray-900 capitalize">
                      {platform}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Message Input */}
          {selectedClient && selectedPlatforms.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className={`text-lg font-semibold text-gray-900 mb-4 ${inter.className}`}>
                Message
              </h2>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Enter your message..."
                rows={4}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#7A13D0] focus:border-transparent text-black"
              />
            </div>
          )}

          {/* Post Button */}
          {selectedClient && selectedPlatforms.length > 0 && (
            <div className="flex justify-center">
              <button
                onClick={postToSocialMedia}
                disabled={posting || !message.trim()}
                className={`px-6 py-3 bg-[#7A13D0] text-white rounded-lg font-medium hover:bg-[#6B11B8] transition ${
                  posting || !message.trim() ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                {posting ? "Posting..." : "Post to Social Media"}
              </button>
            </div>
          )}

          {/* Status */}
          {status && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-blue-800">{status}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SocialMediaPostingSection;
