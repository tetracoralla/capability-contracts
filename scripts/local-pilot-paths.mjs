import { isAbsolute, resolve } from 'node:path'

export function resolvePilotRoot(workspaceRoot, relativeDefault, environmentName, environment = process.env) {
  const configured = environment[environmentName]
  if (configured === undefined) return resolve(workspaceRoot, relativeDefault)
  if (!isAbsolute(configured)) {
    throw new Error(`${environmentName} must be an absolute path`)
  }
  return resolve(configured)
}
