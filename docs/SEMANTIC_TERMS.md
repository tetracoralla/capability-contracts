# Semantic terms and conformance claims

This document is normative for current `openadam.capability-profile.v0.3`
documents and for forward Procedure-to-Capability compatibility checks. The
v0.1/v0.2 fields remain readable only as compatibility inputs.

## Canonical JSON and digests

Every `schemaDigest`, contract digest, and value digest is `sha256:` plus the
lowercase hexadecimal SHA-256 of the UTF-8 bytes
produced by RFC 8785 JSON Canonicalization Scheme (JCS). Producers must reject
duplicate object names, lone Unicode surrogates, non-finite numbers, sparse
arrays, and values outside the JSON data model. Large or exact numbers that
cannot safely use IEEE-754 binary64 must be represented as strings in a Profile.

The object stored or transported does not have to use canonical byte order. JCS
is applied to the parsed I-JSON value only when a digest or exact semantic
comparison is required.

## Operation semantics

- `resultVariability` is either `deterministic` or `stochastic`. It describes
  whether the same canonical input, referenced resources, and runtime/ambient
  context produce the same semantic result. It does not encode where context
  comes from or whether state is read or changed.
- `contextSources` lists semantic inputs not contained by value in the canonical
  request: `referenced-resource` for content reached through a path or other
  coordinate, `runtime` for a named provider database or runtime version, and
  `ambient` for implicit clocks, locale, permissions, or process environment.
  An empty list means the canonical request fully determines semantic context.
- `stateAccess` is an upper-bound ladder: `none < read < write < destructive`.
  `read` observes mutable external state. `write` creates or replaces durable
  state. `destructive` can remove data or make prior state materially harder to
  recover. This field is independent from result variability.
- `idempotency` is `idempotent`, `non-idempotent`, or `unverified`. Idempotent
  means retrying the complete operation with the same canonical input and the
  same referenced/runtime/ambient context produces the same semantic result and
  does not add, duplicate, or newly fail because of its own prior effects. An
  operation that creates an output and then returns `OUTPUT_EXISTS` on the
  identical retry is non-idempotent. Use `unverified` rather than a hopeful
  boolean when no current property or effect test supports the claim.
- `openWorld` says whether successful interpretation may depend on identities or
  facts outside the enumerated Profile domain. It does not authorize network or
  filesystem access by itself.
- `ambiguity` states whether ambiguity is impossible, rejected, returned as
  candidates, or requires more context. It does not authorize guessing.
- `provenance` describes whether the canonical output must identify semantic
  context needed to interpret or replay the result.

`retryable` is stable error meaning, not an instruction to retry immediately.
It is true only when the identical request can reasonably succeed after a
transient condition changes. Invalid or ambiguous input and a fixed request,
dimension, pixel, memory, or response limit are not retryable without changing
the input or configured bound.

At the `openadam.capability-jsonl.v0.1` adapter boundary, `retryable` is an
optional compatibility echo. Error objects have exactly `code` and `message`,
with optional `retryable`; no other fields are portable. When present, the
value must equal the matching Profile error declaration. A conforming host
uses the Profile declaration as authority and therefore produces the same
portable retryability whether an older adapter omits the echo or a newer one
includes it.

## Adapter and transport evidence

Canonical adapter conformance validates the provider's Capability JSONL adapter
against canonical requests and results. It validates declared contract schema
digests, but does not execute or introspect the manifest's MCP, CLI, HTTP, or
library target.

Live transport binding conformance is a separate lane. Provider Manifest v0.3
declares an executable schema probe. The reference runner asks that current
probe for operation identity, transport, target, and live input/output schemas,
then compares them with `transportSchemaDigests`. A probe pass covers only the
observed binding; it does not establish installed-host availability, Agent
routing, semantic correctness, or substitution.

Provider Manifest v0.3 binds the complete resolved Profile through
`profileDigest`. The manifest annotations are deterministic projections of
Profile semantics: read-only from `stateAccess`, destructive from destructive
state access, idempotent from `idempotency`, and open-world from `openWorld`.
They cannot weaken or replace the Profile.

## Conformance claim levels

- L0 validates documents, identities, operation schemas, declared errors,
  manifest declarations, contract digests, bounded canonical adapter envelopes,
  and at least one executable case per operation. Live transport binding is
  reported separately rather than implied by L0.
- L1 adds portable golden coverage for a normal success, a boundary, every
  stable error, and an ambiguity case whenever ambiguity applies, for every
  operation. Case `facets` identify the normal, boundary, and ambiguity vectors;
  error coverage is derived from actual error expectations.
- L2 adds properties over generated inputs and invariants.
- L3 requires two independent providers for one Profile and differential
  comparison over a shared corpus.
- L4 validates observed effects through an authority outside the implementation
  under test. A self-authored receipt cannot establish L4.

The first six catalog suites deliberately claim L0. The package-dependency
suite explicitly claims L1 because every one of its six operations covers a
normal and boundary vector and declares no stable semantic errors or applicable
ambiguity. That remains one-provider golden coverage; it does not establish L2
properties, L3 substitution, package-manager equivalence, or L4 effects.

`openadam.differential-suite.v0.1` is a separate current-source comparison
artifact. It does not upgrade an ordinary Conformance Suite's declared level.
Its runner compares schema-valid semantic results exactly after removing only
explicit, present JSON Pointer paths. Each exception states its review basis;
that text records maintainer judgment and is not a mechanical proof that the
path is safe to ignore. Error messages are provider presentation and are not
compared, while error outcome, declared code, and Profile-owned retryability
are compared.
