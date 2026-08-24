#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const workspaceRoot = resolve(repositoryRoot, '..')

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    env: process.env,
    stdio: 'inherit',
  })
  if (result.error !== undefined) throw result.error
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with status ${result.status}`)
  }
}

const pilots = [
  {
    name: 'File Vitals',
    providerRoot: resolve(workspaceRoot, 'universal-inspector'),
    providerCheck: ['go', ['test', './capabilities', './cmd/capability-adapter']],
    profile: 'file-inspect.v0.1.json',
    liveTransportProbe: true,
  },
  {
    name: 'Data Transformer',
    providerRoot: resolve(workspaceRoot, 'data-transformer'),
    providerCheck: [
      'uv',
      [
        'run',
        'pytest',
        'tests/test_capability_provider.py',
        'tests/test_capability_manifest.py',
      ],
    ],
    profile: 'structured-data-analyze.v0.1.json',
    liveTransportProbe: true,
  },
  {
    name: 'Asset Prep',
    providerRoot: resolve(workspaceRoot, 'asset-prep'),
    providerCheck: [
      'uv',
      [
        'run',
        'pytest',
        'tests/test_capability_provider.py',
        'tests/test_capability_manifest.py',
      ],
    ],
    profile: 'raster-prepare.v0.1.json',
    liveTransportProbe: true,
  },
  {
    name: 'Asset Prep Raster Verification',
    providerRoot: resolve(workspaceRoot, 'asset-prep'),
    providerCheck: [
      'uv',
      [
        'run',
        'pytest',
        'tests/test_capability_provider.py',
        'tests/test_capability_manifest.py',
      ],
    ],
    profile: 'raster-verify.v0.1.json',
    liveTransportProbe: true,
  },
  {
    name: 'Projective',
    providerRoot: resolve(workspaceRoot, 'perspective-tool'),
    providerCheck: ['pnpm', ['capability:check']],
    profile: 'projective-transform.v0.1.json',
    liveTransportProbe: true,
  },
  {
    name: 'Migratory Time',
    providerRoot: resolve(workspaceRoot, 'migratory-time'),
    providerCheck: ['npm', ['run', 'capability:check']],
    profile: 'time-zone-convert.v0.2.json',
  },
  {
    name: 'Dependency Preflight',
    providerRoot: resolve(workspaceRoot, 'dependency-preflight'),
    providerCheck: ['npm', ['run', 'check']],
    profile: 'package-dependency-evaluate.v0.1.json',
  },
]

try {
  run('npm', ['run', 'check'], repositoryRoot)
  const checkedProviders = new Set()
  for (const pilot of pilots) {
    if (!checkedProviders.has(pilot.providerRoot)) {
      console.log(`\n[${pilot.name}] provider drift check`)
      run(pilot.providerCheck[0], pilot.providerCheck[1], pilot.providerRoot)
      checkedProviders.add(pilot.providerRoot)
    }
    console.log(`[${pilot.name}] contract conformance`)
    run(
      process.execPath,
      [
        'src/run-conformance.mjs',
        '--profile',
        `catalog/capabilities/${pilot.profile}`,
        '--suite',
        `catalog/conformance/${pilot.profile}`,
        '--manifest',
        resolve(pilot.providerRoot, 'capabilities/provider.json'),
        '--provider-root',
        pilot.providerRoot,
      ],
      repositoryRoot,
    )
    if (pilot.liveTransportProbe === true) {
      console.log(`[${pilot.name}] live transport binding conformance`)
      run(
        process.execPath,
        [
          'src/run-transport-conformance.mjs',
          '--profile',
          `catalog/capabilities/${pilot.profile}`,
          '--suite',
          `catalog/conformance/${pilot.profile}`,
          '--manifest',
          resolve(pilot.providerRoot, 'capabilities/provider.json'),
          '--provider-root',
          pilot.providerRoot,
        ],
        repositoryRoot,
      )
    }
  }
  console.log('\nPASS all pilot capability contracts and provider conformance suites')
} catch (error) {
  console.error(`\nFAIL ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
