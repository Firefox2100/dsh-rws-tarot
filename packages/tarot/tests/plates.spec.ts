import type { IncomingMessage, ServerResponse } from 'node:http'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Context } from '@deepseek-ai/cordis'
import { cards } from '@dsh-rws-tarot/data'

const { readFileSync } = vi.hoisted(() => ({ readFileSync: vi.fn(() => Buffer.from('plate')) }))
vi.mock('node:fs', async (original) => ({ ...await original<typeof import('node:fs')>(), readFileSync }))

import { PLATES_PATH, registerPlates } from '../src/plates.ts'

type Handler = (request: IncomingMessage, response: ServerResponse) => void

function route(rejection?: 401 | 403) {
  let handler: Handler | undefined
  const dispose = vi.fn()
  const ctx = {
    inject: (_services: string[], ready: (served: Context) => void) => { ready(ctx as unknown as Context) },
    effect: (register: () => unknown, label: string) => {
      expect(label).toBe('rws-tarot: plates')
      register()
      return dispose
    },
    webServer: {
      register: (value: { kind: string; path: string; handler: Handler }) => {
        expect(value).toMatchObject({ kind: 'prefix', path: PLATES_PATH })
        handler = value.handler
        return dispose
      },
    },
    connection: { requestRejection: () => rejection },
  }
  registerPlates(ctx as unknown as Context)
  if (handler === undefined) throw new Error('plate route was not registered')
  return handler
}

function response() {
  const headers = new Map<string, string | number>()
  const end = vi.fn()
  return { value: { statusCode: 0, setHeader: (name: string, value: string | number) => headers.set(name, value), end } as unknown as ServerResponse, headers, end }
}

function request(method: string, url: string): IncomingMessage {
  return { method, url, headers: {} } as IncomingMessage
}

describe('plate route', () => {
  beforeEach(() => { readFileSync.mockClear() })

  it('applies the connection rejection before looking at the request', () => {
    const res = response()
    route(403)(request('GET', `${PLATES_PATH}/anything.jpg`), res.value)
    expect(res.value.statusCode).toBe(403)
    expect(readFileSync).not.toHaveBeenCalled()
  })

  it('allows only GET and HEAD', () => {
    const res = response()
    route()(request('POST', `${PLATES_PATH}/anything.jpg`), res.value)
    expect(res.value.statusCode).toBe(405)
    expect(res.headers.get('allow')).toBe('GET, HEAD')
  })

  it('returns 404 without reading a file not listed by the card data', () => {
    const res = response()
    route()(request('GET', `${PLATES_PATH}/../package.json`), res.value)
    expect(res.value.statusCode).toBe(404)
    expect(readFileSync).not.toHaveBeenCalled()
  })

  it.each(['GET', 'HEAD'])('serves a listed plate for %s', (method) => {
    const file = cards[0]!.image.file.split('/').at(-1)!
    const res = response()
    route()(request(method, `${PLATES_PATH}/${encodeURIComponent(file)}`), res.value)
    expect(res.value.statusCode).toBe(200)
    expect(res.headers.get('content-type')).toBe('image/jpeg')
    expect(res.headers.get('content-length')).toBe(5)
    expect(res.headers.get('cache-control')).toBe('private, max-age=86400, immutable')
    expect(res.end).toHaveBeenCalledWith(method === 'HEAD' ? undefined : Buffer.from('plate'))
  })
})
