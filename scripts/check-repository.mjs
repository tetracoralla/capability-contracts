#!/usr/bin/env node

import { lstat, readdir, readFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { resolve, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const ignored = new Set(['.git', 'node_modules', '.verify', 'build'])

async function inventory(directory) {
  const found = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue
    const path = resolve(directory, entry.name)
    const metadata = await lstat(path)
    if (metadata.isSymbolicLink()) throw new Error(`tracked public tree must not contain symlinks: ${relative(root, path)}`)
    if (metadata.isDirectory()) found.push(...await inventory(path))
    else found.push(path)
  }
  return found
}

const allFiles = await inventory(root)
for (const required of [
  'LICENSE', 'NOTICE', 'THIRD_PARTY_NOTICES.md', 'SECURITY.md', 'CONTRIBUTING.md',
  'README.md', 'docs/PRODUCT_MODEL.md', 'docs/REVIEW_CONTRACT.md',
  'docs/INTEGRATIONS.md', 'docs/RELEASE.md',
  '.github/workflows/ci.yml', '.github/workflows/codeql.yml', '.github/dependabot.yml',
]) {
  if (!allFiles.includes(resolve(root, required))) throw new Error(`public repository file is absent: ${required}`)
}
if (allFiles.some((path) => path.includes('/docs/campaign/') || path.includes('/docs/handoffs/'))) {
  throw new Error('internal campaign and handoff material must stay outside the public repository')
}

for (const path of allFiles.filter((candidate) => candidate.endsWith('.mjs'))) {
  const checked = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' })
  if (checked.status !== 0) throw new Error(`syntax check failed for ${relative(root, path)}: ${checked.stderr}`)
}

const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
if (packageJson.private !== true || packageJson.license !== 'Apache-2.0' || packageJson.author !== 'openAdam') {
  throw new Error('the source release must remain private from npm and use the openAdam Apache-2.0 identity')
}
if (
  packageJson.repository?.url !== 'git+https://github.com/tetracoralla/capability-contracts.git' ||
  packageJson.homepage !== 'https://github.com/tetracoralla/capability-contracts#readme' ||
  packageJson.bugs?.url !== 'https://github.com/tetracoralla/capability-contracts/issues'
) {
  throw new Error('public repository metadata must identify tetracoralla/capability-contracts')
}
if (packageJson.scripts?.['check:pilots'] || packageJson.scripts?.['validate:campaign-scope']) {
  throw new Error('internal campaign or ambiguous pilot commands must not be public entry points')
}
if (packageJson.scripts?.['check:local-pilots'] !== 'node scripts/check-local-pilots.mjs') {
  throw new Error('maintainer integration must retain an explicit local-only entry point')
}

const packageLock = JSON.parse(await readFile(resolve(root, 'package-lock.json'), 'utf8'))
const lockedRoot = packageLock.packages?.['']
if (
  lockedRoot?.name !== packageJson.name ||
  lockedRoot?.version !== packageJson.version ||
  lockedRoot?.license !== packageJson.license
) {
  throw new Error('package-lock root identity differs from package.json')
}
for (const metadata of Object.values(packageLock.packages ?? {})) {
  if (typeof metadata?.resolved === 'string' && !metadata.resolved.startsWith('https://registry.npmjs.org/')) {
    throw new Error('package-lock contains a noncanonical package registry URL')
  }
}

const textCandidates = allFiles.filter((path) => !path.endsWith('duplicate-keys.json'))
const publicText = (await Promise.all(textCandidates.map((path) => readFile(path, 'utf8').catch(() => '')))).join('\n')
const developmentCoordinate = ['', 'Users', 'openadam', 'Development'].join('/')
if (publicText.includes(developmentCoordinate)) {
  throw new Error('tracked public files must not contain a personal development path')
}

const workflowText = (await Promise.all(
  allFiles.filter((path) => path.includes('/.github/workflows/')).map((path) => readFile(path, 'utf8')),
)).join('\n')
for (const unsafe of ['pull_request_target', 'permissions: write-all', 'contents: write']) {
  if (workflowText.includes(unsafe)) throw new Error(`unsafe public workflow authority is present: ${unsafe}`)
}
for (const match of workflowText.matchAll(/\buses:\s+[^\s@]+@([^\s#]+)/gu)) {
  if (!/^[a-f0-9]{40}$/u.test(match[1])) throw new Error(`workflow action is not pinned to a full commit: ${match[0]}`)
}

process.stdout.write(`repository invariants passed for ${allFiles.length} public files\n`)
