const GA_MEASUREMENT_ID = "G-6SGW30MKNX"

const GA_SNIPPET = `<!-- Google tag (gtag.js) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${GA_MEASUREMENT_ID}');
</script>`

function shouldSkipPath(pathname: string) {
  return (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/panel") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/client")
  )
}

function gtagNearTopOfHead(html: string) {
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i)
  if (!headMatch) return false
  const headStart = headMatch[1].slice(0, 1200)
  return headStart.includes(`googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`)
}

export default async function handler(request: Request, context: { next: () => Promise<Response> }) {
  const url = new URL(request.url)
  if (shouldSkipPath(url.pathname)) {
    return context.next()
  }

  const response = await context.next()
  const contentType = response.headers.get("content-type") || ""
  if (!contentType.includes("text/html")) {
    return response
  }

  const html = await response.text()
  if (gtagNearTopOfHead(html)) {
    return response
  }

  const updatedHtml = html.replace(/<head([^>]*)>/i, `<head$1>${GA_SNIPPET}`)
  const headers = new Headers(response.headers)
  headers.delete("content-length")

  return new Response(updatedHtml, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}
