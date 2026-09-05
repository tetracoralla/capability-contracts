import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import test from 'node:test'
import { validateProviderCatalog } from '../src/validate-provider-catalog.mjs'

const root = resolve(import.meta.dirname, '..')
const source = resolve(root, 'test/providers/python-zoneinfo/provider.json')
const catalog = resolve(root, 'catalog')

test('closed-catalog validation accepts all current provider bindings', async () => {
  const result = await validateProviderCatalog(source, catalog)
  assert.equal(result.implementations, 1)
})

for (const defect of ['unknown-version', 'digest-drift', 'duplicate-implementation']) {
  test(`closed-catalog validation rejects an added ${defect}`, async (t) => {
    const temporary = await mkdtemp(resolve(tmpdir(), 'provider-catalog-'))
    t.after(() => rm(temporary, { recursive: true, force: true }))
    const manifest = JSON.parse(await readFile(source, 'utf8'))
    const addition = structuredClone(manifest.implementations[0])
    if (defect === 'unknown-version') addition.capabilityVersion = '99.0.0'
    if (defect === 'digest-drift') {
      manifest.implementations[0].profileDigest = `sha256:${'0'.repeat(64)}`
    } else manifest.implementations.push(addition)
    const path = resolve(temporary, 'provider.json')
    await writeFile(path, JSON.stringify(manifest))
    await assert.rejects(validateProviderCatalog(path, catalog),
      defect === 'unknown-version' ? /unknown Capability/ : defect === 'digest-drift' ? /digest differs/ : /duplicate id/)
  })
}
