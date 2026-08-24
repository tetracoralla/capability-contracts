# Capability Profile document format v0.3

## Decision

Current catalog Profiles use `openadam.capability-profile.v0.3`. Capability ids,
Capability semantic versions, operation ids, canonical schemas, and provider
contract digests do not change merely because the document format migrated.

## Semantic field correction

The v0.2 `determinism` ladder mixed stochastic behavior, external context, and
mutable state into one ordered value. It made deterministic file operations look
contradictory and allowed pure operations to be labeled context-dependent.

v0.3 replaces that group with orthogonal fields:

- `resultVariability`: deterministic or stochastic;
- `contextSources`: referenced resource, runtime, or ambient context outside the
  canonical request value;
- `stateAccess`: none, read, write, or destructive;
- `idempotency`: idempotent, non-idempotent, or unverified.

`openWorld`, `ambiguity`, and `provenance` retain their existing meaning. The
v0.1/v0.2 document families remain readable for compatibility but do not guide
new Profiles.

Fixed `LIMIT_EXCEEDED` errors are non-retryable: an identical request cannot
succeed until its input or configured bound changes. Truly transient provider or
deadline failures remain separate stable errors when the Profile declares them.
