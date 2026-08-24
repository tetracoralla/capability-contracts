#!/usr/bin/env node

import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { loadJson, validateContractSet } from './lib/contracts.mjs'

const catalogRoot = resolve('catalog')
const profileRoot = resolve(catalogRoot, 'capabilities')
const suiteRoot = resolve(catalogRoot, 'conformance')

try {
  const profileFiles = (await readdir(profileRoot)).filter((file) => file.endsWith('.json'))
  if (profileFiles.length === 0) throw new Error('catalog has no Capability Profiles')
  for (const file of profileFiles.sort()) {
    const profilePath = resolve(profileRoot, file)
    const profile = await loadJson(profilePath)
    const suite = await loadJson(resolve(suiteRoot, file))
    await validateContractSet({ profile, profilePath, suite })
    console.log(`PASS ${profile.id}@${profile.version}`)
  }
} catch (error) {
  console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
