import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { schemaDigest } from '../src/lib/contracts.mjs'

const testRoot = dirname(fileURLToPath(import.meta.url))
const repositoryRoot = resolve(testRoot, '..')
const runnerPath = resolve(repositoryRoot, 'src/run-conformance.mjs')
const transportRunnerPath = resolve(repositoryRoot, 'src/run-transport-conformance.mjs')

const inputSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['value'],
  properties: { value: { type: 'string' } },
}
const outputSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['normalized'],
  properties: { normalized: { type: 'string' } },
}
const profile = {
  schemaVersion: 'openadam.capability-profile.v0.3',
  id: 'org.openadam.test.normalize',
  version: '0.1.0',
  title: 'Normalize test value',
  summary: 'A runner integration fixture.',
  lifecycle: 'experimental',
  operations: [
    {
      id: 'normalize',
      title: 'Normalize',
      description: 'Normalize one string.',
      semantics: {
        resultVariability: 'deterministic',
        contextSources: [],
        stateAccess: 'none',
        idempotency: 'idempotent',
        openWorld: false,
        ambiguity: 'not-applicable',
        provenance: 'not-applicable',
      },
      inputSchema,
      outputSchema,
      errors: [],
    },
  ],
}

async function writeFixture(adapterScript, timeoutMs, inputValue = ' A ', withProbe = false) {
  const root = await mkdtemp(resolve(tmpdir(), 'capability-runner-test-'))
  const profilePath = resolve(root, 'profile.json')
  const suitePath = resolve(root, 'suite.json')
  const manifestPath = resolve(root, 'manifest.json')
  const suite = {
    schemaVersion: 'openadam.conformance-suite.v0.1',
    capabilityId: profile.id,
    capabilityVersion: profile.version,
    cases: [
      {
        id: 'basic',
        operationId: 'normalize',
        description: 'Normalize one value.',
        input: { value: inputValue },
        expect: { outcome: 'success', match: 'exact', value: { normalized: 'A' } },
        timeoutMs,
      },
    ],
  }
  const manifest = {
    schemaVersion: withProbe
      ? 'openadam.provider-manifest.v0.2'
      : 'openadam.provider-manifest.v0.1',
    provider: { id: 'org.openadam.test-provider', name: 'Test Provider', version: '0.1.0' },
    implementations: [
      {
        capabilityId: profile.id,
        capabilityVersion: profile.version,
        adapter: {
          protocol: 'openadam.capability-jsonl.v0.1',
          command: process.execPath,
          args: [adapterScript],
        },
        ...(withProbe
          ? {
              adapterBindings: [
                { operationId: 'normalize', target: 'fixtures/provider#normalize' },
              ],
              transportSchemaProbe: {
                protocol: 'openadam.transport-schema-jsonl.v0.1',
                command: process.execPath,
                args: [resolve(testRoot, 'fixtures/transport-schema-probe.mjs')],
              },
            }
          : {}),
        bindings: [
          {
            operationId: 'normalize',
            transport: 'library',
            target: 'normalize',
            contractSchemaDigests: {
              input: schemaDigest(inputSchema),
              output: schemaDigest(outputSchema),
            },
            transportSchemaDigests: {
              input: schemaDigest(inputSchema),
              output: schemaDigest(outputSchema),
            },
          },
        ],
      },
    ],
  }
  await Promise.all([
    writeFile(profilePath, JSON.stringify(profile)),
    writeFile(suitePath, JSON.stringify(suite)),
    writeFile(manifestPath, JSON.stringify(manifest)),
  ])
  return { root, profilePath, suitePath, manifestPath, manifest }
}

function runTransportFixture(paths) {
  return spawnSync(
    process.execPath,
    [
      transportRunnerPath,
      '--profile',
      paths.profilePath,
      '--suite',
      paths.suitePath,
      '--manifest',
      paths.manifestPath,
      '--provider-root',
      paths.root,
    ],
    { cwd: repositoryRoot, encoding: 'utf8', timeout: 5000 },
  )
}

test('transport conformance verifies schemas and targets through the live probe', async () => {
  const paths = await writeFixture(
    resolve(testRoot, 'fixtures/hanging-provider.mjs'),
    1000,
    ' A ',
    true,
  )
  try {
    const result = runTransportFixture(paths)
    assert.equal(result.error, undefined)
    assert.equal(result.status, 0)
    assert.match(result.stdout, /PASS live-transport-binding/)
  } finally {
    await rm(paths.root, { recursive: true, force: true })
  }
})

test('transport conformance rejects a declared target that the live probe does not expose', async () => {
  const paths = await writeFixture(
    resolve(testRoot, 'fixtures/hanging-provider.mjs'),
    1000,
    ' A ',
    true,
  )
  try {
    paths.manifest.implementations[0].bindings[0].target = 'different-target'
    await writeFile(paths.manifestPath, JSON.stringify(paths.manifest))
    const result = runTransportFixture(paths)
    assert.equal(result.error, undefined)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /live transport identity or target differs from manifest/)
  } finally {
    await rm(paths.root, { recursive: true, force: true })
  }
})

function runFixture(paths, profileFlag = '--profile') {
  return spawnSync(
    process.execPath,
    [
      runnerPath,
      profileFlag,
      paths.profilePath,
      '--suite',
      paths.suitePath,
      '--manifest',
      paths.manifestPath,
      '--provider-root',
      paths.root,
    ],
    { cwd: repositoryRoot, encoding: 'utf8', timeout: 5000 },
  )
}

test('a timed-out provider is terminated and the runner returns', async () => {
  const paths = await writeFixture(resolve(testRoot, 'fixtures/hanging-provider.mjs'), 20)
  try {
    const result = runFixture(paths)
    assert.equal(result.error, undefined)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /timed out after 20ms/)
  } finally {
    await rm(paths.root, { recursive: true, force: true })
  }
})

test('a contradictory provider response envelope is rejected', async () => {
  const paths = await writeFixture(
    resolve(testRoot, 'fixtures/invalid-envelope-provider.mjs'),
    1000,
  )
  try {
    const result = runFixture(paths, '--definition')
    assert.equal(result.error, undefined)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /invalid provider response fields/)
  } finally {
    await rm(paths.root, { recursive: true, force: true })
  }
})

test('a provider response with duplicate JSON fields is rejected', async () => {
  const paths = await writeFixture(
    resolve(testRoot, 'fixtures/duplicate-key-provider.mjs'),
    1000,
  )
  try {
    const result = runFixture(paths)
    assert.equal(result.error, undefined)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /duplicate JSON object key id/)
  } finally {
    await rm(paths.root, { recursive: true, force: true })
  }
})

test('an oversized provider request is rejected before it is written', async () => {
  const paths = await writeFixture(
    resolve(testRoot, 'fixtures/hanging-provider.mjs'),
    1000,
    'x'.repeat(1024 * 1024),
  )
  try {
    const result = runFixture(paths)
    assert.equal(result.error, undefined)
    assert.equal(result.status, 1)
    assert.match(result.stderr, /provider request exceeds 1048576 bytes/)
  } finally {
    await rm(paths.root, { recursive: true, force: true })
  }
})
