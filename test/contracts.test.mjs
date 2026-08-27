import assert from 'node:assert/strict'
import test from 'node:test'
import {
  assertUniqueSemanticIdentities,
  capabilityProfileDigest,
  canonicalJson,
  deepSubset,
  loadJson,
  parseJson,
  resolveOperationSchemas,
  schemaDigest,
  validateAgainstSchema,
  validateContractSet,
} from '../src/lib/contracts.mjs'
import { fileURLToPath } from 'node:url'

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
  summary: 'A minimal valid contract used by the reference tooling tests.',
  lifecycle: 'experimental',
  operations: [
    {
      id: 'normalize',
      title: 'Normalize',
      description: 'Return a normalized test value.',
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
const suite = {
  schemaVersion: 'openadam.conformance-suite.v0.2',
  capabilityId: profile.id,
  capabilityVersion: profile.version,
  claimLevel: 'L0',
  cases: [
    {
      id: 'basic',
      operationId: 'normalize',
      description: 'Normalize one value.',
      input: { value: ' A ' },
      expect: { outcome: 'success', match: 'subset', value: { normalized: 'A' } },
    },
  ],
}
const profileDigest = await capabilityProfileDigest(profile)
const manifest = {
  schemaVersion: 'openadam.provider-manifest.v0.3',
  provider: { id: 'org.openadam.test-provider', name: 'Test Provider', version: '0.1.0' },
  implementations: [
    {
      capabilityId: profile.id,
      capabilityVersion: profile.version,
      profileDigest,
      adapter: {
        protocol: 'openadam.capability-jsonl.v0.1',
        command: 'node',
        args: ['scripts/adapter.mjs'],
      },
      adapterBindings: [
        { operationId: 'normalize', target: 'scripts/adapter.mjs#normalize' },
      ],
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
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false,
          },
        },
      ],
    },
  ],
}

test('canonicalJson ignores object key order', () => {
  assert.equal(canonicalJson({ b: 2, a: 1 }), canonicalJson({ a: 1, b: 2 }))
})

test('canonicalJson follows RFC 8785 number and string serialization', () => {
  assert.equal(
    canonicalJson({ numbers: [333333333.3333333, 1e30, 4.5, 0.002, 1e-27], one: 1.0 }),
    '{"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27],"one":1}',
  )
  assert.throws(() => canonicalJson(Number.NaN), /non-finite/)
  assert.throws(() => canonicalJson(9007199254740992), /unsafe integers/)
  assert.throws(() => canonicalJson('\ud800'), /lone Unicode surrogate/)
})

test('strict JSON rejects integers that cannot survive IEEE-754 parsing exactly', () => {
  assert.throws(
    () => parseJson('{"value":9007199254740993}', 'unsafe integer fixture'),
    /safe range or encoded as a string/,
  )
  assert.throws(
    () => parseJson('{"value":9007199254740993e0}', 'unsafe scientific integer fixture'),
    /loses IEEE-754 precision/,
  )
})

test('loadJson rejects duplicate object keys before canonicalization', async () => {
  await assert.rejects(
    loadJson(fileURLToPath(new URL('./fixtures/duplicate-keys.json', import.meta.url))),
    /duplicate JSON object key value/,
  )
})

test('deepSubset keeps array ordering and permits extra object fields', () => {
  assert.equal(deepSubset({ a: 1, nested: { b: 2, c: 3 } }, { nested: { b: 2 } }), true)
  assert.equal(deepSubset({ values: [1, 2, 3] }, { values: [1, 2] }), false)
})

test('valid contract set passes', async () => {
  await validateContractSet({ profile, suite, manifest })
})

test('Provider Manifest v0.3 requires exact canonical adapter operation targets', async () => {
  const current = structuredClone(manifest)
  current.implementations[0].adapterBindings = [
    { operationId: 'different', target: 'src/adapter.mjs#different' },
  ]
  await assert.rejects(
    validateContractSet({ profile, suite, manifest: current }),
    /provider adapter binding mismatch; missing=\[normalize\], extra=\[different\]/,
  )
})

test('current SemVer syntax accepts build metadata and rejects empty identifiers', async () => {
  const withBuildMetadata = structuredClone(profile)
  withBuildMetadata.version = '0.1.0-alpha.1+build.7'
  const matchingSuite = structuredClone(suite)
  matchingSuite.capabilityVersion = withBuildMetadata.version
  await validateContractSet({ profile: withBuildMetadata, suite: matchingSuite })

  const invalid = structuredClone(profile)
  invalid.version = '1.0.0-..'
  await assert.rejects(validateContractSet({ profile: invalid, suite }), /must match pattern/)
})

test('L1 cannot be claimed by one happy case per operation', async () => {
  const overstated = structuredClone(suite)
  overstated.claimLevel = 'L1'
  await assert.rejects(
    validateContractSet({ profile, suite: overstated }),
    /L1 requires a normal success case/,
  )
})

