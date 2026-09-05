#!/usr/bin/env node

import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'
import {
  canonicalJson,
  loadJson,
  parseJson,
  resolveContainedRealPath,
  validateAgainstSchema,
  validateContractSet,
  validateDifferentialSuite,
} from './lib/contracts.mjs'

const maxRequestLineBytes = 1024 * 1024
const maxResponseLineBytes = 1024 * 1024
const maxStderrBytes = 64 * 1024
const preShutdownLivenessMs = 25
const shutdownTimeoutMs = 2000
const forcedShutdownTimeoutMs = 500

function valueDigest(value) {
  return `sha256:${createHash('sha256').update(canonicalJson(value)).digest('hex')}`
}

function sourceIdentity(sourceRoot) {
  const result = spawnSync(
    'git',
    ['-C', sourceRoot, 'rev-parse', '--show-toplevel', 'HEAD'],
    { encoding: 'utf8', timeout: 2000, maxBuffer: 64 * 1024 },
  )
  const [repositoryRoot, revision] = result.status === 0
    ? result.stdout.trim().split('\n')
    : [undefined, undefined]
  let dirty
  if (repositoryRoot !== undefined) {
    const status = spawnSync(
      'git',
      ['-C', repositoryRoot, 'status', '--porcelain=v1', '--untracked-files=all'],
      { encoding: 'utf8', timeout: 2000, maxBuffer: 64 * 1024 },
    )
    dirty = status.status === 0 ? status.stdout !== '' : undefined
  }
  return {
    sourceRoot,
    ...(repositoryRoot === undefined ? {} : { repositoryRoot, revision, dirty }),
  }
}

function parseArgs(argv) {
  const allowed = new Set([
    'profile',
    'conformance-suite',
    'differential-suite',
    'left-manifest',
    'left-provider-root',
    'right-manifest',
    'right-provider-root',
  ])
  const values = new Map()
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index]
    const value = argv[index + 1]
    if (!flag?.startsWith('--') || value === undefined) {
      throw new Error(
        'Usage: run-differential.mjs --profile FILE --conformance-suite FILE '
        + '--differential-suite FILE --left-manifest FILE --left-provider-root DIR '
        + '--right-manifest FILE --right-provider-root DIR',
      )
    }
    const name = flag.slice(2)
    if (!allowed.has(name)) throw new Error(`Unknown --${name}`)
    if (values.has(name)) throw new Error(`Duplicate --${name}`)
    values.set(name, value)
  }
  for (const required of allowed) {
    if (!values.has(required)) throw new Error(`Missing --${required}`)
  }
  return values
}

function validateResponse(response, requestId, operation, operationSchemas) {
  if (response === null || typeof response !== 'object' || Array.isArray(response)) {
    throw new Error('provider response must be an object')
  }
  const responseKeys = Object.keys(response).sort()
  const expectedKeys = response.ok === true ? ['id', 'ok', 'result'] : ['error', 'id', 'ok']
  if (canonicalJson(responseKeys) !== canonicalJson(expectedKeys)) {
    throw new Error(`invalid provider response fields: ${responseKeys.join(', ')}`)
  }
  if (response.id !== requestId) {
    throw new Error(`provider response id ${response.id} does not match request ${requestId}`)
  }
  if (response.ok === true) {
    validateAgainstSchema(operationSchemas.output, response.result, `${requestId} result`)
    return {
      outcome: 'success',
      value: structuredClone(response.result),
    }
  }
  if (response.ok !== false) throw new Error('provider response ok must be true or false')
  const errorKeys = Object.keys(response.error ?? {}).sort()
  const validErrorKeys =
    canonicalJson(errorKeys) === canonicalJson(['code', 'message'])
    || canonicalJson(errorKeys) === canonicalJson(['code', 'message', 'retryable'])
  if (
    response.error === null
    || typeof response.error !== 'object'
    || Array.isArray(response.error)
    || !validErrorKeys
    || !/^[A-Z][A-Z0-9_]*$/.test(response.error.code)
    || typeof response.error.message !== 'string'
    || response.error.message.length === 0
  ) {
    throw new Error('invalid provider error envelope')
  }
  const declaration = operation.errors.find((candidate) => candidate.code === response.error.code)
  if (declaration === undefined) {
    throw new Error(`provider returned undeclared error code ${response.error.code}`)
  }
  if (
    Object.hasOwn(response.error, 'retryable')
    && (
      typeof response.error.retryable !== 'boolean'
      || response.error.retryable !== declaration.retryable
    )
  ) {
    throw new Error(
      `provider error retryable for ${response.error.code} differs from the Capability Profile`,
    )
  }
  return {
    outcome: 'error',
    code: response.error.code,
    retryable: declaration.retryable,
  }
}

