import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import test from 'node:test'

const adapter = resolve(import.meta.dirname, 'providers/python-zoneinfo/adapter.py')

function run(input) {
  return spawnSync('python3', [adapter], {
    encoding: 'utf8',
    input,
    timeout: 5000,
  })
}

const validRequest = {
  id: 'valid',
  operationId: 'convert',
  input: {
    localDateTime: '2026-08-03T16:30',
    sourceTimeZone: 'UTC',
    targetTimeZones: ['UTC'],
  },
}

test('Python zoneinfo witness rejects malformed carrier input without a semantic envelope', () => {
  for (const input of [
    '{bad json\n',
    '{"id":"first","id":"second","operationId":"convert","input":{}}\n',
    `${'x'.repeat(1024 * 1024)}\n`,
  ]) {
    const result = run(input)
    assert.equal(result.error, undefined)
    assert.equal(result.status, 1)
    assert.equal(result.stdout, '')
    assert.equal(result.stderr, 'Capability JSONL carrier request rejected.\n')
  }
})

test('Python zoneinfo witness returns INVALID_INPUT and stays live for typed bad input', () => {
  const invalid = {
    ...validRequest,
    id: 'invalid-target',
    input: { ...validRequest.input, targetTimeZones: [{}] },
  }
  const result = run(`${JSON.stringify(invalid)}\n${JSON.stringify(validRequest)}\n`)
  assert.equal(result.error, undefined)
  assert.equal(result.status, 0)
  assert.equal(result.stderr, '')
  const responses = result.stdout.trim().split('\n').map(JSON.parse)
  assert.equal(responses.length, 2)
  assert.equal(responses[0].id, 'invalid-target')
  assert.equal(responses[0].error.code, 'INVALID_INPUT')
  assert.equal(responses[1].id, 'valid')
  assert.equal(responses[1].result.status, 'converted')
})

test('Python zoneinfo witness reports the database selected ahead of package fallback', () => {
  const expected = spawnSync('python3', ['-c', [
    'from importlib import metadata',
    'from pathlib import Path',
    'from zoneinfo import TZPATH',
    'for root in TZPATH:',
    ' p=Path(root)/"tzdata.zi"',
    ' try: first=p.read_text(encoding="utf-8",errors="replace").splitlines()[0]',
    ' except (OSError,IndexError): continue',
    ' if first.startswith("# version "): print(first.removeprefix("# version ").strip()); break',
    'else: print(f"tzdata-{metadata.version(\'tzdata\')}")',
  ].join('\n')], { encoding: 'utf8', timeout: 5000 })
  assert.equal(expected.status, 0, expected.stderr)

  const result = run(`${JSON.stringify(validRequest)}\n`)
  assert.equal(result.status, 0, result.stderr)
  const response = JSON.parse(result.stdout)
  assert.equal(response.result.context.timeZoneDatabase, expected.stdout.trim())
})
