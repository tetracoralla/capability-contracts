#!/usr/bin/env node

import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  assertUniqueSemanticIdentities,
  loadJson,
  validateContractSet,
  validateDifferentialSuite,
} from './lib/contracts.mjs'

const catalogRoot = resolve('catalog')
const profileRoot = resolve(catalogRoot, 'capabilities')
const suiteRoot = resolve(catalogRoot, 'conformance')
const differentialRoot = resolve(catalogRoot, 'differential')

try {
  const profileFiles = (await readdir(profileRoot)).filter((file) => file.endsWith('.json'))
  if (profileFiles.length === 0) throw new Error('catalog has no Capability Profiles')
  const profiles = []
  for (const file of profileFiles.sort()) {
    const profilePath = resolve(profileRoot, file)
    const profile = await loadJson(profilePath)
    profiles.push({ file, profile, profilePath })
  }
  assertUniqueSemanticIdentities(
    profiles.map(({ profile }) => profile),
    'catalog Capability identities',
  )
  for (const { file, profile, profilePath } of profiles) {
    const suite = await loadJson(resolve(suiteRoot, file))
    await validateContractSet({ profile, profilePath, suite })
    console.log(`PASS ${profile.id}@${profile.version}`)
  }
  const differentialFiles = (await readdir(differentialRoot)).filter((file) => file.endsWith('.json'))
  for (const file of differentialFiles.sort()) {
    const profileEntry = profiles.find((candidate) => candidate.file === file)
    if (profileEntry === undefined) {
      throw new Error(`differential suite ${file} has no matching Capability Profile`)
    }
    const differentialSuite = await loadJson(resolve(differentialRoot, file))
    await validateDifferentialSuite({
      profile: profileEntry.profile,
      profilePath: profileEntry.profilePath,
      suite: differentialSuite,
    })
    console.log(
      `PASS differential ${profileEntry.profile.id}@${profileEntry.profile.version} `
      + `cases=${differentialSuite.cases.length}`,
    )
  }
} catch (error) {
  console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
