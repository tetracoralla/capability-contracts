import { createInterface } from 'node:readline'

const lines = createInterface({ input: process.stdin, crlfDelay: Infinity })

for await (const line of lines) {
  if (line.trim() === '') continue
  JSON.parse(line)
  await new Promise(() => {})
}
