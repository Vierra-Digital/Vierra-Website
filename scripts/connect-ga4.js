/**
 * Saves GA4_OAUTH_REFRESH_TOKEN to .env for the panel Website Visits chart.
 * Requires GOOGLE_CLIENT_ID/SECRET and redirect URIs http://127.0.0.1:3939/ + http://localhost:3939/
 */
require("dotenv").config()
const { google } = require("googleapis")
const fs = require("fs")
const http = require("http")
const path = require("path")
const { execSync } = require("child_process")

const REDIRECT_URI = "http://127.0.0.1:3939/"
const SCOPE = "https://www.googleapis.com/auth/analytics.readonly"

function saveEnv(key, value) {
  const envPath = path.join(process.cwd(), ".env")
  let env = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : ""
  const line = `${key}=${JSON.stringify(value)}`
  env = new RegExp(`^${key}=`, "m").test(env)
    ? env.replace(new RegExp(`^${key}=.*$`, "m"), line)
    : (env.trimEnd() ? env.trimEnd() + "\n" : "") + line + "\n"
  fs.writeFileSync(envPath, env.endsWith("\n") ? env : env + "\n")
}

async function main() {
  const clientId = (process.env.GOOGLE_CLIENT_ID || "").trim()
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || "").trim()
  if (!clientId || !clientSecret) throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET required")

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI)
  const authUrl = oauth2.generateAuthUrl({
    access_type: "offline",
    scope: [SCOPE, "email"],
    prompt: "consent",
  })

  await new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const code = new URL(req.url || "/", REDIRECT_URI).searchParams.get("code")
      if (!code) {
        res.statusCode = 404
        res.end("Not found")
        return
      }
      const { tokens } = await oauth2.getToken(code)
      oauth2.setCredentials(tokens)
      res.end("GA4 connected. Return to the terminal.")
      server.close()
      resolve(undefined)
    })
    server.listen(3939, "127.0.0.1", () => {
      console.log("Open in browser:\n", authUrl, "\n")
      try {
        execSync(`open ${JSON.stringify(authUrl)}`, { stdio: "ignore" })
      } catch {}
    })
    setTimeout(() => reject(new Error("Timed out (5 min)")), 5 * 60 * 1000)
  })

  if (!oauth2.credentials.refresh_token) {
    console.log("No refresh_token — revoke Vierra at https://myaccount.google.com/permissions and re-run.")
    return
  }
  saveEnv("GA4_OAUTH_REFRESH_TOKEN", oauth2.credentials.refresh_token)
  console.log("Saved GA4_OAUTH_REFRESH_TOKEN")

  const admin = google.analyticsadmin({ version: "v1beta", auth: oauth2 })
  const res = await admin.accountSummaries.list({ pageSize: 200 })
  console.log("\nSet GA4_PROPERTY_ID to one of these (numeric property ID):")
  for (const acct of res.data.accountSummaries || []) {
    for (const prop of acct.propertySummaries || []) {
      const id = String(prop.property || "").replace("properties/", "")
      console.log(`  ${id}  ${prop.displayName} (${acct.displayName})`)
    }
  }

  const propertyId = (process.env.GA4_PROPERTY_ID || "").trim()
  if (propertyId) {
    await google.analyticsdata({ version: "v1beta", auth: oauth2 }).properties.runReport({
      property: `properties/${propertyId}`,
      requestBody: { dateRanges: [{ startDate: "7daysAgo", endDate: "today" }], metrics: [{ name: "sessions" }] },
    })
    console.log(`\nVerified GA4_PROPERTY_ID=${propertyId}`)
  }
}

main().catch((e) => {
  console.error(e.message || e)
  process.exit(1)
})
