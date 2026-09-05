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
| `org.openadam.time-zone.convert@0.2.0` | Migratory Time; Python `zoneinfo` conformance witness | [tetracoralla/migratory-time](https://github.com/tetracoralla/migratory-time); witness is test-only here | Bounded current-source semantic comparison; ordinary suite L0; no released replacement claim |
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
time-zone witness uses a separately written engine and manifest. Its tested
semantic agreement is useful independently of product release, while its
installation, support, and adoption remain unestablished. The
[differential and Host experiments](DIFFERENTIAL_CONFORMANCE.md) describe the
bounded current-source observations; they do not establish a released product
replacement or equivalence beyond their tested scope.
