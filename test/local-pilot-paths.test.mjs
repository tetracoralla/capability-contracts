import assert from 'node:assert/strict'
import test from 'node:test'
import { resolve } from 'node:path'
import { resolvePilotRoot } from '../scripts/local-pilot-paths.mjs'

test('local pilot roots use explicit absolute source overrides or their workspace defaults', () => {
  const workspace = resolve('/tmp', 'openadam-workspace')
  assert.equal(
    resolvePilotRoot(workspace, 'data-transformer', 'OPENADAM_BATCHTICKET_SOURCE_ROOT', {}),
    resolve(workspace, 'data-transformer'),
  )
  assert.equal(
    resolvePilotRoot(
      workspace,
      'data-transformer',
      'OPENADAM_BATCHTICKET_SOURCE_ROOT',
      { OPENADAM_BATCHTICKET_SOURCE_ROOT: '/tmp/BatchTicket' },
    ),
    '/tmp/BatchTicket',
  )
  assert.throws(
    () => resolvePilotRoot(
      workspace,
      'data-transformer',
      'OPENADAM_BATCHTICKET_SOURCE_ROOT',
      { OPENADAM_BATCHTICKET_SOURCE_ROOT: 'relative/path' },
    ),
    /must be an absolute path/,
  )
})
