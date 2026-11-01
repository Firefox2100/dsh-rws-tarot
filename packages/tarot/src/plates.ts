import { readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Context } from '@deepseek-ai/cordis'
import type { IncomingMessage } from 'node:http'
import { cards } from '@dsh-rws-tarot/data'

export const PLATES_PATH = '/rws-tarot/plates'

interface Connection {
  requestRejection(request: { readonly headers: IncomingMessage['headers'] }): 401 | 403 | undefined
}

/**
 * Serve the card plates to the browser. Only file names the card data lists are served, so a request cannot name any
 * other file; the connection's own trust check runs first, as for every other route of the web host.
 */
export function registerPlates(ctx: Context): void {
  ctx.inject(['webServer', 'connection'], (served) => { serve(served) })
}

function serve(ctx: Context): void {
  const webServer = ctx.webServer
  const connection = Reflect.get(ctx, 'connection') as Connection
  const dir = fileURLToPath(new URL('./plates/', import.meta.url))
  const files = new Set(cards.map(c => basename(c.image.file)))
  ctx.effect(() => webServer.register({
    kind: 'prefix',
    path: PLATES_PATH,
    handler: (req, res) => {
      const rejection = connection.requestRejection(req)
      if (rejection !== undefined) { res.statusCode = rejection; res.end(); return }
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.statusCode = 405; res.setHeader('allow', 'GET, HEAD'); res.end(); return }
      const file = decodeURIComponent(new URL(req.url ?? '', 'http://localhost').pathname.slice(PLATES_PATH.length + 1))
      if (!files.has(file)) { res.statusCode = 404; res.end(); return }
      const body = readFileSync(join(dir, file))
      res.statusCode = 200
      res.setHeader('content-type', 'image/jpeg')
      res.setHeader('content-length', body.length)
      res.setHeader('cache-control', 'private, max-age=86400, immutable')
      res.end(req.method === 'HEAD' ? undefined : body)
    },
  }), 'rws-tarot: plates')
}
