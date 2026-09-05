import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import test from 'node:test'
import {
  capabilityProfileDigest,
  schemaDigest,
} from '../src/lib/contracts.mjs'

const repositoryRoot = resolve(import.meta.dirname, '..')
const runnerPath = resolve(repositoryRoot, 'src/run-differential.mjs')
const adapterPath = resolve(import.meta.dirname, 'fixtures/differential-provider.mjs')

const inputSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['value'],
  properties: { value: { type: 'string' } },
}
const outputSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['normalized', 'context'],
  properties: {
    normalized: { type: 'string' },
    context: {
      type: 'object',
      additionalProperties: false,
      required: ['engine'],
      properties: {
        engine: { type: 'string' },
        items: { type: 'array', items: { type: 'string' } },
      },
    },
  },
}
const profile = {
  schemaVersion: 'openadam.capability-profile.v0.3',
  id: 'org.openadam.test.differential-normalize',
  version: '0.1.0',
  title: 'Differential normalize fixture',
  summary: 'A typed fixture for the differential runner.',
  lifecycle: 'experimental',
  operations: [{
    id: 'normalize',
    title: 'Normalize',
    description: 'Normalize one string.',
    semantics: {
      resultVariability: 'deterministic',
      contextSources: ['runtime'],
      stateAccess: 'none',
      idempotency: 'idempotent',
      openWorld: false,
      ambiguity: 'not-applicable',
      provenance: 'required',
    },
    inputSchema,
    outputSchema,
    errors: [{ code: 'TEST_ERROR', description: 'Declared test error.', retryable: false }],
  }],
}

async function createFixture(rightMode, overrides = {}) {
  const root = await mkdtemp(resolve(tmpdir(), 'differential-runner-test-'))
  const paths = {
    root,
    profile: resolve(root, 'profile.json'),
    conformance: resolve(root, 'conformance.json'),
    differential: resolve(root, 'differential.json'),
    leftManifest: resolve(root, 'left-manifest.json'),
    rightManifest: resolve(root, 'right-manifest.json'),
  }
  const conformance = {
    schemaVersion: 'openadam.conformance-suite.v0.2',
    capabilityId: profile.id,
    capabilityVersion: profile.version,
    claimLevel: 'L0',
    cases: [{
      id: 'basic',
      operationId: 'normalize',
      description: 'Normalize one fixture value.',
      input: { value: ' A ' },
      expect: { outcome: 'success', match: 'subset', value: { normalized: 'A' } },
    }],
  }
  const differential = {
    schemaVersion: 'openadam.differential-suite.v0.1',
    capabilityId: profile.id,
    capabilityVersion: profile.version,
    comparisonPolicy: {
      ignoredResultPaths: [
        ...new Set(['/context/engine', ...(overrides.ignorePointers ?? [])]),
      ].filter((pointer) => pointer.startsWith('/context/')).map((pointer) => ({
        operationId: 'normalize',
        pointer,
        semanticRole: 'runtime-context',
        basis: 'This fixture field is provider runtime context.',
      })),
    },
    cases: [{
      id: 'secret-case',
      operationId: 'normalize',
      description: 'Compare normalized output while retaining runtime engine provenance.',
      input: overrides.input ?? { value: 'secret-result' },
      comparison: {
        kind: 'canonical-exact-except',
        ignorePointers: overrides.ignorePointers ?? ['/context/engine'],
        ignoredPathBasis: 'Engine identity is runtime provenance; normalized output remains exact.',
      },
      timeoutMs: overrides.timeoutMs ?? 1000,
    }],
  }
  const digest = await capabilityProfileDigest(profile)
  function manifest(id, mode, cwd) {
    return {
      schemaVersion: 'openadam.provider-manifest.v0.3',
      provider: { id, name: id, version: '0.1.0' },
      implementations: [{
        capabilityId: profile.id,
        capabilityVersion: profile.version,
        profileDigest: digest,
        adapter: {
          protocol: 'openadam.capability-jsonl.v0.1',
          command: process.execPath,
          args: [adapterPath, mode],
          ...(cwd === undefined ? {} : { cwd }),
        },
        adapterBindings: [{ operationId: 'normalize', target: `${id}#normalize` }],
        bindings: [{
          operationId: 'normalize',
          transport: 'library',
          target: `${id}.normalize`,
          contractSchemaDigests: {
            input: schemaDigest(inputSchema),
            output: schemaDigest(outputSchema),
          },
          transportSchemaDigests: {
            input: schemaDigest(inputSchema),
            output: schemaDigest(outputSchema),
          },
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
          },
        }],
      }],
    }
  }
  await Promise.all([
    writeFile(paths.profile, JSON.stringify(profile)),
    writeFile(paths.conformance, JSON.stringify(conformance)),
    writeFile(paths.differential, JSON.stringify(differential)),
    writeFile(
      paths.leftManifest,
      JSON.stringify(manifest('org.openadam.test.left', overrides.leftMode ?? 'left')),
    ),
    writeFile(
      paths.rightManifest,
      JSON.stringify(manifest('org.openadam.test.right', rightMode, overrides.rightCwd)),
    ),
  ])
  return paths
}

