import { createInterface } from 'node:readline'

const lines = createInterface({ input: process.stdin, crlfDelay: Infinity })

for await (const line of lines) {
  if (line.trim() === '') continue
  const request = JSON.parse(line)
  process.stdout.write(
    `${JSON.stringify({
      id: request.id,
      ok: true,
      result: { normalized: request.input.value.trim() },
      error: { code: 'IMPOSSIBLE', message: 'success and error at once' },
    })}\n`,
  )
}