function decodePointerSegment(segment) {
  return segment.replaceAll('~1', '/').replaceAll('~0', '~')
}

function resolvePointerLocation(value, pointer, label) {
  const segments = pointer.slice(1).split('/').map(decodePointerSegment)
  let parent = value
  for (const segment of segments.slice(0, -1)) {
    if (
      parent === null
      || typeof parent !== 'object'
      || !Object.hasOwn(parent, segment)
    ) {
      throw new Error(`${label}: ignored path ${pointer} is absent`)
    }
    parent = parent[segment]
  }
  const finalSegment = segments.at(-1)
  if (
    parent === null
    || typeof parent !== 'object'
    || !Object.hasOwn(parent, finalSegment)
  ) {
    throw new Error(`${label}: ignored path ${pointer} is absent`)
  }
  if (Array.isArray(parent)) {
    if (!/^(0|[1-9][0-9]*)$/u.test(finalSegment)) {
      throw new Error(`${label}: ignored array path ${pointer} has an invalid index`)
    }
    return { parent, key: Number(finalSegment), pointer }
  }
  return { parent, key: finalSegment, pointer }
}

function normalizeForComparison(outcome, ignoredPointers, label) {
  if (outcome.outcome === 'error') {
    if (ignoredPointers.length > 0) {
      throw new Error(`${label}: ignored result paths require a successful outcome`)
    }
    return outcome
  }
  const locations = ignoredPointers.map((pointer) => (
    resolvePointerLocation(outcome.value, pointer, label)
  ))
  const arrayLocations = new Map()
  for (const location of locations) {
    if (Array.isArray(location.parent)) {
      const siblings = arrayLocations.get(location.parent) ?? []
      siblings.push(location)
      arrayLocations.set(location.parent, siblings)
    } else {
      delete location.parent[location.key]
    }
  }
  for (const siblings of arrayLocations.values()) {
    siblings.sort((left, right) => right.key - left.key)
    for (const location of siblings) location.parent.splice(location.key, 1)
  }
  return outcome
}

class AdapterSession {
  static async start(manifest, implementation, providerRootPath) {
    const adapterCwdPath = resolve(providerRootPath, implementation.adapter.cwd ?? '.')
    const { root: providerRoot, path: adapterCwd } = await resolveContainedRealPath(
      providerRootPath,
      adapterCwdPath,
      'provider adapter cwd escapes the provider root',
    )
    return new AdapterSession(manifest, implementation, providerRoot, adapterCwd)
  }

