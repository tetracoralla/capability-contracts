#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolvePilotRoot } from './local-pilot-paths.mjs'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const workspaceRoot = resolve(repositoryRoot, '..')
const pilotRoot = (relativeDefault, environmentName) => (
  resolvePilotRoot(workspaceRoot, relativeDefault, environmentName)
)

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

function isDirectory(path) {
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

function isFile(path) {
  try {
    return statSync(path).isFile()
  } catch {
    return false
  }
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

try {
  const pilots = [
    {
      name: 'File Vitals',
      providerRoot: pilotRoot('universal-inspector', 'OPENADAM_FILE_VITALS_SOURCE_ROOT'),
      sourceEnvironment: 'OPENADAM_FILE_VITALS_SOURCE_ROOT',
      providerCheck: ['go', ['test', './capabilities', './cmd/capability-adapter']],
      profile: 'file-inspect.v0.1.json',
      liveTransportProbe: true,
    },
    {
      name: 'Data Transformer',
      providerRoot: pilotRoot('data-transformer', 'OPENADAM_BATCHTICKET_SOURCE_ROOT'),
      sourceEnvironment: 'OPENADAM_BATCHTICKET_SOURCE_ROOT',
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
      providerRoot: pilotRoot('asset-prep', 'OPENADAM_ASSET_PREP_SOURCE_ROOT'),
      sourceEnvironment: 'OPENADAM_ASSET_PREP_SOURCE_ROOT',
      providerCheck: [
        'uv',
        [
          'run',
          'pytest',
          'tests/test_capability_provider.py',
          'tests/test_capability_manifest.py',
        ],
      ],
      profile: 'raster-prepare.v0.2.json',
      liveTransportProbe: true,
    },
    {
      name: 'Asset Prep Raster Verification',
      providerRoot: pilotRoot('asset-prep', 'OPENADAM_ASSET_PREP_SOURCE_ROOT'),
      sourceEnvironment: 'OPENADAM_ASSET_PREP_SOURCE_ROOT',
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
      providerRoot: pilotRoot('perspective-tool', 'OPENADAM_PROJECTIVE_SOURCE_ROOT'),
      sourceEnvironment: 'OPENADAM_PROJECTIVE_SOURCE_ROOT',
      providerCheck: ['pnpm', ['capability:check']],
      profile: 'projective-transform.v0.2.json',
      liveTransportProbe: true,
    },
    {
      name: 'Migratory Time',
      providerRoot: pilotRoot('migratory-time', 'OPENADAM_MIGRATORY_TIME_SOURCE_ROOT'),
      sourceEnvironment: 'OPENADAM_MIGRATORY_TIME_SOURCE_ROOT',
      providerCheck: ['npm', ['run', 'capability:check']],
      profile: 'time-zone-convert.v0.2.json',
    },
    {
      name: 'Dependency Preflight',
      providerRoot: pilotRoot(
        'standards-pilots/packages/dependency-preflight',
        'OPENADAM_DEPENDENCY_PREFLIGHT_SOURCE_ROOT',
      ),
      sourceEnvironment: 'OPENADAM_DEPENDENCY_PREFLIGHT_SOURCE_ROOT',
      providerCheck: ['npm', ['run', 'check']],
      profile: 'package-dependency-evaluate.v0.1.json',
    },
    {
      name: 'Equatorium',
      providerRoot: pilotRoot(
        'standard-expression-interpreter',
        'OPENADAM_EQUATORIUM_SOURCE_ROOT',
      ),
      sourceEnvironment: 'OPENADAM_EQUATORIUM_SOURCE_ROOT',
      providerCheck: ['npm', ['run', 'check:capabilities']],
      profile: 'standard-expression-run.v0.2.json',
    },
  ]

  const available = []
  const notRun = []
  for (const pilot of pilots) {
    const manifestPath = resolve(pilot.providerRoot, 'capabilities/provider.json')
    if (!isDirectory(pilot.providerRoot) || !isFile(manifestPath)) {
      notRun.push({
        name: pilot.name,
        reason: `provider source is unavailable; set ${pilot.sourceEnvironment} to an absolute checkout`,
        resolvedSourceRoot: pilot.providerRoot,
      })
    } else {
      available.push({ ...pilot, manifestPath })
    }
  }

  const completed = []
  const failed = []
  const skipped = []
  let centralReady = true
  try {
    run('npm', ['run', 'check'], repositoryRoot)
  } catch (error) {
    centralReady = false
    failed.push({
      name: 'Capability Contracts',
      reason: error instanceof Error ? error.message : String(error),
    })
  }

  const checkedProviders = new Set()
  const failedProviders = new Map()
  if (!centralReady) {
    for (const pilot of available) {
      skipped.push({ name: pilot.name, reason: 'central Capability Contracts check failed' })
    }
  } else {
    for (const pilot of available) {
      if (failedProviders.has(pilot.providerRoot)) {
        skipped.push({
          name: pilot.name,
          reason: `provider drift check failed: ${failedProviders.get(pilot.providerRoot)}`,
        })
        continue
      }
      try {
        if (!checkedProviders.has(pilot.providerRoot)) {
          console.log(`\n[${pilot.name}] provider drift check`)
          try {
            run(process.execPath, [
              'src/validate-provider-catalog.mjs', '--manifest', pilot.manifestPath,
              '--catalog', resolve(repositoryRoot, 'catalog'),
            ], repositoryRoot)
            run(pilot.providerCheck[0], pilot.providerCheck[1], pilot.providerRoot)
          } catch (error) {
            const reason = error instanceof Error ? error.message : String(error)
            failedProviders.set(pilot.providerRoot, reason)
            throw error
          }
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
            pilot.manifestPath,
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
              pilot.manifestPath,
              '--provider-root',
              pilot.providerRoot,
            ],
            repositoryRoot,
          )
        }
        completed.push({ name: pilot.name, ...sourceIdentity(pilot.providerRoot) })
      } catch (error) {
        failed.push({
          name: pilot.name,
          reason: error instanceof Error ? error.message : String(error),
        })
      }
    }
  }

  if (failed.length > 0 || notRun.length > 0) {
    console.log(`\n${JSON.stringify({
      status: failed.length > 0 ? 'failed' : 'incomplete',
      completed,
      notRun,
      failed,
      skipped,
    })}`)
    process.exitCode = failed.length > 0 ? 1 : 2
  } else {
    console.log(`\nPASS all pilot capability contracts and provider conformance suites ${JSON.stringify({
      status: 'passed',
      completed,
    })}`)
  }
} catch (error) {
  console.error(`\nFAIL ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
