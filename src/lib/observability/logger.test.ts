jest.mock('@sentry/nextjs', () => ({
  withScope: jest.fn((callback: (scope: unknown) => void) =>
    callback({
      setTag: jest.fn(),
      setUser: jest.fn(),
      setExtras: jest.fn(),
    })
  ),
  captureException: jest.fn(),
}))

import * as Sentry from '@sentry/nextjs'
import { captureError } from './logger'

describe('captureError', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('tags the Sentry scope with route and event type before capturing', () => {
    const scope = { setTag: jest.fn(), setUser: jest.fn(), setExtras: jest.fn() }
    ;(Sentry.withScope as jest.Mock).mockImplementation((cb: (s: typeof scope) => void) => cb(scope))

    const error = new Error('boom')
    captureError(error, { route: '/api/process', eventType: 'ai_call_failed', actor: 'user-1' })

    expect(scope.setTag).toHaveBeenCalledWith('route', '/api/process')
    expect(scope.setTag).toHaveBeenCalledWith('event_type', 'ai_call_failed')
    expect(scope.setUser).toHaveBeenCalledWith({ id: 'user-1' })
    expect(Sentry.captureException).toHaveBeenCalledWith(error)
  })

  it('omits setUser when no actor is known', () => {
    const scope = { setTag: jest.fn(), setUser: jest.fn(), setExtras: jest.fn() }
    ;(Sentry.withScope as jest.Mock).mockImplementation((cb: (s: typeof scope) => void) => cb(scope))

    captureError(new Error('boom'), { route: '/api/upload', eventType: 'import_failed' })

    expect(scope.setUser).not.toHaveBeenCalled()
  })

  it('logs a structured actor/route/event-type/timestamp line', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    captureError(new Error('boom'), { route: '/api/process', eventType: 'ai_call_failed', actor: 'user-1' })

    const logged = JSON.parse(spy.mock.calls[0][0] as string)
    expect(logged).toMatchObject({ actor: 'user-1', route: '/api/process', event_type: 'ai_call_failed', error: 'boom' })
    expect(typeof logged.timestamp).toBe('string')
  })
})
