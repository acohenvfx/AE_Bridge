const PRIVATE_PATHS = [
  "/v1",
  "/api",
  "/healthz",
  "/docs",
  "/redoc",
  "/openapi.json"
]

function isPrivatePath(pathname) {
  return PRIVATE_PATHS.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (isPrivatePath(url.pathname)) {
      return new Response("Not found", { status: 404 })
    }

    const asset = await env.ASSETS.fetch(request)
    const headers = new Headers(asset.headers)
    headers.set("X-Content-Type-Options", "nosniff")
    headers.set("Referrer-Policy", "no-referrer")
    headers.set(
      "Content-Security-Policy",
      "default-src 'self'; connect-src 'self' http://127.0.0.1:8010 http://localhost:8010 http://127.0.0.1:4930 http://localhost:4930; img-src 'self' data:; font-src 'self' https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; script-src 'self' 'unsafe-inline'"
    )
    return new Response(asset.body, {
      status: asset.status,
      statusText: asset.statusText,
      headers
    })
  }
}