  constructor(manifest, implementation, providerRoot, adapterCwd) {
    this.label = `${manifest.provider.id}@${manifest.provider.version}`
    this.providerRoot = providerRoot
    this.child = spawn(implementation.adapter.command, implementation.adapter.args, {
      cwd: adapterCwd,
      env: { ...process.env, OPENADAM_PROVIDER_ROOT: providerRoot },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    this.pending = new Map()
    this.stdoutBuffer = ''
    this.stderr = ''
    this.stderrBytes = 0
    this.failure = undefined
    this.closing = false
    this.shutdownInitiated = false
    this.aborting = false
    this.exitPromise = new Promise((resolveExit) => {
      this.child.once('close', (code, signal) => resolveExit({ code, signal }))
    })
    this.child.stdout.setEncoding('utf8')
    this.child.stdout.on('data', (chunk) => this.handleStdout(chunk))
    this.child.stderr.on('data', (chunk) => this.handleStderr(chunk))
    this.child.stdin.on('error', (error) => {
      if (!this.closing) this.fail(error)
    })
    this.child.once('error', (error) => this.fail(error))
    this.child.once('exit', (code, signal) => {
      if (!this.shutdownInitiated) {
        this.fail(
          new Error(
            `${this.label} adapter exited before shutdown: code=${code} signal=${signal}`
            + (this.stderr === '' ? '' : ` stderrBytes=${this.stderrBytes}`),
          ),
        )
      }
    })
  }

  terminate() {
    if (this.child.exitCode === null && this.child.signalCode === null) this.child.kill('SIGKILL')
  }

  rejectPending(error) {
    for (const entry of this.pending.values()) {
      clearTimeout(entry.timer)
      entry.reject(error)
    }
    this.pending.clear()
  }

  fail(error) {
    if (this.failure !== undefined) return
    this.failure = error instanceof Error ? error : new Error(String(error))
    this.rejectPending(this.failure)
    this.terminate()
  }

  handleStdout(chunk) {
    if (this.failure !== undefined || this.aborting) return
    this.stdoutBuffer += chunk
    let newlineIndex = this.stdoutBuffer.indexOf('\n')
    while (newlineIndex !== -1) {
      const line = this.stdoutBuffer.slice(0, newlineIndex)
      this.stdoutBuffer = this.stdoutBuffer.slice(newlineIndex + 1)
      if (Buffer.byteLength(line, 'utf8') > maxResponseLineBytes) {
        this.fail(new Error(`${this.label} response exceeds ${maxResponseLineBytes} bytes`))
        return
      }
      try {
        const response = parseJson(line, `${this.label} response`)
        const entry = this.pending.get(response?.id)
        if (entry === undefined) {
          throw new Error(
            `${this.label} returned an unknown or duplicate response id ${response?.id}`,
          )
        }
        this.pending.delete(response.id)
        clearTimeout(entry.timer)
        entry.resolve(response)
      } catch (error) {
        this.fail(error)
        return
      }
      newlineIndex = this.stdoutBuffer.indexOf('\n')
    }
    if (Buffer.byteLength(this.stdoutBuffer, 'utf8') > maxResponseLineBytes) {
      this.fail(new Error(`${this.label} response exceeds ${maxResponseLineBytes} bytes`))
    }
  }

  handleStderr(chunk) {
    this.stderrBytes += chunk.length
    if (this.stderrBytes > maxStderrBytes) {
      this.fail(new Error(`${this.label} stderr exceeds ${maxStderrBytes} bytes`))
      return
    }
    this.stderr += chunk.toString()
  }

  request(testCase) {
    if (this.failure !== undefined) return Promise.reject(this.failure)
    const requestLine = `${JSON.stringify({
      id: testCase.id,
      operationId: testCase.operationId,
      input: testCase.input,
    })}\n`
    if (Buffer.byteLength(requestLine, 'utf8') > maxRequestLineBytes) {
      return Promise.reject(
        new Error(`${testCase.id}: provider request exceeds ${maxRequestLineBytes} bytes`),
      )
    }
    return new Promise((resolveResponse, rejectResponse) => {
      const timer = setTimeout(() => {
        this.pending.delete(testCase.id)
        const error = new Error(
          `${this.label} ${testCase.id}: timed out after ${testCase.timeoutMs ?? 10000}ms`,
        )
        rejectResponse(error)
        this.fail(error)
      }, testCase.timeoutMs ?? 10000)
      this.pending.set(testCase.id, { resolve: resolveResponse, reject: rejectResponse, timer })
      this.child.stdin.write(requestLine)
    })
  }

  async close() {
    let livenessTimer
    const earlyExit = await Promise.race([
      this.exitPromise,
      new Promise((resolveExit) => {
        livenessTimer = setTimeout(() => resolveExit(undefined), preShutdownLivenessMs)
      }),
    ])
    clearTimeout(livenessTimer)
    if (earlyExit !== undefined && this.failure === undefined) {
      this.fail(
        new Error(
          `${this.label} adapter exited before shutdown: code=${earlyExit.code} signal=${earlyExit.signal}`
          + (this.stderr === '' ? '' : ` stderrBytes=${this.stderrBytes}`),
        ),
      )
    }
    this.closing = true
    if (this.pending.size > 0) {
      this.aborting = true
      this.rejectPending(new Error(`${this.label} request cancelled during shutdown`))
    }
    this.shutdownInitiated = true
    this.child.stdin.end()
    let shutdownTimer
    let exit = await Promise.race([
      this.exitPromise,
      new Promise((resolveExit) => {
        shutdownTimer = setTimeout(() => resolveExit(undefined), shutdownTimeoutMs)
      }),
    ])
    clearTimeout(shutdownTimer)
    if (exit === undefined) {
      this.terminate()
      let forcedTimer
      exit = await Promise.race([
        this.exitPromise,
        new Promise((resolveExit) => {
          forcedTimer = setTimeout(() => resolveExit(undefined), forcedShutdownTimeoutMs)
        }),
      ])
      clearTimeout(forcedTimer)
      if (exit === undefined) {
        this.child.stdin.destroy()
        this.child.stdout.destroy()
        this.child.stderr.destroy()
        this.child.unref()
        throw new Error(
          `${this.label} adapter did not terminate within `
          + `${shutdownTimeoutMs + forcedShutdownTimeoutMs}ms`,
        )
      }
      if (this.failure === undefined) {
        throw new Error(`${this.label} adapter did not exit within ${shutdownTimeoutMs}ms`)
      }
    } else if (this.failure === undefined && (exit.code !== 0 || exit.signal !== null)) {
      throw new Error(
        `${this.label} adapter shutdown failed: code=${exit.code} signal=${exit.signal}`
        + (this.stderr === '' ? '' : ` stderrBytes=${this.stderrBytes}`),
      )
    }
    if (!this.aborting && this.stdoutBuffer !== '') {
      throw new Error(`${this.label} adapter ended with a partial response line`)
    }
    if (this.failure !== undefined) throw this.failure
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const profilePath = resolve(args.get('profile'))
  const profile = await loadJson(profilePath)
  const conformanceSuite = await loadJson(resolve(args.get('conformance-suite')))
  const differentialSuite = await loadJson(resolve(args.get('differential-suite')))
  const leftManifest = await loadJson(resolve(args.get('left-manifest')))
  const rightManifest = await loadJson(resolve(args.get('right-manifest')))
  const leftContract = await validateContractSet({
    profile,
    profilePath,
    suite: conformanceSuite,
    manifest: leftManifest,
  })
  const rightContract = await validateContractSet({
    profile,
    profilePath,
    suite: conformanceSuite,
    manifest: rightManifest,
  })
  const { operationSchemas } = await validateDifferentialSuite({
    profile,
    profilePath,
    suite: differentialSuite,
  })
  if (leftManifest.provider.id === rightManifest.provider.id) {
    throw new Error('differential providers must have distinct provider ids')
  }

  let left
  let right
  let runError
  let closeErrors = []
  let passed = 0
  try {
    left = await AdapterSession.start(
      leftManifest,
      leftContract.implementation,
      resolve(args.get('left-provider-root')),
    )
    right = await AdapterSession.start(
      rightManifest,
      rightContract.implementation,
      resolve(args.get('right-provider-root')),
    )
    for (const testCase of differentialSuite.cases) {
      const [leftResponse, rightResponse] = await Promise.all([
        left.request(testCase),
        right.request(testCase),
      ])
      const operation = profile.operations.find(
        (candidate) => candidate.id === testCase.operationId,
      )
      const leftOutcome = normalizeForComparison(
        validateResponse(
          leftResponse,
          testCase.id,
          operation,
          operationSchemas.get(testCase.operationId),
        ),
        testCase.comparison.ignorePointers,
        `${testCase.id} left result`,
      )
      const rightOutcome = normalizeForComparison(
        validateResponse(
          rightResponse,
          testCase.id,
          operation,
          operationSchemas.get(testCase.operationId),
        ),
        testCase.comparison.ignorePointers,
        `${testCase.id} right result`,
      )
      if (canonicalJson(leftOutcome) !== canonicalJson(rightOutcome)) {
        throw new Error(
          `${testCase.id}: provider outcomes differ; `
          + `leftOutcome=${leftOutcome.outcome} leftDigest=${valueDigest(leftOutcome)} `
          + `rightOutcome=${rightOutcome.outcome} rightDigest=${valueDigest(rightOutcome)}`,
        )
      }
      passed += 1
      console.log(`PASS ${testCase.id}`)
    }
  } catch (error) {
    runError = error
  } finally {
    const closeResults = await Promise.allSettled(
      [left, right].filter((session) => session !== undefined).map((session) => session.close()),
    )
    const failures = closeResults
      .filter((result) => result.status === 'rejected')
      .map((result) => result.reason)
    closeErrors = failures.map((failure) => (
      failure instanceof Error ? failure : new Error(String(failure))
    ))
  }
  if (runError !== undefined) {
    const additionalCloseErrors = closeErrors.filter((error) => error.message !== runError.message)
    if (additionalCloseErrors.length === 0) throw runError
    throw new Error(
      `${runError instanceof Error ? runError.message : String(runError)}; cleanup failures: `
      + additionalCloseErrors.map((error) => error.message).join(' | '),
    )
  }
  if (closeErrors.length > 0) {
    throw new Error(`adapter cleanup failures: ${closeErrors.map((error) => error.message).join(' | ')}`)
  }
  console.log(
    `PASS provider-differential capability=${profile.id}@${profile.version} cases=${passed} `
    + `left=${leftManifest.provider.id}@${leftManifest.provider.version} `
    + `right=${rightManifest.provider.id}@${rightManifest.provider.version} `
    + `sources=${JSON.stringify({
      left: sourceIdentity(left.providerRoot),
      right: sourceIdentity(right.providerRoot),
    })}`,
  )
}

main().catch((error) => {
  console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
