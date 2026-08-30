# Public integrations

Capability providers remain independent products. This repository publishes
their provider-neutral contract projections and conformance cases; it does not
copy provider source or distribute provider binaries.

| Capability Profile | Current provider | Public source | Current claim boundary |
| --- | --- | --- | --- |
| `org.openadam.file.inspect@0.1.0` | File Vitals | [tetracoralla/file-vitals](https://github.com/tetracoralla/file-vitals) | Provider-seeded experimental Profile |
| `org.openadam.structured-data.analyze@0.1.0` | BatchTicket | [tetracoralla/BatchTicket](https://github.com/tetracoralla/BatchTicket) | Provider-seeded experimental Profile |
| `org.openadam.time-zone.convert@0.2.0` | Migratory Time | [tetracoralla/migratory-time](https://github.com/tetracoralla/migratory-time) | Provider-seeded experimental Profile |
| `org.openadam.raster.prepare@0.2.0` | development pilot | not published here | Active provider binding; `0.1.0` retained as superseded catalog identity |
| `org.openadam.raster.verify@0.1.0` | development pilot | not published here | Catalog and maintainer-local integration only |
| `org.openadam.projective.transform@0.2.0` | development pilot | not published here | Active provider binding; `0.1.0` retained as superseded catalog identity |
| `org.openadam.package-dependency.evaluate@0.1.0` | development pilot | not published here | Catalog and maintainer-local integration only |
| `org.openadam.standard-expression.run@0.2.0` | Equatorium development pilot | not published here | Active provider binding and maintainer-local integration; `0.1.0` retained as a superseded carrier-polluted identity |

The public source link establishes only where a provider is published. Current
conformance, installation, credentials, permissions, endpoint health, and Agent
routing must be observed separately against current revisions.

No Profile currently has two independent providers. The project therefore
makes no cross-provider substitution claim.
