import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import test from 'node:test'

const repositoryRoot = resolve(import.meta.dirname, '..')
const runnerPath = resolve(repositoryRoot, 'scripts/check-local-pilots.mjs')
const sourceVariables = [
  'OPENADAM_FILE_VITALS_SOURCE_ROOT',
  'OPENADAM_BATCHTICKET_SOURCE_ROOT',
  'OPENADAM_ASSET_PREP_SOURCE_ROOT',
  'OPENADAM_PROJECTIVE_SOURCE_ROOT',
  'OPENADAM_MIGRATORY_TIME_SOURCE_ROOT',
  'OPENADAM_DEPENDENCY_PREFLIGHT_SOURCE_ROOT',
  'OPENADAM_EQUATORIUM_SOURCE_ROOT',
]

test('local pilot runner retains complete missing-source inventory when the central check fails', async () => {
  const root = await mkdtemp(resolve(tmpdir(), 'capability-local-pilot-test-'))
  const fakeNpm = resolve(root, 'npm')
  try {
    await writeFile(fakeNpm, '#!/bin/sh\nexit 7\n')
    await chmod(fakeNpm, 0o755)
    const environment = { ...process.env, PATH: root }
    for (const [index, name] of sourceVariables.entries()) {
      environment[name] = resolve(root, `missing-${index}`)
    }
    const result = spawnSync(process.execPath, [runnerPath], {
      cwd: repositoryRoot,
      encoding: 'utf8',
      env: environment,
      timeout: 5000,
    })
    assert.equal(result.error, undefined)
    assert.equal(result.status, 1)
    const report = JSON.parse(result.stdout.trim().split('\n').at(-1))
    assert.equal(report.status, 'failed')
    assert.equal(report.failed.length, 1)
    assert.equal(report.failed[0].name, 'Capability Contracts')
    assert.deepEqual(
      report.notRun.map((entry) => entry.name),
      [
        'File Vitals',
        'Data Transformer',
        'Asset Prep',
        'Asset Prep Raster Verification',
        'Projective',
        'Migratory Time',
        'Dependency Preflight',
        'Equatorium',
      ],
    )
    assert.deepEqual(
      report.notRun.map((entry) => entry.resolvedSourceRoot),
      [0, 1, 2, 2, 3, 4, 5, 6].map((index) => resolve(root, `missing-${index}`)),
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
