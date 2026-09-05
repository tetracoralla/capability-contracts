# Public integrations

Capability providers remain outside this standards repository. Independently
useful providers may be products; private reference providers may share a
development workspace. This repository publishes their provider-neutral
contract projections and conformance cases; it does not copy provider source or
distribute provider binaries.

| Capability Profile | Current provider | Public source | Current claim boundary |
| --- | --- | --- | --- |
| `org.openadam.file.inspect@0.1.0` | File Vitals | [tetracoralla/file-vitals](https://github.com/tetracoralla/file-vitals) | Provider-seeded experimental Profile |
| `org.openadam.structured-data.analyze@0.1.0` | BatchTicket | [tetracoralla/BatchTicket](https://github.com/tetracoralla/BatchTicket) | Provider-seeded experimental Profile |
| `org.openadam.time-zone.convert@0.2.0` | Migratory Time; Python `zoneinfo` conformance witness | [tetracoralla/migratory-time](https://github.com/tetracoralla/migratory-time); witness is test-only here | 12-case current-source differential passes; no second released provider product or substitution claim |
| `org.openadam.raster.prepare@0.2.0` | development pilot | not published here | Active provider binding; `0.1.0` retained as superseded catalog identity |
| `org.openadam.raster.verify@0.1.0` | development pilot | not published here | Catalog and maintainer-local integration only |
| `org.openadam.projective.transform@0.2.0` | development pilot | not published here | Active provider binding; `0.1.0` retained as superseded catalog identity |
| `org.openadam.package-dependency.evaluate@0.1.0` | private `standards-pilots` reference provider | not published here | L1 reference conformance and maintainer-local integration only; no independent product claim |
| `org.openadam.standard-expression.run@0.2.0` | Equatorium development pilot | not published here | Active provider binding and maintainer-local integration; `0.1.0` retained as a superseded carrier-polluted identity |

The public source link establishes only where a provider is published. Current
conformance, installation, credentials, permissions, endpoint health, and Agent
routing must be observed separately against current revisions.

The maintainer pilot first validates every implementation declared by each
provider against the selected local catalog, including identities, digests and
operation bindings. The same explicit check is available as
`node src/validate-provider-catalog.mjs --manifest FILE --catalog DIR`.
Single-Profile conformance continues to assess only its named Profile; it
does not certify other entries in the Provider Manifest.

No Profile currently has two independently released provider products. The
time-zone witness uses a separately written engine and manifest, which is
valuable for finding semantic drift, but it has no independent product,
transport release, installation path, support boundary, or user adoption. The
project therefore makes no cross-provider substitution claim.