test('legacy v0.1 conformance suites remain readable at their old ungraded boundary', async () => {
  const legacySuite = structuredClone(suite)
  legacySuite.schemaVersion = 'openadam.conformance-suite.v0.1'
  delete legacySuite.claimLevel
  await validateContractSet({ profile, suite: legacySuite })
})

test('legacy capability-definition v0.1 documents remain readable', async () => {
  const definition = {
    ...structuredClone(profile),
    schemaVersion: 'openadam.capability-definition.v0.1',
  }
  definition.operations[0].semantics = {
    determinism: 'deterministic',
    sideEffects: 'none',
    idempotent: true,
    openWorld: false,
    context: 'none',
    ambiguity: 'not-applicable',
    provenance: 'not-applicable',
  }
  const legacyManifest = structuredClone(manifest)
  legacyManifest.schemaVersion = 'openadam.provider-manifest.v0.1'
  delete legacyManifest.implementations[0].profileDigest
  delete legacyManifest.implementations[0].adapterBindings
  await validateContractSet({ definition, suite, manifest: legacyManifest })
})

test('legacy Capability Profile v0.2 documents remain readable', async () => {
  const legacy = structuredClone(profile)
  legacy.schemaVersion = 'openadam.capability-profile.v0.2'
  legacy.operations[0].semantics = {
    determinism: 'deterministic',
    sideEffects: 'none',
    idempotent: true,
    openWorld: false,
    context: 'none',
    ambiguity: 'not-applicable',
    provenance: 'not-applicable',
  }
  const legacyManifest = structuredClone(manifest)
  legacyManifest.schemaVersion = 'openadam.provider-manifest.v0.1'
  delete legacyManifest.implementations[0].profileDigest
  delete legacyManifest.implementations[0].adapterBindings
  await validateContractSet({ profile: legacy, suite, manifest: legacyManifest })
})

test('current Profiles reject manifests that do not bind the Profile semantics', async () => {
  const legacyManifest = structuredClone(manifest)
  legacyManifest.schemaVersion = 'openadam.provider-manifest.v0.1'
  delete legacyManifest.implementations[0].profileDigest
  delete legacyManifest.implementations[0].adapterBindings
  await assert.rejects(
    validateContractSet({ profile, suite, manifest: legacyManifest }),
    /require Provider Manifest v0.3 semantic binding/,
  )
})

test('Profile semantic drift is rejected even when operation schemas are unchanged', async () => {
  const driftedProfile = structuredClone(profile)
  driftedProfile.operations[0].semantics.stateAccess = 'destructive'
  driftedProfile.operations[0].semantics.idempotency = 'non-idempotent'
  await assert.rejects(
    validateContractSet({ profile: driftedProfile, suite, manifest }),
    /provider profile digest differs/,
  )
})

test('provider annotations must exactly reflect the bound operation semantics', async () => {
  const driftedManifest = structuredClone(manifest)
  driftedManifest.implementations[0].bindings[0].annotations.readOnlyHint = false
  await assert.rejects(
    validateContractSet({ profile, suite, manifest: driftedManifest }),
    /provider annotations differ from Capability semantics/,
  )
})

test('catalog semantic identities are unique across documents', () => {
  assert.throws(
    () => assertUniqueSemanticIdentities([profile, structuredClone(profile)], 'catalog'),
    /duplicate id org.openadam.test.normalize@0.1.0/,
  )
})

test('effect corrections use new Capability versions instead of rewriting old identities', async () => {
  const projectiveV01 = await loadJson(
    fileURLToPath(new URL('../catalog/capabilities/projective-transform.v0.1.json', import.meta.url)),
  )
  const projectiveV02 = await loadJson(
    fileURLToPath(new URL('../catalog/capabilities/projective-transform.v0.2.json', import.meta.url)),
  )
  const rasterV01 = await loadJson(
    fileURLToPath(new URL('../catalog/capabilities/raster-prepare.v0.1.json', import.meta.url)),
  )
  const rasterV02 = await loadJson(
    fileURLToPath(new URL('../catalog/capabilities/raster-prepare.v0.2.json', import.meta.url)),
  )

  assert.equal(projectiveV01.version, '0.1.0')
  assert.equal(projectiveV01.operations.find(({ id }) => id === 'render').semantics.stateAccess, 'write')
  assert.equal(projectiveV02.version, '0.2.0')
  assert.equal(projectiveV02.operations.find(({ id }) => id === 'render').semantics.stateAccess, 'destructive')
  assert.deepEqual(rasterV01.operations.map(({ semantics }) => semantics.stateAccess), ['write', 'write', 'write'])
  assert.equal(rasterV02.version, '0.2.0')
  assert.deepEqual(rasterV02.operations.map(({ semantics }) => semantics.stateAccess), ['destructive', 'destructive', 'destructive'])
})

