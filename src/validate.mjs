#!/usr/bin/env node

import { resolve } from 'node:path'
import { loadJson, validateContractSet } from './lib/contracts.mjs'

function parseArgs(argv) {
  const values = new Map()
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index]
    const value = argv[index + 1]
    if (!flag?.startsWith('--') || value === undefined) {
      throw new Error(
        'Usage: validate.mjs --profile FILE --suite FILE [--manifest FILE] '
        + '(legacy: --definition FILE)',
      )
    }
    values.set(flag.slice(2), value)
  }
  if (values.has('profile') === values.has('definition')) {
    throw new Error('Exactly one of --profile or legacy --definition is required')
  }
  if (!values.has('suite')) {
    throw new Error('--suite is required')
  }
  return values
}

try {
  const args = parseArgs(process.argv.slice(2))
  const profilePath = resolve(args.get('profile') ?? args.get('definition'))
  const suitePath = resolve(args.get('suite'))
  const manifestPath = args.has('manifest') ? resolve(args.get('manifest')) : undefined
  const profile = await loadJson(profilePath)
  const suite = await loadJson(suitePath)
  const manifest = manifestPath === undefined ? undefined : await loadJson(manifestPath)
  await validateContractSet({ profile, profilePath, manifest, suite })
  console.log(
    `PASS ${profile.id}@${profile.version}` +
      (manifest === undefined ? '' : ` provider=${manifest.provider.id}@${manifest.provider.version}`),
  )
} catch (error) {
  console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
}
