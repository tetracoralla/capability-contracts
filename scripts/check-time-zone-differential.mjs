#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolvePilotRoot } from './local-pilot-paths.mjs'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const workspaceRoot = resolve(repositoryRoot, '..')

try {
  const providerRoot = resolvePilotRoot(
    workspaceRoot,
    'migratory-time',
    'OPENADAM_MIGRATORY_TIME_SOURCE_ROOT',
  )
  const manifestPath = resolve(providerRoot, 'capabilities/provider.json')

  if (!existsSync(manifestPath)) {
    process.stdout.write(`${JSON.stringify({
      status: 'incomplete',
      differential: {
        status: 'not_run',
        reason: 'Migratory Time source is unavailable; set OPENADAM_MIGRATORY_TIME_SOURCE_ROOT to an absolute checkout',
        resolvedSourceRoot: providerRoot,
      },
    })}\n`)
    process.exitCode = 2
  } else {
    const result = spawnSync(process.execPath, [
      'src/run-differential.mjs',
      '--profile', 'catalog/capabilities/time-zone-convert.v0.2.json',
      '--conformance-suite', 'catalog/conformance/time-zone-convert.v0.2.json',
      '--differential-suite', 'catalog/differential/time-zone-convert.v0.2.json',
      '--left-manifest', manifestPath,
      '--left-provider-root', providerRoot,
      '--right-manifest', 'test/providers/python-zoneinfo/provider.json',
      '--right-provider-root', 'test/providers/python-zoneinfo',
    ], {
      cwd: repositoryRoot,
      env: process.env,
      stdio: 'inherit',
    })

    if (result.error !== undefined) throw result.error
    process.exitCode = result.status ?? 1
  }
} catch (error) {
  console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