test('stable error corrections use a new Capability version and keep carrier failures outside the waist', async () => {
  const standardExpressionV01 = await loadJson(
    fileURLToPath(new URL('../catalog/capabilities/standard-expression-run.v0.1.json', import.meta.url)),
  )
  const standardExpressionV02 = await loadJson(
    fileURLToPath(new URL('../catalog/capabilities/standard-expression-run.v0.2.json', import.meta.url)),
  )

  assert.equal(standardExpressionV01.version, '0.1.0')
  assert.deepEqual(
    standardExpressionV01.operations[0].errors.map(({ code }) => code),
    ['ADAPTER_INVALID_REQUEST', 'PROVIDER_ERROR'],
  )
  assert.equal(standardExpressionV02.version, '0.2.0')
  assert.deepEqual(standardExpressionV02.operations[0].errors, [])
})

test('Capability JSONL v0.1 accepts only the bounded compatibility error forms', async () => {
  const envelopeSchema = await loadJson(
    fileURLToPath(new URL('../schemas/capability-jsonl-envelope.schema.v0.1.json', import.meta.url)),
  )
  validateAgainstSchema(
    envelopeSchema,
    { id: 'case-1', ok: false, error: { code: 'PROVIDER_FAILED', message: 'failed' } },
    'error without retryable',
  )
  validateAgainstSchema(
    envelopeSchema,
    {
      id: 'case-2',
      ok: false,
      error: { code: 'PROVIDER_FAILED', message: 'failed', retryable: false },
    },
    'error with retryable',
  )
  assert.throws(
    () => validateAgainstSchema(
      envelopeSchema,
      {
        id: 'case-3',
        ok: false,
        error: { code: 'PROVIDER_FAILED', message: 'failed', details: {} },
      },
      'error with extra fields',
    ),
    /additional properties/,
  )
})

test('schema drift is rejected', async () => {
  const drifted = structuredClone(manifest)
  drifted.implementations[0].bindings[0].contractSchemaDigests.input =
    `sha256:${'0'.repeat(64)}`
  await assert.rejects(
    validateContractSet({ profile, suite, manifest: drifted }),
    /provider input schema digest differs/,
  )
})

test('a conformance input outside the operation schema is rejected', async () => {
  const invalidSuite = structuredClone(suite)
  invalidSuite.cases[0].input = { value: 42 }
  await assert.rejects(
    validateContractSet({ profile, suite: invalidSuite }),
    /conformance case basic input/,
  )
})

test('an error expectation must name a declared operation error', async () => {
  const invalidSuite = structuredClone(suite)
  invalidSuite.cases[0].expect = { outcome: 'error', code: 'UNDECLARED' }
  await assert.rejects(
    validateContractSet({ profile, suite: invalidSuite }),
    /undeclared error code UNDECLARED/,
  )
})

test('an exact expectation must satisfy the canonical output schema', async () => {
  const invalidSuite = structuredClone(suite)
  invalidSuite.cases[0].expect = {
    outcome: 'success',
    match: 'exact',
    value: { normalized: 42 },
  }
  await assert.rejects(
    validateContractSet({ profile, suite: invalidSuite }),
    /exact expectation/,
  )
})

test('a provider cannot declare the same capability version twice', async () => {
  const invalidManifest = structuredClone(manifest)
  invalidManifest.implementations.push(structuredClone(invalidManifest.implementations[0]))
  await assert.rejects(
    validateContractSet({ profile, suite, manifest: invalidManifest }),
    /provider implementations: duplicate id/,
  )
})

test('the canonical time-zone profile excludes provider presentation fields', async () => {
  const definitionPath = fileURLToPath(
    new URL('../catalog/capabilities/time-zone-convert.v0.2.json', import.meta.url),
  )
  const timeZoneDefinition = await loadJson(definitionPath)
  const schemas = await resolveOperationSchemas(timeZoneDefinition, definitionPath)
  const { input, output } = schemas.get('convert')
  assert.throws(
    () =>
      validateAgainstSchema(
        input,
        {
          localDateTime: '2026-08-03T16:30',
          sourceTimeZone: 'Asia/Shanghai',
          targetTimeZones: ['Europe/London'],
          locale: 'en',
        },
        'canonical input',
      ),
    /additional properties/,
  )
  assert.throws(
    () =>
      validateAgainstSchema(
        output,
        {
          status: 'converted',
          source: {
            localDateTime: '2026-08-03T16:30',
            timeZone: 'Asia/Shanghai',
          },
          context: { calendar: 'iso8601', timeZoneDatabase: '2026a' },
          instant: '2026-08-03T08:30:00Z',
          results: [],
          copyText: 'provider presentation',
        },
        'canonical output',
      ),
    /additional properties/,
  )
})