function run(paths, overrides = {}) {
  return spawnSync(process.execPath, [
    runnerPath,
    '--profile', paths.profile,
    '--conformance-suite', paths.conformance,
    '--differential-suite', paths.differential,
    '--left-manifest', paths.leftManifest,
    '--left-provider-root', paths.root,
    '--right-manifest', paths.rightManifest,
    '--right-provider-root', overrides.rightProviderRoot ?? paths.root,
  ], { cwd: repositoryRoot, encoding: 'utf8', timeout: 5000 })
}

test('differential runner compares exact semantic output after an explicit provenance exception', async () => {
  const paths = await createFixture('right')
  try {
    const result = run(paths)
    assert.equal(result.error, undefined)
    assert.equal(result.status, 0)
    assert.match(result.stdout, /PASS provider-differential/)
  } finally {
    await rm(paths.root, { recursive: true, force: true })
  }
})

test('differential mismatch output contains only outcome and digests, not semantic values', async () => {
  const paths = await createFixture('different')
  try {
    const result = run(paths)
    assert.equal(result.error, undefined)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /provider outcomes differ/)
    assert.match(result.stderr, /leftDigest=sha256:/)
    assert.equal(result.stderr.includes('secret-result'), false)
  } finally {
    await rm(paths.root, { recursive: true, force: true })
  }
})

test('differential runner closes the first adapter when the second provider root cannot start', async () => {
  const paths = await createFixture('right')
  try {
    const result = run(paths, { rightProviderRoot: resolve(paths.root, 'missing-provider-root') })
    assert.equal(result.error, undefined)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /FAIL/)
    assert.equal(result.signal, null)
  } finally {
    await rm(paths.root, { recursive: true, force: true })
  }
})

test('ignored array positions are removed against original indices in either pointer order', async () => {
  for (const ignorePointers of [
    ['/context/items/0', '/context/items/1'],
    ['/context/items/1', '/context/items/0'],
  ]) {
    const paths = await createFixture('array-shift-right', {
      leftMode: 'array-shift-left',
      ignorePointers: ['/context/engine', ...ignorePointers],
    })
    try {
      const result = run(paths)
      assert.equal(result.error, undefined)
      assert.equal(result.status, 1)
      assert.match(result.stderr, /provider outcomes differ/)
    } finally {
      await rm(paths.root, { recursive: true, force: true })
    }
  }
})

test('an absent ignored result path fails closed', async () => {
  const paths = await createFixture('right', {
    ignorePointers: ['/context/missing'],
  })
  try {
    const result = run(paths)
    assert.equal(result.error, undefined)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /ignored path \/context\/missing is absent/)
  } finally {
    await rm(paths.root, { recursive: true, force: true })
  }
})

test('ignored result paths are rejected when both providers return an error', async () => {
  const paths = await createFixture('declared-error', {
    leftMode: 'declared-error',
    ignorePointers: ['/context/engine'],
  })
  try {
    const result = run(paths)
    assert.equal(result.error, undefined)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /ignored result paths require a successful outcome/)
  } finally {
    await rm(paths.root, { recursive: true, force: true })
  }
})

test('overlapping ignored result paths are rejected before execution', async () => {
  const paths = await createFixture('right', {
    ignorePointers: ['/context', '/context/engine'],
  })
  try {
    const result = run(paths)
    assert.equal(result.error, undefined)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /ignored paths must not overlap/)
  } finally {
    await rm(paths.root, { recursive: true, force: true })
  }
})

