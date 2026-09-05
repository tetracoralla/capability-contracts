# Multi-repository development

Capability Contracts is intentionally independent from every provider product,
Procedure implementation, and Agent host. Each repository keeps its own Git
history, license, releases, issues, and acceptance boundary.

For local integration work, maintainers may place sibling repositories under a
common parent directory:

```text
workspace/
├── capability-contracts/
├── procedure-contracts/
├── one-provider/
└── one-procedure-implementation/
```

The common parent is not a repository. Do not copy provider source into this
standard, add nested repositories, or infer provider availability from a
neighboring directory.

## Adding a provider integration

1. Identify one stable semantic operation rather than exporting a whole
   application schema.
2. Define or select a canonical Capability Profile.
3. Implement a provider adapter that translates between the canonical request
   and the real provider boundary.
4. Generate a Provider Manifest from current provider and transport facts.
5. Run the provider's own regression checks.
6. Run Capability conformance through the real adapter.
7. Run live transport conformance separately when the manifest declares a
   schema probe.
8. Verify installed-host and human product behavior in their owning products
   before making those claims.

`npm run check:local-pilots` is the current maintainer workspace route. It is
not portable because some pilot providers are development-only. Its result is
an integration observation for the checked revisions, not a permanent
certification.

The runner uses sibling defaults only as development coordinates and accepts an
explicit absolute source-root override for each pilot. If a source root or its
Provider Manifest is absent, that pilot is reported as `not_run` and the command
exits incomplete after checking the available pilots. This standards route does
not inspect Agent Host private state or treat an installed artifact as current
provider source.

## Adding a second-provider differential route

1. Require a distinct Provider id and implementation engine; a renamed adapter
   over the same semantic core is not independence.
2. Run the ordinary Profile suite against both complete Provider Manifests.
3. Add a bounded `openadam.differential-suite.v0.1` corpus derived from semantic
   boundaries, not only the originating provider's happy cases.
4. Compare exact validated success/error outcomes. Put any runtime/provenance
   exception in the suite's Profile-owner comparison policy, allow cases to use
   only those paths, and review the stated basis as a judgment rather than
   treating the runner as authority.
5. Keep messages and provider stderr out of mismatch reports; report only
   outcome kind and canonical digest.
6. Run each provider's own regression before the shared differential command.
7. Scope semantic substitution claims to the tested independent implementations,
   Profile, input domain, properties, and differential coverage. A thin adapter
   around an independent engine can supply this evidence without a separate
   product release. Verify distribution, installation, live transports, and use
   separately before claiming a deployable replacement or adoption; see
   [Differential conformance](DIFFERENTIAL_CONFORMANCE.md).

The current reference route is:

```sh
npm run check:time-zone-differential
```

It uses the sibling Migratory Time source by default. An isolated candidate may
set `OPENADAM_MIGRATORY_TIME_SOURCE_ROOT` to an absolute checkout; source absence
is reported as `not_run/incomplete`, never as a differential PASS.
