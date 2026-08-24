import { readFile } from 'node:fs/promises'
import { dirname, isAbsolute, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import Ajv from 'ajv'
import Ajv2020 from 'ajv/dist/2020.js'
import addFormats from 'ajv-formats'

const moduleRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

const schemaFiles = new Map([
  ['openadam.capability-definition.v0.1', 'schemas/capability-definition.schema.json'],
  ['openadam.capability-profile.v0.2', 'schemas/capability-profile.schema.v0.2.json'],
  ['openadam.capability-profile.v0.3', 'schemas/capability-profile.schema.v0.3.json'],
  ['openadam.provider-manifest.v0.1', 'schemas/provider-manifest.schema.json'],
  ['openadam.provider-manifest.v0.2', 'schemas/provider-manifest.schema.v0.2.json'],
  ['openadam.conformance-suite.v0.1', 'schemas/conformance-suite.schema.json'],
  ['openadam.conformance-suite.v0.2', 'schemas/conformance-suite.schema.v0.2.json'],
])

export async function loadJson(path) {
  const source = await readFile(path, 'utf8')
  return parseJson(source, path)
}

export function parseJson(source, label = 'JSON') {
  assertNoDuplicateObjectKeys(source, label)
  return JSON.parse(source)
}

function assertNoDuplicateObjectKeys(source, label) {
  let offset = 0

  function skipWhitespace() {
    while (/\s/u.test(source[offset] ?? '')) offset += 1
  }

  function parseString() {
    const start = offset
    offset += 1
    while (offset < source.length) {
      if (source[offset] === '\\') {
        offset += 2
      } else if (source[offset] === '"') {
        offset += 1
        return JSON.parse(source.slice(start, offset))
      } else {
        offset += 1
      }
    }
    throw new Error(`${label}: unterminated JSON string`)
  }

  function parseValue() {
    skipWhitespace()
    if (source[offset] === '{') return parseObject()
    if (source[offset] === '[') return parseArray()
    if (source[offset] === '"') {
      parseString()
      return
    }
    while (offset < source.length && !/[\s,\]}]/u.test(source[offset])) offset += 1
  }

  function parseObject() {
    const keys = new Set()
    offset += 1
    skipWhitespace()
    if (source[offset] === '}') {
      offset += 1
      return
    }
    while (offset < source.length) {
      skipWhitespace()
      if (source[offset] !== '"') return
      const key = parseString()
      if (keys.has(key)) throw new Error(`${label}: duplicate JSON object key ${key}`)
      keys.add(key)
      skipWhitespace()
      if (source[offset] !== ':') return
      offset += 1
      parseValue()
      skipWhitespace()
      if (source[offset] === '}') {
        offset += 1
        return
      }
      if (source[offset] !== ',') return
      offset += 1
    }
  }

  function parseArray() {
    offset += 1
    skipWhitespace()
    if (source[offset] === ']') {
      offset += 1
      return
    }
    while (offset < source.length) {
      parseValue()
      skipWhitespace()
      if (source[offset] === ']') {
        offset += 1
        return
      }
      if (source[offset] !== ',') return
      offset += 1
    }
  }

  parseValue()
}

function createAjv(schema) {
  const Constructor = schema?.$schema?.includes('draft-07') ? Ajv : Ajv2020
  const ajv = new Constructor({ allErrors: true, strict: false, validateFormats: true })
  addFormats(ajv)
  return ajv
}

function formatErrors(errors = []) {
  return errors
    .map((error) => `${error.instancePath || '/'} ${error.message}`)
    .join('; ')
}

export async function validateDocument(document, label = 'document') {
  const schemaFile = schemaFiles.get(document?.schemaVersion)
  if (schemaFile === undefined) {
    throw new Error(`${label}: unsupported or missing schemaVersion`)
  }
  const schema = await loadJson(resolve(moduleRoot, schemaFile))
  const validate = createAjv(schema).compile(schema)
  if (!validate(document)) {
    throw new Error(`${label}: ${formatErrors(validate.errors)}`)
  }
}

