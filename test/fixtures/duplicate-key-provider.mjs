import { createInterface } from 'node:readline'

const lines = createInterface({ input: process.stdin, crlfDelay: Infinity })
for await (const _line of lines) {
  process.stdout.write('{"id":"basic","id":"basic","ok":true,"result":{"normalized":"A"}}\n')
}
