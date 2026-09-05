#!/usr/bin/env node
import { readdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  assertUniqueSemanticIdentities, loadJson, validateContractSet, validateDocument,
} from './lib/contracts.mjs'

// This is an explicitly closed-catalog check. Single-Profile conformance still
// assesses only that Profile and may be used with a broader provider manifest.
export async function validateProviderCatalog(manifestPath, catalogRoot) {
  const manifest = await loadJson(manifestPath)
  await validateDocument(manifest, 'provider manifest')
  const profiles = []
  for (const file of (await readdir(resolve(catalogRoot, 'capabilities'))).sort()) {
    if (!file.endsWith('.json')) continue
    const profilePath = resolve(catalogRoot, 'capabilities', file)
    profiles.push({ file, profilePath, profile: await loadJson(profilePath) })
  }
  assertUniqueSemanticIdentities(profiles.map(({ profile }) => profile), 'catalog Capability identities')
  for (const implementation of manifest.implementations) {
    const entry = profiles.find(({ profile }) => profile.id === implementation.capabilityId
      && profile.version === implementation.capabilityVersion)
    if (entry === undefined) {
      throw new Error(`provider declares unknown Capability ${implementation.capabilityId}@${implementation.capabilityVersion} in selected catalog`)
    }
    await validateContractSet({
      profile: entry.profile, profilePath: entry.profilePath, manifest,
      suite: await loadJson(resolve(catalogRoot, 'conformance', entry.file)),
    })
  }
  return { provider: manifest.provider.id, implementations: manifest.implementations.length }
}

if (process.argv[1] && resolve(process.argv[1]) === import.meta.filename) {
  try {
    const args = process.argv.slice(2)
    if (args.length !== 4 || args[0] !== '--manifest' || args[2] !== '--catalog') {
      throw new Error('Usage: validate-provider-catalog.mjs --manifest FILE --catalog DIR')
    }
    const result = await validateProviderCatalog(resolve(args[1]), resolve(args[3]))
    console.log(`PASS provider catalog bindings ${JSON.stringify(result)}`)
  } catch (error) {
    console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  }
}
