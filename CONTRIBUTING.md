# Contributing to Capability Contracts

Capability Contracts owns provider-neutral semantic Profiles, provider
manifests, executable conformance suites, and the reference validators. Keep
provider business logic, product UI, Agent planning, and workflow runtimes in
their owning repositories.

## Set up and verify

Use Node.js 22 or newer, then run:

```sh
npm ci
npm run check
```

Contract changes must include the smallest executable case that distinguishes
the intended semantic change. Keep canonical adapter conformance separate from
live transport conformance, and do not claim cross-provider substitution from
one implementation.

`npm run check:local-pilots` is a maintainer-only integration check. It expects
specific sibling provider checkouts, including development-only providers, and
is not required for an ordinary contribution.

Do not include credentials, private fixtures, generated reports, local paths,
or provider-owned source. Contributions are licensed under Apache-2.0 unless
clearly stated otherwise.
