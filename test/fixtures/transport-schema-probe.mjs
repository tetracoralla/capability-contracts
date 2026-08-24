import { createInterface } from 'node:readline'

const inputSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['value'],
  properties: { value: { type: 'string' } },
}
const outputSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['normalized'],
  properties: { normalized: { type: 'string' } },
}

const lines = createInterface({ input: process.stdin, crlfDelay: Infinity })
for await (const line of lines) {
  const request = JSON.parse(line)
  process.stdout.write(`${JSON.stringify({
    id: request.id,
    ok: true,
    bindings: [{
      operationId: 'normalize',
      transport: 'library',
      target: 'normalize',
      inputSchema,
      outputSchema,
    }],
  })}\n`)
}
