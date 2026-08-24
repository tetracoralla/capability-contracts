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
