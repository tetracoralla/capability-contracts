process.stdin.setEncoding('utf8')

let buffer = ''
process.stdin.on('data', (chunk) => {
  buffer += chunk
  const newline = buffer.indexOf('\n')
  if (newline === -1) return
  const request = JSON.parse(buffer.slice(0, newline))
  process.stdout.write(`${JSON.stringify({
    id: request.id,
    ok: false,
    error: {
      code: 'PROVIDER_FAILED',
      message: 'fixture failure',
      retryable: true,
    },
  })}\n`)
})