test('non-adjacent overlapping ignored paths are rejected before execution', async () => {
  const paths = await createFixture('right', {
    ignorePointers: ['/context', '/context-a', '/context/engine'],
  })
  try {
    const result = run(paths)
    assert.equal(result.error, undefined)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /ignored paths must not overlap/)
  } finally {
    await rm(paths.root, { recursive: true, force: true })
  }
})

for (const [mode, expected] of [
  ['malformed', /Expected property name|invalid JSON/],
  ['duplicate-json', /duplicate JSON object key id/],
  ['wrong-correlation', /unknown or duplicate response id/],
  ['duplicate-response', /unknown or duplicate response id/],
  ['schema-invalid', /result:/],
  ['undeclared-error', /undeclared error code UNDECLARED/],
  ['contradictory-envelope', /invalid provider response fields/],
  ['error-extra-field', /invalid provider error envelope/],
  ['wrong-retryable', /differs from the Capability Profile/],
  ['partial', /partial response line/],
  ['oversized', /response exceeds 1048576 bytes/],
  ['stderr-overflow', /stderr exceeds 65536 bytes/],
]) {
  test(`differential runner rejects ${mode} provider behavior`, async () => {
    const paths = await createFixture(mode)
    try {
      const result = run(paths)
      assert.equal(result.error, undefined)
      assert.equal(result.status, 1)
      assert.match(result.stderr, expected)
      assert.equal(result.stderr.includes('secret-result'), false)
    } finally {
      await rm(paths.root, { recursive: true, force: true })
    }
  })
}

test('a timed-out differential provider is terminated without leaking the peer', async () => {
  const paths = await createFixture('hang', { timeoutMs: 50 })
  try {
    const startedAt = Date.now()
    const result = run(paths)
    assert.equal(result.error, undefined)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /timed out after 50ms/)
    assert.ok(Date.now() - startedAt < 3000)
  } finally {
    await rm(paths.root, { recursive: true, force: true })
  }
})

test('a provider that exits non-zero during requested shutdown is rejected', async () => {
  const paths = await createFixture('nonzero-shutdown')
  try {
    const result = run(paths)
    assert.equal(result.error, undefined)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /adapter shutdown failed: code=7/)
  } finally {
    await rm(paths.root, { recursive: true, force: true })
  }
})

test('a provider that ignores clean shutdown is killed after the bounded grace period', async () => {
  const paths = await createFixture('hang-on-shutdown')
  try {
    const startedAt = Date.now()
    const result = run(paths)
    assert.equal(result.error, undefined)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /adapter did not exit within 2000ms/)
    assert.ok(Date.now() - startedAt < 4000)
  } finally {
    await rm(paths.root, { recursive: true, force: true })
  }
})

test('a symlinked adapter cwd cannot escape its provider root', async () => {
  const outside = await mkdtemp(resolve(tmpdir(), 'differential-runner-outside-'))
  const paths = await createFixture('right', { rightCwd: 'escape' })
  try {
    await symlink(outside, resolve(paths.root, 'escape'))
    const result = run(paths)
    assert.equal(result.error, undefined)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /provider adapter cwd escapes the provider root/)
  } finally {
    await rm(paths.root, { recursive: true, force: true })
    await rm(outside, { recursive: true, force: true })
  }
})

test('an early-exit failure cancels the active peer before its case timeout', async () => {
  const paths = await createFixture('hang', {
    leftMode: 'exit',
    timeoutMs: 4000,
  })
  try {
    const startedAt = Date.now()
    const result = run(paths)
    assert.equal(result.error, undefined)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /adapter exited before shutdown|write EPIPE/)
    assert.ok(Date.now() - startedAt < 3500)
  } finally {
    await rm(paths.root, { recursive: true, force: true })
  }
})

test('a provider that exits after its final response but before stdin EOF is rejected', async () => {
  const paths = await createFixture('right', { leftMode: 'exit-after-response' })
  try {
    const result = run(paths)
    assert.equal(result.error, undefined)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /adapter exited before shutdown/)
  } finally {
    await rm(paths.root, { recursive: true, force: true })
  }
})

test('an oversized differential request is rejected before adapter execution', async () => {
  const paths = await createFixture('right', {
    input: { value: 'x'.repeat(1024 * 1024) },
  })
  try {
    const result = run(paths)
    assert.equal(result.error, undefined)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /provider request exceeds 1048576 bytes/)
  } finally {
    await rm(paths.root, { recursive: true, force: true })
  }
})
