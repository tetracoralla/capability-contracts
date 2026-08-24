# Source release checklist

This checklist prepares a GitHub source release. It does not authorize an npm
publication, tag, GitHub Release, or provider release.

1. Confirm the public identity: Capability Semantic ABI,
   `tetracoralla/capability-contracts`, `@openadam/capability-contracts`,
   author `openAdam`, Apache-2.0.
2. Run `npm ci`, `npm run check`, and `npm run audit:production` from a clean
   checkout.
3. Inspect `npm pack --dry-run --json`; the package remains `private` and is
   not an npm distribution.
4. Run `npm run check:local-pilots` only on the maintainer workspace and report
   provider failures separately from the public repository check.
5. Run the public-release auditor against the current tree and reachable
   history. Do not publish local paths, campaign material, generated reports,
   or private provider fixtures.
6. Push the reviewed commit, wait for CI and CodeQL, inspect security alerts,
   and verify branch protection.
7. Re-clone through the public HTTPS URL and rerun the public checks.
8. Create a tag or GitHub Release only after separate owner authorization.