export function canonicalJson(value) {
  if (value === null || typeof value === 'boolean') return JSON.stringify(value)
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('JCS does not permit non-finite numbers')
    return JSON.stringify(value)
  }
  if (typeof value === 'string') {
    assertUnicodeScalarString(value)
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) {
    const items = []
    for (let index = 0; index < value.length; index += 1) {
      if (!Object.hasOwn(value, index)) throw new Error('JCS does not permit sparse arrays')
      items.push(canonicalJson(value[index]))
    }
    return `[${items.join(',')}]`
  }
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => {
        assertUnicodeScalarString(key)
        return `${JSON.stringify(key)}:${canonicalJson(value[key])}`
      })
      .join(',')}}`
  }
  throw new Error(`JCS cannot serialize ${typeof value}`)
}

function assertUnicodeScalarString(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1)
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        throw new Error('JCS does not permit lone Unicode surrogates')
      }
      index += 1
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      throw new Error('JCS does not permit lone Unicode surrogates')
    }
  }
}

export function schemaDigest(schema) {
  return `sha256:${createHash('sha256').update(canonicalJson(schema)).digest('hex')}`
}

async function resolveOperationSchema(schema, profileBase, label) {
  const reference = schema?.$ref
  if (
    typeof reference !== 'string' ||
    (!reference.startsWith('./') && !reference.startsWith('../'))
  ) {
    return schema
  }
  if (profileBase === undefined) {
    throw new Error(`${label}: relative schema reference requires a profile base path`)
  }
  const schemaPath = resolve(profileBase, reference)
  const allowedRoot = resolve(profileBase, '..')
  if (schemaPath !== allowedRoot && !schemaPath.startsWith(`${allowedRoot}/`)) {
    throw new Error(`${label}: schema reference escapes the catalog capability root`)
  }
  return loadJson(schemaPath)
}

export async function resolveOperationSchemas(profile, profilePath) {
  const profileBase = profilePath === undefined ? undefined : dirname(profilePath)
  const resolved = new Map()
  for (const operation of profile.operations) {
    resolved.set(operation.id, {
      input: await resolveOperationSchema(
        operation.inputSchema,
        profileBase,
        `${operation.id} inputSchema`,
      ),
      output: await resolveOperationSchema(
        operation.outputSchema,
        profileBase,
        `${operation.id} outputSchema`,
      ),
    })
  }
  return resolved
}

export function deepSubset(actual, expected) {
  if (Array.isArray(expected)) {
    return (
      Array.isArray(actual) &&
      actual.length === expected.length &&
      expected.every((item, index) => deepSubset(actual[index], item))
    )
  }
  if (expected !== null && typeof expected === 'object') {
    if (actual === null || typeof actual !== 'object' || Array.isArray(actual)) return false
    return Object.entries(expected).every(([key, value]) =>
      Object.hasOwn(actual, key) && deepSubset(actual[key], value),
    )
  }
  return Object.is(actual, expected)
}

export function validateAgainstSchema(schema, value, label) {
  const validate = createAjv(schema).compile(schema)
  if (!validate(value)) {
    throw new Error(`${label}: ${formatErrors(validate.errors)}`)
  }
}

function assertUnique(values, label) {
  const seen = new Set()
  for (const value of values) {
    if (seen.has(value)) throw new Error(`${label}: duplicate id ${value}`)
    seen.add(value)
  }
}

export async function validateContractSet({
  profile,
  profilePath,
  definition,
  definitionPath,
  manifest,
  suite,
}) {
  if (profile !== undefined && definition !== undefined) {
    throw new Error('provide either profile or legacy definition, not both')
  }
  const resolvedProfile = profile ?? definition
  const resolvedProfilePath = profilePath ?? definitionPath
  if (resolvedProfile === undefined) throw new Error('capability profile is required')
  await validateDocument(resolvedProfile, 'capability profile')
  await validateDocument(suite, 'conformance suite')
  if (manifest !== undefined) await validateDocument(manifest, 'provider manifest')

  if (
    suite.capabilityId !== resolvedProfile.id ||
    suite.capabilityVersion !== resolvedProfile.version
  ) {
    throw new Error('conformance suite capability identity does not match profile')
  }

  assertUnique(resolvedProfile.operations.map((operation) => operation.id), 'profile operations')
  assertUnique(suite.cases.map((testCase) => testCase.id), 'conformance cases')

  const operations = new Map(
    resolvedProfile.operations.map((operation) => [operation.id, operation]),
  )
  for (const operation of resolvedProfile.operations) {
    assertUnique(
      operation.errors.map((error) => error.code),
      `${operation.id} errors`,
    )
  }
  const operationSchemas = await resolveOperationSchemas(resolvedProfile, resolvedProfilePath)
  const covered = new Set()
  const casesByOperation = new Map(
    resolvedProfile.operations.map((operation) => [operation.id, []]),
  )
  for (const testCase of suite.cases) {
    const operation = operations.get(testCase.operationId)
    if (operation === undefined) {
      throw new Error(`conformance case ${testCase.id}: unknown operation ${testCase.operationId}`)
    }
    validateAgainstSchema(
      operationSchemas.get(operation.id).input,
      testCase.input,
      `conformance case ${testCase.id} input`,
    )
    if (testCase.expect.outcome === 'error') {
      const declaredErrors = new Set(operation.errors.map((error) => error.code))
      if (!declaredErrors.has(testCase.expect.code)) {
        throw new Error(
          `conformance case ${testCase.id}: undeclared error code ${testCase.expect.code}`,
        )
      }
    } else if (testCase.expect.match === 'exact') {
      validateAgainstSchema(
        operationSchemas.get(operation.id).output,
        testCase.expect.value,
        `conformance case ${testCase.id} exact expectation`,
      )
    }
    covered.add(testCase.operationId)
    casesByOperation.get(testCase.operationId).push(testCase)
  }
  const uncovered = [...operations.keys()].filter((id) => !covered.has(id))
  if (uncovered.length > 0) {
    throw new Error(`operations without conformance cases: ${uncovered.join(', ')}`)
  }
  if (suite.claimLevel === 'L1') {
    for (const operation of resolvedProfile.operations) {
      const operationCases = casesByOperation.get(operation.id)
      const successCases = operationCases.filter((testCase) => testCase.expect.outcome === 'success')
      if (!successCases.some((testCase) => testCase.facets?.includes('normal'))) {
        throw new Error(`${operation.id}: L1 requires a normal success case`)
      }
      if (!operationCases.some((testCase) => testCase.facets?.includes('boundary'))) {
        throw new Error(`${operation.id}: L1 requires a boundary case`)
      }
      if (
        operation.semantics.ambiguity !== 'not-applicable'
        && !operationCases.some((testCase) => testCase.facets?.includes('ambiguity'))
      ) {
        throw new Error(`${operation.id}: L1 requires an ambiguity case`)
      }
      const coveredErrors = new Set(
        operationCases
          .filter((testCase) => testCase.expect.outcome === 'error')
          .map((testCase) => testCase.expect.code),
      )
      const uncoveredErrors = operation.errors
        .map((error) => error.code)
        .filter((code) => !coveredErrors.has(code))
      if (uncoveredErrors.length > 0) {
        throw new Error(
          `${operation.id}: L1 does not cover stable errors ${uncoveredErrors.join(', ')}`,
        )
      }
    }
  }

  if (manifest === undefined) return

  assertUnique(
    manifest.implementations.map(
      (candidate) => `${candidate.capabilityId}@${candidate.capabilityVersion}`,
    ),
    'provider implementations',
  )

  const implementation = manifest.implementations.find(
    (candidate) =>
      candidate.capabilityId === resolvedProfile.id &&
      candidate.capabilityVersion === resolvedProfile.version,
  )
  if (implementation === undefined) {
    throw new Error(
      `provider ${manifest.provider.id} does not implement ${resolvedProfile.id}@${resolvedProfile.version}`,
    )
  }
  if (implementation.adapter.cwd !== undefined && isAbsolute(implementation.adapter.cwd)) {
    throw new Error('provider adapter cwd must be relative to the provider root')
  }
  if (implementation.adapterBindings !== undefined) {
    assertUnique(
      implementation.adapterBindings.map((binding) => binding.operationId),
      'provider adapter bindings',
    )
    const adapterOperationIds = new Set(
      implementation.adapterBindings.map((binding) => binding.operationId),
    )
    const extraAdapterBindings = [...adapterOperationIds].filter((id) => !operations.has(id))
    const missingAdapterBindings = [...operations.keys()].filter(
      (id) => !adapterOperationIds.has(id),
    )
    if (extraAdapterBindings.length > 0 || missingAdapterBindings.length > 0) {
      throw new Error(
        `provider adapter binding mismatch; missing=[${missingAdapterBindings.join(', ')}], `
        + `extra=[${extraAdapterBindings.join(', ')}]`,
      )
    }
  }
  if (
    implementation.transportSchemaProbe?.cwd !== undefined
    && isAbsolute(implementation.transportSchemaProbe.cwd)
  ) {
    throw new Error('transport schema probe cwd must be relative to the provider root')
  }
  assertUnique(implementation.bindings.map((binding) => binding.operationId), 'provider bindings')
  const bindings = new Map(
    implementation.bindings.map((binding) => [binding.operationId, binding]),
  )
  const extra = [...bindings.keys()].filter((id) => !operations.has(id))
  const missing = [...operations.keys()].filter((id) => !bindings.has(id))
  if (extra.length > 0 || missing.length > 0) {
    throw new Error(
      `provider binding mismatch; missing=[${missing.join(', ')}], extra=[${extra.join(', ')}]`,
    )
  }
  for (const [operationId, operation] of operations) {
    const binding = bindings.get(operationId)
    const schemas = operationSchemas.get(operationId)
    if (binding.contractSchemaDigests.input !== schemaDigest(schemas.input)) {
      throw new Error(`${operationId}: provider input schema digest differs from capability contract`)
    }
    if (binding.contractSchemaDigests.output !== schemaDigest(schemas.output)) {
      throw new Error(`${operationId}: provider output schema digest differs from capability contract`)
    }
  }
  return { implementation, operationSchemas }
}
