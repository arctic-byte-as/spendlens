'use client'

import * as Sentry from '@sentry/nextjs'
import NextError from 'next/error'
import { useEffect } from 'react'

// Required by the Sentry Next.js SDK to capture errors thrown while
// rendering the root layout (React errors that `error.tsx` boundaries
// inside individual routes can't catch). See docs/backlog.md Epic 5-A.
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html>
      <body>
        <NextError statusCode={0} />
      </body>
    </html>
  )
}
