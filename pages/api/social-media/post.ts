import type { NextApiRequest, NextApiResponse } from "next";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/pages/api/auth/[...nextauth]";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/crypto";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  // Check authentication
  const session = await getServerSession(req, res, authOptions);
  if (!session) {
    return res.status(401).json({ message: "Not authenticated" });
  }

  // Only allow admin and staff roles
  const userRole = (session.user as any).role;
  if (userRole !== "admin" && userRole !== "staff") {
    return res.status(403).json({ message: "Access denied" });
  }

  const { clientId, platforms, message } = req.body;

  if (!clientId || !platforms || !Array.isArray(platforms) || platforms.length === 0 || !message) {
    return res.status(400).json({ message: "Missing required fields" });
  }

  try {
    // Get the client's onboarding session with tokens
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: {
        onboardingSessions: {
          where: {
            status: "completed",
          },
          include: {
            tokens: {
              where: {
                platform: {
                  in: platforms,
                },
              },
            },
          },
        },
      },
    });

    if (!client) {
      return res.status(404).json({ message: "Client not found" });
    }

    const results = {
      successful: [] as string[],
      failed: [] as string[],
    };

    // Process each platform
    for (const platform of platforms) {
      try {
        // Find the token for this platform
        const sessionWithToken = client.onboardingSessions.find(session =>
          session.tokens.some(token => token.platform === platform)
        );

        if (!sessionWithToken) {
          results.failed.push(`${platform}: No token found`);
          continue;
        }

        const tokenData = sessionWithToken.tokens.find(token => token.platform === platform);
        if (!tokenData) {
          results.failed.push(`${platform}: No token data`);
          continue;
        }

        const accessToken = decrypt(tokenData.accessToken);

        // Post to the specific platform
        let success = false;
        switch (platform) {
          case "facebook":
            success = await postToFacebook(accessToken, message);
            break;
          case "linkedin":
            success = await postToLinkedIn(accessToken, message);
            break;
          case "googleads":
            // Google Ads doesn't support posting, skip
            results.failed.push(`${platform}: Posting not supported`);
            continue;
          default:
            results.failed.push(`${platform}: Unsupported platform`);
            continue;
        }

        if (success) {
          results.successful.push(platform);
        } else {
          // Provide more specific error messages
          if (platform === "linkedin") {
            results.failed.push(`${platform}: Permission denied - please reconnect LinkedIn account`);
          } else {
            results.failed.push(`${platform}: Post failed`);
          }
        }
      } catch (error) {
        console.error(`Error posting to ${platform}:`, error);
        results.failed.push(`${platform}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return res.status(200).json(results);
  } catch (error) {
    console.error("Error in social media posting:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
}

async function postToFacebook(accessToken: string, message: string): Promise<boolean> {
  try {
    // First, get the user's page or profile ID
    const meResponse = await fetch(`https://graph.facebook.com/v23.0/me?access_token=${accessToken}`);
    if (!meResponse.ok) {
      console.error("Failed to get Facebook user info:", await meResponse.text());
      return false;
    }

    const meData = await meResponse.json();
    const userId = meData.id;

    // Try to post to user's timeline (this might require additional permissions)
    const postResponse = await fetch(`https://graph.facebook.com/v23.0/${userId}/feed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        message: message,
        access_token: accessToken,
      }),
    });

    if (postResponse.ok) {
      console.log("Successfully posted to Facebook");
      return true;
    } else {
      const errorText = await postResponse.text();
      console.error("Facebook post failed:", errorText);
      return false;
    }
  } catch (error) {
    console.error("Facebook posting error:", error);
    return false;
  }
}

async function postToLinkedIn(accessToken: string, message: string): Promise<boolean> {
  try {
    // Try to get the user's profile first to validate the token
    const profileResponse = await fetch("https://api.linkedin.com/v2/people/~", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (!profileResponse.ok) {
      const errorText = await profileResponse.text();
      console.error("LinkedIn profile access failed:", errorText);
      
      // If it's a permission error, the token likely needs to be refreshed with new scopes
      if (profileResponse.status === 403) {
        console.error("LinkedIn token needs to be refreshed with w_member_social scope");
        return false;
      }
      
      return false;
    }

    const profileData = await profileResponse.json();
    const personUrn = profileData.id;

    // Create a post using the UGC API
    const postData = {
      author: `urn:li:person:${personUrn}`,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: {
            text: message,
          },
          shareMediaCategory: "NONE",
        },
      },
      visibility: {
        "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC",
      },
    };

    const postResponse = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify(postData),
    });

    if (postResponse.ok) {
      console.log("Successfully posted to LinkedIn");
      return true;
    } else {
      const errorText = await postResponse.text();
      console.error("LinkedIn post failed:", errorText);
      return false;
    }
  } catch (error) {
    console.error("LinkedIn posting error:", error);
    return false;
  }
}
