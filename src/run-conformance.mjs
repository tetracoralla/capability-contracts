#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { isAbsolute, resolve } from 'node:path'
import {
  canonicalJson,
  deepSubset,
  loadJson,
  parseJson,
  validateAgainstSchema,
  validateContractSet,
} from './lib/contracts.mjs'

const maxRequestLineBytes = 1024 * 1024
const maxResponseLineBytes = 1024 * 1024
const maxStderrBytes = 64 * 1024
const shutdownTimeoutMs = 2000

function parseArgs(argv) {
  const values = new Map()
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index]
    const value = argv[index + 1]
    if (!flag?.startsWith('--') || value === undefined) {
      throw new Error(
        'Usage: run-conformance.mjs --profile FILE --suite FILE --manifest FILE '
        + '--provider-root DIR (legacy: --definition FILE)',
      )
    }
    values.set(flag.slice(2), value)
  }
  if (values.has('profile') === values.has('definition')) {
    throw new Error('Exactly one of --profile or legacy --definition is required')
  }
  for (const required of ['suite', 'manifest', 'provider-root']) {
    if (!values.has(required)) throw new Error(`Missing --${required}`)
  }
  return values
}

function assertExpectation(testCase, response, outputSchema) {
  if (response === null || typeof response !== 'object' || Array.isArray(response)) {
    throw new Error('provider response must be an object')
  }
  const responseKeys = Object.keys(response).sort()
  const expectedKeys = response.ok === true ? ['id', 'ok', 'result'] : ['error', 'id', 'ok']
  if (canonicalJson(responseKeys) !== canonicalJson(expectedKeys)) {
    throw new Error(`invalid provider response fields: ${responseKeys.join(', ')}`)
  }
  if (response.ok === false) {
    if (
      response.error === null ||
      typeof response.error !== 'object' ||
      Array.isArray(response.error) ||
      !/^[A-Z][A-Z0-9_]*$/.test(response.error.code) ||
      typeof response.error.message !== 'string' ||
      response.error.message.length === 0
    ) {
      throw new Error('invalid provider error envelope')
    }
  } else if (response.ok !== true) {
    throw new Error('provider response ok must be true or false')
  }
  if (testCase.expect.outcome === 'error') {
    if (response.ok !== false) throw new Error('expected an error response')
    if (testCase.expect.code !== undefined && response.error?.code !== testCase.expect.code) {
      throw new Error(`expected error code ${testCase.expect.code}, got ${response.error?.code}`)
    }
    if (
      testCase.expect.messageIncludes !== undefined &&
      !String(response.error?.message ?? '').includes(testCase.expect.messageIncludes)
    ) {
      throw new Error(`error message does not include ${testCase.expect.messageIncludes}`)
    }
    return
  }
  if (response.ok !== true) {
    throw new Error(`expected success, got ${response.error?.code ?? 'unknown error'}`)
  }
  validateAgainstSchema(outputSchema, response.result, `${testCase.id} result`)
  if (testCase.expect.match === 'exact') {
    if (canonicalJson(response.result) !== canonicalJson(testCase.expect.value)) {
      throw new Error('result did not exactly match expected value')
    }
  } else if (
    testCase.expect.match === 'subset' &&
    !deepSubset(response.result, testCase.expect.value)
  ) {
    throw new Error('result did not contain expected subset')
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const profilePath = resolve(args.get('profile') ?? args.get('definition'))
  const profile = await loadJson(profilePath)
  const suite = await loadJson(resolve(args.get('suite')))
  const manifest = await loadJson(resolve(args.get('manifest')))
  const { operationSchemas } = await validateContractSet({
    profile,
    profilePath,
    manifest,
    suite,
  })

  const implementation = manifest.implementations.find(
    (candidate) =>
      candidate.capabilityId === profile.id &&
      candidate.capabilityVersion === profile.version,
  )
  const providerRoot = resolve(args.get('provider-root'))
  const adapterCwd = resolve(providerRoot, implementation.adapter.cwd ?? '.')
  if (!adapterCwd.startsWith(`${providerRoot}/`) && adapterCwd !== providerRoot) {
    throw new Error('provider adapter cwd escapes the provider root')
  }
  const child = spawn(implementation.adapter.command, implementation.adapter.args, {
    cwd: adapterCwd,
    env: { ...process.env, OPENADAM_PROVIDER_ROOT: providerRoot },
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  const pending = new Map()
  let adapterFailure
  let stdoutBuffer = ''
  let stderr = ''
  let stderrBytes = 0
  let closing = false

  const exitPromise = new Promise((resolveExit) => {
    child.once('close', (code, signal) => resolveExit({ code, signal }))
  })

  function terminateAdapter() {
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL')
  }

  function failAdapter(error) {
    if (adapterFailure !== undefined) return
    adapterFailure = error instanceof Error ? error : new Error(String(error))
    for (const entry of pending.values()) {
      clearTimeout(entry.timer)
      entry.reject(adapterFailure)
    }
    pending.clear()
    terminateAdapter()
  }

  function handleResponseLine(line) {
    if (Buffer.byteLength(line, 'utf8') > maxResponseLineBytes) {
      failAdapter(new Error(`provider response exceeds ${maxResponseLineBytes} bytes`))
      return
    }
    try {
      const response = parseJson(line, 'provider response')
      const entry = pending.get(response?.id)
      if (entry === undefined) {
        throw new Error(`provider returned an unknown or duplicate response id ${response?.id}`)
      }
      pending.delete(response.id)
      clearTimeout(entry.timer)
      entry.resolve(response)
    } catch (error) {
      failAdapter(error)
    }
  }

  child.stdout.setEncoding('utf8')
  child.stdout.on('data', (chunk) => {
    if (adapterFailure !== undefined) return
    stdoutBuffer += chunk
    if (Buffer.byteLength(stdoutBuffer, 'utf8') > maxResponseLineBytes) {
      failAdapter(new Error(`provider response exceeds ${maxResponseLineBytes} bytes`))
      return
    }
    let newlineIndex = stdoutBuffer.indexOf('\n')
    while (newlineIndex !== -1) {
      const line = stdoutBuffer.slice(0, newlineIndex)
      stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1)
      handleResponseLine(line)
      if (adapterFailure !== undefined) return
      newlineIndex = stdoutBuffer.indexOf('\n')
    }
  })
  child.stderr.on('data', (chunk) => {
    stderrBytes += chunk.length
    if (stderrBytes > maxStderrBytes) {
      failAdapter(new Error(`provider stderr exceeds ${maxStderrBytes} bytes`))
      return
    }
    stderr += chunk.toString()
  })
  child.once('error', failAdapter)
  child.once('exit', (code, signal) => {
    if (closing && pending.size === 0) return
    if (pending.size > 0) {
      failAdapter(
        new Error(
          `provider adapter exited before completion: code=${code} signal=${signal}${
            stderr === '' ? '' : ` stderr=${stderr.trim()}`
          }`,
        ),
      )
    }
  })

  const bindings = new Map(
    implementation.bindings.map((binding) => [binding.operationId, binding]),
  )
  let passed = 0
  try {
    for (const testCase of suite.cases) {
      if (adapterFailure !== undefined) throw adapterFailure
      const response = await new Promise((resolveResponse, rejectResponse) => {
        const timer = setTimeout(() => {
          pending.delete(testCase.id)
          const error = new Error(`timed out after ${testCase.timeoutMs ?? 10000}ms`)
          rejectResponse(error)
          failAdapter(error)
        }, testCase.timeoutMs ?? 10000)
        pending.set(testCase.id, { resolve: resolveResponse, reject: rejectResponse, timer })
        const requestLine = `${JSON.stringify({
          id: testCase.id,
          operationId: testCase.operationId,
          input: testCase.input,
        })}\n`
        if (Buffer.byteLength(requestLine, 'utf8') > maxRequestLineBytes) {
          const error = new Error(
            `${testCase.id}: provider request exceeds ${maxRequestLineBytes} bytes`,
          )
          clearTimeout(timer)
          pending.delete(testCase.id)
          rejectResponse(error)
          failAdapter(error)
          return
        }
        child.stdin.write(requestLine)
      })
      try {
        if (adapterFailure !== undefined) throw adapterFailure
        assertExpectation(testCase, response, operationSchemas.get(testCase.operationId).output)
        passed += 1
        console.log(`PASS ${testCase.id}`)
      } catch (error) {
        throw new Error(
          `${testCase.id}: ${error instanceof Error ? error.message : String(error)}`,
        )
      }
    }
  } finally {
    closing = true
    child.stdin.end()
    let shutdownTimer
    const exit = await Promise.race([
      exitPromise,
      new Promise((resolveExit) => {
        shutdownTimer = setTimeout(() => resolveExit(undefined), shutdownTimeoutMs)
      }),
    ])
    clearTimeout(shutdownTimer)
    if (exit === undefined) {
      terminateAdapter()
      await exitPromise
      if (adapterFailure === undefined) {
        throw new Error(`provider adapter did not exit within ${shutdownTimeoutMs}ms`)
      }
    } else if (adapterFailure === undefined && (exit.code !== 0 || exit.signal !== null)) {
      throw new Error(
        `provider adapter shutdown failed: code=${exit.code} signal=${exit.signal}${
          stderr === '' ? '' : ` stderr=${stderr.trim()}`
        }`,
      )
    }
  }
  if (adapterFailure !== undefined) throw adapterFailure
  if (stdoutBuffer !== '') throw new Error('provider adapter ended with a partial response line')
  console.log(
    `PASS canonical-adapter provider=${manifest.provider.id}@${manifest.provider.version} `
    + `capability=${profile.id}@${profile.version} cases=${passed}`,
  )
}

main().catch((error) => {
  console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
