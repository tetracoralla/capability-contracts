# Product model

## User and task

The direct user is a provider author, host author, or standards maintainer who
needs one reusable operation to keep the same caller-visible meaning across
different implementations and transports.

The repository supplies a semantic narrow waist and executable conformance
tooling. It has no end-user interface and does not run an Agent.

## Stable objects

- **Capability Semantic ABI** — the common meta-model, versioning rules, and
  compatibility rules shared by all Profiles.
- **Capability Profile** — one versioned capability identity with canonical
  input, output, behavior, stable errors, and conformance references.
- **Capability Provider** — an independent product or service implementing one
  or more Profiles.
- **Provider Manifest** — one provider's version, complete resolved-Profile
  digest, adapter, transport bindings, targets, schema digests,
  semantics-derived annotations, and optional live schema probe.
- **Execution Result** — one portable semantic output. Runtime metadata belongs
  here only when callers need it to interpret the result.
- **Conformance Suite** — executable examples and properties scoped to one
  explicit claim level.

New Profiles use `openadam.capability-profile.v0.3`. The v0.1 and v0.2 document
families are compatibility inputs, not templates for new catalog entries.
Document format versions and Capability semantic versions are independent.
Cataloged or consumed `id@version` semantics are immutable. Corrections that
change caller-visible meaning, errors, state effects, ambiguity, or schemas use
a new semantic version; implementation-only optimization remains provider
work when the bound meaning is conserved.

## Relationship to Procedure and providers

```text
Procedure Profile
  references Capability id + version + operation
        |
Capability Profile and conformance
        |
Provider Manifest
        |
Provider-owned semantic core and adapters
```

A Capability Profile does not own provider business state. A Procedure does not
redefine Capability input or output semantics. A Provider Manifest does not own
Profile meaning. A transport such as MCP is a replaceable binding and never
becomes the Capability identity.

For the current document family, a provider binds the complete resolved
Profile rather than only its operation schemas. This makes changes to behavior,
stable errors, lifecycle, or semantics observable even when input and output
schema bytes did not change. Manifest annotations are checked projections of
Profile semantics, not independent safety authority.

## Semantic waist

The ABI standardizes only:

1. stable Capability and operation identity plus semantic version;
2. canonical input and output meaning;
3. behavior that changes caller interpretation or downstream action;
4. stable error meaning;
5. executable conformance references.

The canonical `openadam.capability-jsonl.v0.1` adapter envelope permits an
error object with exact fields `{code,message}` or
`{code,message,retryable}`. The Profile, not the adapter, owns retryability. If
the adapter echoes `retryable`, it must equal the declared error value; a host
derives its portable result from the Profile in either case.

Provider commands, endpoints, transport targets, deployment, latency, cost,
credentials, and live transport digests belong in Provider Manifests or owning
systems. UI labels, copy, aliases, and share links remain provider product
concerns.

Malformed adapter envelopes, unsupported carrier operations, process startup,
connection loss, and other provider-infrastructure failures are carrier
failures. They do not become stable Capability errors unless independent
providers and callers require the same distinction to preserve semantic
meaning.

Invocation ids, timings, traces, and runtime provenance belong in a semantic
result only when they change how a caller must understand or use it. Otherwise
they remain diagnostics. A provider-authored record cannot prove its own
correctness, durable effects, or a wider business claim.

## Profile extraction

Start from domain meaning, not the first provider's public schema:

1. inspect the provider's current input, output, errors, and boundary behavior;
2. identify an independent standard or concrete second-provider path where
   available;
3. keep only values that correct implementations must share to preserve
   meaning;
4. remove presentation, engine, trace, carrier, and deployment fields;
5. define exactness, units, ordering, ambiguity, context, and stable errors;
6. implement translation at the provider adapter;
7. add cases that fail on semantic or schema drift;
8. execute the suite through the real provider boundary.

Do not copy and rename an MCP, CLI, HTTP, or product schema as a standard.

## Conformance and claims

- **L0** checks document, identity, schema, stable error, manifest, and bounded
  adapter-envelope consistency.
- **L1** adds normal, boundary, applicable ambiguity, and stable-error golden
  cases for every operation.
- **L2** adds executable properties.
- **L3** compares independent providers for the same Profile over a shared
  corpus.
- **L4** observes declared effects through an authority outside the provider.

Canonical adapter conformance and live public-transport conformance are
separate. A manifest target is a declaration until an executable probe observes
that current target and its schemas. Neither lane establishes installed-host
availability, professional correctness, performance capacity, or human
experience.

Every current Profile is experimental and provider-seeded. Different-domain
providers demonstrate that the meta-model can remain domain-neutral; they do
not establish substitution for any one Profile.

## Repository strategy

Each provider remains an independent repository with its own source, history,
release, issues, and product acceptance. This repository contains only the
cross-provider standards assets and reference conformance tooling. Procedure
Contracts and Direct Execution Runtime are separate repositories with separate
responsibilities and releases.

## Non-goals

- Agent planning, memory, routing, scheduling, or a complete Agent OS;
- a workflow or Procedure implementation runtime;
- provider discovery, marketplace ranking, installation, or credentials;
- generic approvals, reviewers, attestations, billing, or business policy;
- product UI or provider source;
- a universal domain IR whose operations collapse into opaque metadata;
- speculative 3D scene, rendering, or animation semantics.

Shared fields are added only after current Profiles and providers demonstrate
the same cross-project meaning.
