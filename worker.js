export default {
  fetch(request, env) {
    const url = new URL(request.url)

    if (url.pathname === '/kitty') {
      url.pathname = '/kitty/'
      return Response.redirect(url.toString(), 308)
    }

    if (url.pathname.startsWith('/kitty/')) {
      const assetUrl = new URL(request.url)
      assetUrl.pathname = url.pathname.slice('/kitty'.length) || '/'
      return env.ASSETS.fetch(new Request(assetUrl, request))
    }

    return env.ASSETS.fetch(request)
  },
}
