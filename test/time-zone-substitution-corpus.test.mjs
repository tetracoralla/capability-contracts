import test from 'node:test'
import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { loadJson, validateDifferentialSuite } from '../src/lib/contracts.mjs'
import { assertUtcConversion, generateTimeZoneCorpus } from '../scripts/time-zone-substitution-corpus.mjs'

const root = new URL('../', import.meta.url)
const base = await loadJson(new URL('catalog/differential/time-zone-convert.v0.2.json', root))
const profilePath = fileURLToPath(new URL('catalog/capabilities/time-zone-convert.v0.2.json', root))
const profile = await loadJson(profilePath)

test('generated inputs are reproducible, bounded, schema-valid and preserve the fixed cases', async () => {
  const before = structuredClone(base)
  const suite = generateTimeZoneCorpus(base)
  await validateDifferentialSuite({ profile, profilePath, suite })
  assert.equal(suite.cases.length, 204)
  assert.deepEqual(suite, generateTimeZoneCorpus(base))
  assert.notDeepEqual(suite, generateTimeZoneCorpus(base, { seed: 5 }))
  assert.deepEqual(base, before)
  assert.deepEqual(suite.cases.slice(0, base.cases.length), base.cases)
  for (let index = base.cases.length; index < suite.cases.length; index += 2) {
    const [forward, reverse] = suite.cases.slice(index, index + 2)
    assert.equal(forward.input.localDateTime, reverse.input.localDateTime)
    assert.deepEqual(forward.input.targetTimeZones, [...reverse.input.targetTimeZones].reverse())
  }
  for (const options of [{ seed: 0 }, { seed: 1.5 }, { samples: 121 }, { samples: Infinity }, { samples: 0 }]) {
    assert.throws(() => generateTimeZoneCorpus(base, options))
  }
})

test('independent UTC properties reject correlated instant, offset, wall-time and ordering mistakes', () => {
  const input = { localDateTime: '2026-08-03T08:30', sourceTimeZone: 'UTC', targetTimeZones: ['Asia/Kolkata', 'UTC'] }
  const result = {
    status: 'converted', source: { localDateTime: input.localDateTime, timeZone: 'UTC' },
    instant: '2026-08-03T08:30:00Z',
    results: [
      { timeZone: 'Asia/Kolkata', localDateTime: '2026-08-03T14:00', offset: '+05:30' },
      { timeZone: 'UTC', localDateTime: '2026-08-03T08:30', offset: '+00:00' },
    ],
  }
  assertUtcConversion(input, result)
  const mutations = [
    (value) => { value.instant = '2026-08-03T09:30:00Z' },
    (value) => { value.results[0].offset = '+05:00' },
    (value) => { value.results[0].localDateTime = '2026-08-03T14:30' },
    (value) => { value.results.reverse() },
    (value) => { value.status = 'nonexistent' },
  ]
  for (const mutate of mutations) {
    const changed = structuredClone(result)
    mutate(changed)
    assert.throws(() => assertUtcConversion(input, changed))
  }
})
