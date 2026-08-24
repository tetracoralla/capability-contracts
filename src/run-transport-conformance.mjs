#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import {
  canonicalJson,
  loadJson,
  parseJson,
  schemaDigest,
  validateContractSet,
} from './lib/contracts.mjs'

const maxLineBytes = 1024 * 1024
const maxStderrBytes = 64 * 1024
const timeoutMs = 10000

function parseArgs(argv) {
  const values = new Map()
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index]
    const value = argv[index + 1]
    if (!flag?.startsWith('--') || value === undefined) {
      throw new Error(
        'Usage: run-transport-conformance.mjs --profile FILE --suite FILE '
        + '--manifest FILE --provider-root DIR',
      )
    }
    values.set(flag.slice(2), value)
  }
  for (const required of ['profile', 'suite', 'manifest', 'provider-root']) {
    if (!values.has(required)) throw new Error(`Missing --${required}`)
  }
  return values
}

function assertProbeResponse(response, profile, implementation) {
  if (response === null || typeof response !== 'object' || Array.isArray(response)) {
    throw new Error('transport schema probe response must be an object')
  }
  const keys = Object.keys(response).sort()
  if (canonicalJson(keys) !== canonicalJson(['bindings', 'id', 'ok'])) {
    throw new Error(`invalid transport schema probe response fields: ${keys.join(', ')}`)
  }
  if (response.id !== 'transport-schema' || response.ok !== true) {
    throw new Error('transport schema probe did not return the requested successful response')
  }
  if (!Array.isArray(response.bindings)) {
    throw new Error('transport schema probe bindings must be an array')
  }
  const declared = implementation.bindings
  if (response.bindings.length !== declared.length) {
    throw new Error('transport schema probe binding count differs from manifest')
  }
  for (const [index, observed] of response.bindings.entries()) {
    const binding = declared[index]
    const expectedKeys = binding.transportSchemaDigests.output === undefined
      ? ['inputSchema', 'operationId', 'target', 'transport']
      : ['inputSchema', 'operationId', 'outputSchema', 'target', 'transport']
    if (
      observed === null
      || typeof observed !== 'object'
      || Array.isArray(observed)
      || canonicalJson(Object.keys(observed).sort()) !== canonicalJson(expectedKeys)
    ) {
      throw new Error(`${binding.operationId}: invalid observed transport binding fields`)
    }
    const operation = profile.operations[index]
    if (
      observed.operationId !== binding.operationId
      || observed.operationId !== operation.id
      || observed.transport !== binding.transport
      || observed.target !== binding.target
    ) {
      throw new Error(`${binding.operationId}: live transport identity or target differs from manifest`)
    }
    if (schemaDigest(observed.inputSchema) !== binding.transportSchemaDigests.input) {
      throw new Error(`${binding.operationId}: live transport input schema digest differs from manifest`)
    }
    if (
      binding.transportSchemaDigests.output !== undefined
      && schemaDigest(observed.outputSchema) !== binding.transportSchemaDigests.output
    ) {
      throw new Error(`${binding.operationId}: live transport output schema digest differs from manifest`)
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const profilePath = resolve(args.get('profile'))
  const profile = await loadJson(profilePath)
  const suite = await loadJson(resolve(args.get('suite')))
  const manifest = await loadJson(resolve(args.get('manifest')))
  const validated = await validateContractSet({ profile, profilePath, manifest, suite })
  const probe = validated.implementation.transportSchemaProbe
  if (probe === undefined) {
    throw new Error('provider manifest has no executable transport schema probe')
  }

  const providerRoot = resolve(args.get('provider-root'))
  const probeCwd = resolve(providerRoot, probe.cwd ?? '.')
  if (probeCwd !== providerRoot && !probeCwd.startsWith(`${providerRoot}/`)) {
    throw new Error('transport schema probe cwd escapes the provider root')
  }
  const child = spawn(probe.command, probe.args, {
    cwd: probeCwd,
    env: { ...process.env, OPENADAM_PROVIDER_ROOT: providerRoot },
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  let stdout = ''
  let stderr = ''
  let stderrBytes = 0
  child.stdout.setEncoding('utf8')
  child.stdout.on('data', (chunk) => {
    stdout += chunk
    if (Buffer.byteLength(stdout) > maxLineBytes) child.kill('SIGKILL')
  })
  child.stderr.on('data', (chunk) => {
    stderrBytes += chunk.length
    if (stderrBytes <= maxStderrBytes) stderr += chunk.toString()
    else child.kill('SIGKILL')
  })
  child.stdin.end(`${JSON.stringify({
    id: 'transport-schema',
    capabilityId: profile.id,
    capabilityVersion: profile.version,
  })}\n`)

  let timer
  const exit = await Promise.race([
    new Promise((resolveExit, rejectExit) => {
      child.once('error', rejectExit)
      child.once('close', (code, signal) => resolveExit({ code, signal }))
    }),
    new Promise((resolveExit) => {
      timer = setTimeout(() => {
        child.kill('SIGKILL')
        resolveExit(undefined)
      }, timeoutMs)
    }),
  ])
  clearTimeout(timer)
  if (exit === undefined) throw new Error(`transport schema probe timed out after ${timeoutMs}ms`)
  if (stderrBytes > maxStderrBytes) throw new Error(`transport schema probe stderr exceeds ${maxStderrBytes} bytes`)
  if (exit.code !== 0 || exit.signal !== null) {
    throw new Error(
      `transport schema probe failed: code=${exit.code} signal=${exit.signal}`
      + (stderr === '' ? '' : ` stderr=${stderr.trim()}`),
    )
  }
  if (Buffer.byteLength(stdout) > maxLineBytes) {
    throw new Error(`transport schema probe response exceeds ${maxLineBytes} bytes`)
  }
  const lines = stdout.split('\n').filter((line) => line !== '')
  if (lines.length !== 1) throw new Error('transport schema probe must return exactly one JSONL response')
  assertProbeResponse(parseJson(lines[0], 'transport schema probe response'), profile, validated.implementation)
  console.log(
    `PASS live-transport-binding provider=${manifest.provider.id}@${manifest.provider.version} `
    + `capability=${profile.id}@${profile.version} bindings=${validated.implementation.bindings.length}`,
  )
}

main().catch((error) => {
  console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
