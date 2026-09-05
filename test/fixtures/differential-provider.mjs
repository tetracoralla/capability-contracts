#!/usr/bin/env node

import { createInterface } from 'node:readline'

const mode = process.argv[2]
if (mode === 'exit') process.exit(0)

const lines = createInterface({ input: process.stdin, crlfDelay: Infinity })
for await (const line of lines) {
  const request = JSON.parse(line)
  if (mode === 'hang') await new Promise(() => setInterval(() => {}, 1000))
  if (mode === 'malformed') {
    process.stdout.write('{malformed}\n')
    continue
  }
  if (mode === 'partial') {
    process.stdout.write(JSON.stringify({ id: request.id, ok: true }), () => process.exit(0))
    await new Promise(() => {})
  }
  if (mode === 'oversized') {
    process.stdout.write(`${'x'.repeat((1024 * 1024) + 1)}\n`)
    continue
  }
  if (mode === 'stderr-overflow') {
    process.stderr.write('x'.repeat((64 * 1024) + 1))
  }
  if (mode === 'duplicate-json') {
    process.stdout.write(
      `{"id":"${request.id}","id":"${request.id}","ok":false,`
      + '"error":{"code":"UNDECLARED","message":"duplicate"}}\n',
    )
    continue
  }
  if (mode === 'undeclared-error') {
    process.stdout.write(`${JSON.stringify({
      id: request.id,
      ok: false,
      error: { code: 'UNDECLARED', message: 'not in the Profile' },
    })}\n`)
    continue
  }
  if (mode === 'contradictory-envelope') {
    process.stdout.write(`${JSON.stringify({
      id: request.id,
      ok: false,
      error: { code: 'TEST_ERROR', message: 'declared test error' },
      result: { normalized: request.input.value.trim(), context: { engine: mode } },
    })}\n`)
    continue
  }
  if (mode === 'error-extra-field' || mode === 'wrong-retryable') {
    process.stdout.write(`${JSON.stringify({
      id: request.id,
      ok: false,
      error: {
        code: 'TEST_ERROR',
        message: 'declared test error',
        ...(mode === 'error-extra-field' ? { details: 'not allowed' } : { retryable: true }),
      },
    })}\n`)
    continue
  }
  const responseId = mode === 'wrong-correlation' ? `${request.id}-wrong` : request.id
  if (mode === 'declared-error') {
    process.stdout.write(`${JSON.stringify({
      id: responseId,
      ok: false,
      error: { code: 'TEST_ERROR', message: 'declared test error' },
    })}\n`)
    continue
  }
  const normalized = mode === 'different'
    ? `${request.input.value.trim()}-different`
    : request.input.value.trim()
  const items = mode === 'array-shift-left'
    ? ['ignored-left', 'same', 'different-left']
    : mode === 'array-shift-right'
      ? ['ignored-right', 'same', 'different-right']
      : undefined
  const response = {
    id: responseId,
    ok: true,
    result: {
      normalized: mode === 'schema-invalid' ? 42 : normalized,
      context: { engine: mode, ...(items === undefined ? {} : { items }) },
    },
  }
  process.stdout.write(`${JSON.stringify(response)}\n`)
  if (mode === 'duplicate-response') process.stdout.write(`${JSON.stringify(response)}\n`)
  if (mode === 'exit-after-response') process.exit(0)
}
if (mode === 'nonzero-shutdown') process.exit(7)
if (mode === 'hang-on-shutdown') await new Promise(() => setInterval(() => {}, 1000))
