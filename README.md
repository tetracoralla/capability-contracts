# Capability Semantic ABI

Capability Semantic ABI is a provider-neutral contract layer for giving the
same reusable operation the same meaning across different Agent hosts,
transports, languages, and provider products.

It standardizes the semantic boundary of an operation. It does not standardize
an Agent shell, a provider runtime, deployment, discovery, credentials, policy,
or user interface.

```text
Agent, application, or automation
              |
              | selects a named operation
              v
Capability Profile
  canonical input, output, behavior, and stable errors
              |
              | bound by a Provider Manifest
              v
Provider adapter or public transport
```

This repository is one part of the
[Agent-Host Execution Architecture](https://github.com/tetracoralla/agent-host-execution-architecture).
[Procedure Contracts](https://github.com/tetracoralla/procedure-contracts)
compose versioned Capability requirements into a settled method.
[Direct Execution Runtime](https://github.com/tetracoralla/direct-execution-runtime)
can execute already-closed calls after validating their current bindings.

## What this repository owns

- the Capability Profile meta-model;
- provider-neutral Capability Profiles and canonical schemas;
- Provider Manifests that bind implementations and transports;
- executable conformance suites;
- bounded reference validators and conformance runners.

A provider remains an independent product with its own source, release,
transport, limits, and user experience. MCP is one possible binding, not the
identity of a Capability.

## Current status

The current document family is experimental:

- `openadam.capability-profile.v0.3`;
- `openadam.provider-manifest.v0.3`;
- `openadam.conformance-suite.v0.2`;
- `openadam.capability-jsonl.v0.1` for the reference adapter boundary, defined
  by `schemas/capability-jsonl-envelope.schema.v0.1.json`.

The catalog currently contains eight provider-seeded Capability identities.
Three retain superseded contracts alongside their active versions so old
consumers do not receive changed caller-visible semantics in place:

1. `org.openadam.file.inspect@0.1.0`;
2. `org.openadam.structured-data.analyze@0.1.0`;
3. `org.openadam.raster.prepare@0.1.0` and `@0.2.0`;
4. `org.openadam.raster.verify@0.1.0`;
5. `org.openadam.projective.transform@0.1.0` and `@0.2.0`;
6. `org.openadam.time-zone.convert@0.2.0`;
7. `org.openadam.package-dependency.evaluate@0.1.0`;
8. `org.openadam.standard-expression.run@0.1.0` and `@0.2.0`.

The Standard Expression `0.2.0` contract removes carrier-validation and
provider-infrastructure failures from the stable semantic error set. Those
failures remain at the adapter boundary rather than becoming portable domain
meaning.

Each Profile currently has one originating provider. That is enough to test
the ABI and one adapter against declared examples, but not enough to claim
cross-provider substitution. Such a claim requires two independent providers
for the same Profile and applicable property and differential coverage.

See [Public integrations](docs/INTEGRATIONS.md) for the provider boundary and
which current implementations are independently public.

## Contract objects

### Capability Profile

Defines a stable capability id and semantic version, its operations, canonical
input and output schemas, caller-visible behavior, stable errors, and
conformance references. It contains no provider command, endpoint, model,
latency, credential, or deployment policy.

### Provider Manifest

Declares one provider's version, the digest of the complete resolved Profile,
adapter, public transport targets, canonical contract digests, semantic-derived
annotations, live transport digests, and executable schema probe where
available. A manifest is a binding declaration, not proof that a package is
installed or an endpoint is healthy.

### Conformance Suite

Contains bounded, executable cases for one Profile. Levels are claim-sized:

- **L0** — document, identity, schema, error, and binding consistency;
- **L1** — portable golden cases for normal, boundary, ambiguity, and stable
  error behavior;
- **L2** — executable properties;
- **L3** — a shared differential corpus across independent providers;
- **L4** — externally observed effects where effects apply.

A provider-authored result or trace cannot promote itself into a higher-level
correctness, effect, or business claim.

## Use from source

Requires Node.js 22 or newer.

```sh
npm ci
npm run check
```

Validate one contract set:

```sh
node src/validate.mjs \
  --profile catalog/capabilities/file-inspect.v0.1.json \
  --suite catalog/conformance/file-inspect.v0.1.json \
  --manifest /path/to/provider/capabilities/provider.json
```

Run the declared suite through the real provider adapter:

```sh
node src/run-conformance.mjs \
  --profile catalog/capabilities/file-inspect.v0.1.json \
  --suite catalog/conformance/file-inspect.v0.1.json \
  --manifest /path/to/provider/capabilities/provider.json \
  --provider-root /path/to/provider
```

`npm run check:local-pilots` is a maintainer-only workspace check. It expects
specific sibling provider checkouts, some of which are not public. It is not a
prerequisite for using or contributing to this repository and its output is
not a substitution or production-readiness claim.

## Versioning and compatibility

Document format and Capability meaning version independently. Changing the
Profile schema version does not silently change a Capability's semantic
version. A change to accepted input, result meaning, ordering, units,
ambiguity, stable errors, or effects requires an appropriate Capability
version.

Once an `id@version` has entered the catalog or is consumed by a provider, its
semantic contract is immutable. A reviewer may identify a better or more
conservative contract, but that correction is published as a new semantic
version and consumers migrate explicitly. Provider performance, scheduling,
connection reuse, or internal algorithms may improve without a Capability
version change only while inputs, outputs, errors, effects, and caller-visible
meaning remain unchanged.

The older `openadam.capability-profile.v0.2` and
`openadam.capability-definition.v0.1` formats remain readable compatibility
inputs. New catalog entries use the forward v0.3 Profile format.

Current Profiles require Provider Manifest v0.3. See
[Provider Manifest v0.3](docs/migrations/provider-manifest-v0.3.md) for the
semantic binding migration.

## Scope

This project does not define a planner, Agent loop, memory system, workflow
language, provider marketplace, hosted registry, generic approval framework,
telemetry platform, or universal domain object model. New common fields require
demonstrated meaning across current Profiles and providers.

The npm package remains marked `private` because this release publishes source
and specifications on GitHub, not an npm distribution.

## License

Licensed under the Apache License, Version 2.0. See `LICENSE`, `NOTICE`, and
`THIRD_PARTY_NOTICES.md`.
