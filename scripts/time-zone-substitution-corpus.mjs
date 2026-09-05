import assert from 'node:assert/strict'

export const DEFAULT_SEED = 20260905
export const DEFAULT_SAMPLES = 96
const zones = [
  'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Europe/Berlin',
  'Asia/Kolkata', 'Asia/Kathmandu', 'Australia/Lord_Howe', 'Pacific/Chatham', 'UTC',
]
const transitionInstants = [
  '2026-03-08T06:59', '2026-03-08T07:00', '2026-03-08T07:01',
  '2026-11-01T05:59', '2026-11-01T06:00', '2026-11-01T06:01',
  '2026-04-04T14:59', '2026-04-04T15:00', '2026-04-04T15:01',
  '2026-10-03T15:29', '2026-10-03T15:30', '2026-10-03T15:31',
]

// Maintainer corpus, not a new Profile or a promoted conformance level. The
// generator uses no provider output or time-zone engine to select its inputs.
export function generateTimeZoneCorpus(base, { seed = DEFAULT_SEED, samples = DEFAULT_SAMPLES } = {}) {
  assert.equal(base.capabilityId, 'org.openadam.time-zone.convert')
  assert.equal(base.capabilityVersion, '0.2.0')
  assert.ok(Number.isInteger(seed) && seed > 0 && seed < 2147483647, 'seed must be in 1..2147483646')
  assert.ok(Number.isInteger(samples) && samples >= 12 && samples <= 120, 'samples must be in 12..120')
  assert.ok(base.cases.length + samples * 2 <= 256, 'corpus exceeds the Differential Suite case bound')
  const suite = structuredClone(base)
  const comparison = base.cases.find((entry) => entry.comparison.ignorePointers.length === 1
    && entry.comparison.ignorePointers[0] === '/context/timeZoneDatabase')?.comparison
  assert.ok(comparison, 'the current suite must authorize only time-zone database provenance omission')
  let state = seed
  const start = Date.parse('2024-01-01T00:00:00Z')
  const minutes = (Date.parse('2029-01-01T00:00:00Z') - start) / 60000
  for (let index = 0; index < samples; index += 1) {
    state = (state * 48271) % 2147483647
    const localDateTime = transitionInstants[index]
      ?? new Date(start + (state % minutes) * 60000).toISOString().slice(0, 16)
    for (const reversed of [false, true]) {
      suite.cases.push({
        id: `generated-utc-${index}-${reversed ? 'reverse' : 'forward'}`,
        operationId: 'convert',
        description: 'UTC-anchored generated input with preserved or reversed target order.',
        input: {
          localDateTime,
          sourceTimeZone: 'UTC',
          targetTimeZones: reversed ? [...zones].reverse() : [...zones],
        },
        comparison: structuredClone(comparison),
      })
    }
  }
  assert.equal(new Set(suite.cases.map((entry) => entry.id)).size, suite.cases.length, 'duplicate corpus case identity')
  return suite
}

// These properties provide an oracle independent of agreement between engines.
// Call only after the full result has passed the Profile's output schema.
export function assertUtcConversion(input, result) {
  assert.equal(input.sourceTimeZone, 'UTC', 'property requires an explicit UTC source')
  assert.equal(result.status, 'converted', 'a supported UTC instant must convert')
  assert.deepEqual(result.source, { localDateTime: input.localDateTime, timeZone: 'UTC' })
  const expectedInstant = Date.parse(`${input.localDateTime}:00Z`)
  assert.ok(Number.isFinite(expectedInstant), 'property input must be a valid UTC date')
  assert.equal(Date.parse(result.instant), expectedInstant, 'UTC source instant changed')
  assert.deepEqual(result.results.map((row) => row.timeZone), input.targetTimeZones, 'target order changed')
  for (const row of result.results) {
    const match = /^([+-])(\d{2}):(\d{2})$/u.exec(row.offset)
    assert.ok(match, 'offset must be explicit minutes')
    const offsetMinutes = (Number(match[2]) * 60 + Number(match[3])) * (match[1] === '-' ? -1 : 1)
    assert.equal(Date.parse(`${row.localDateTime}:00Z`) - offsetMinutes * 60000,
      expectedInstant, 'local wall time and offset do not preserve the instant')
  }
}
