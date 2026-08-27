# Capability Semantic ABI review contract

This contract defines the evidence required to review the provider-neutral
Capability Semantic ABI, its catalog, and its reference conformance tooling.
It does not certify a provider product, an installed Agent route, a Procedure,
or cross-provider substitutability by itself.

Read `PRODUCT_MODEL.md` and `SEMANTIC_TERMS.md` first. Review current central
documents together with the current provider source, manifest, adapter, public
transport, and owning provider regression. A catalog snapshot or provider-made
receipt is never authority over a changed live implementation.

## Owning layers and non-owning neighbors

- `schemas/` owns the document formats for Capability Profiles, Provider
  Manifests, and Conformance Suites. The forward Profile format is
  `openadam.capability-profile.v0.3`; the v0.1/v0.2 families are compatibility
  inputs, not templates for new catalog work. Current Profiles require
  `openadam.provider-manifest.v0.3`. It also owns the closed
  `openadam.capability-jsonl.v0.1` request/result/error envelope.
- `catalog/capabilities/` owns provider-neutral semantic identities,
  operations, canonical schemas, behavior, and stable errors.
  `catalog/conformance/` owns claim-sized portable examples against those
  semantics.
- `src/lib/contracts.mjs` owns parsing, JCS digests, document/cross-document
  validation, schema resolution, and claim-level checks.
- `src/run-conformance.mjs` owns the canonical Capability JSONL adapter lane.
  `src/run-transport-conformance.mjs` owns the separate live public-transport
  schema lane. Neither runner establishes installed-host availability,
  professional correctness, performance capacity, or human experience.
- A provider repository owns its semantic core, adapter translation, product
  transport, limits, runtime behavior, UI, packaging, and release. A Provider
  Manifest declares those bindings; it does not transfer ownership here.
- The adjacent `procedure-contracts` repository owns compositions of Capability
  requirements. Capability Profiles must not absorb stage order, checkpoints,
  approvals, roles, receipts, planners, or a generic workflow runtime.

## Semantic and versioning invariants

1. **The waist is a canonical semantic projection.** Never copy a provider's
   MCP, CLI, HTTP, product, or implementation schema wholesale and rename it a
   Profile. Keep product aliases, UI labels, engine names, carrier envelopes,
   execution knobs, and provider defaults outside the Profile unless multiple
   independent implementations need the same value to preserve meaning.
2. **Document format and capability meaning version independently.** A Profile
   schema migration does not silently change `id`, semantic `version`, operation
   IDs, canonical schemas, or provider contract digests. A semantic change uses
   the compatibility rules and an appropriate Profile version; legacy document
   readers must not make new legacy catalog entries acceptable. After an
   `id@version` is cataloged or consumed, review findings cannot rewrite its
   semantic identity in place. Preserve the old document, publish the
   corrected meaning under a new version, and migrate provider and Procedure
   bindings explicitly. Internal provider optimization needs no semantic bump
   only when the complete bound meaning remains unchanged.
3. **Operation semantics stay orthogonal.** Review `resultVariability`,
   `contextSources`, `stateAccess`, `idempotency`, `openWorld`, `ambiguity`, and
   `provenance` independently. Do not encode mutable context as stochasticity,
   write authority as idempotency, or a fixed limit error as retryable.
   Unknown or unproved properties use the explicit conservative value rather
   than an optimistic boolean.
4. **Stable errors are part of the ABI.** Every error code is unique within its
   operation, has stable meaning and retryability, and is exercised at the
   declared claim level. Provider-only infrastructure details remain in the
   provider carrier unless callers need a portable semantic distinction.
5. **Exact values survive JSON.** Profiles use I-JSON values. Large or exact
   numbers unsafe in IEEE-754 binary64 are strings. JCS digests reject duplicate
   object names, lone Unicode surrogates, non-finite numbers, sparse arrays, and
   non-JSON values. Digest comparison uses the parsed value, not source file
   formatting or object key order.

## Cross-document and provider seams

Every changed Profile must be reviewed through this complete chain:

```text
Profile identity + operations + canonical schemas + errors
  -> Conformance Suite identity, operation coverage, inputs and expectations
  -> Provider Manifest implementation and complete bindings
  -> canonical adapter operation targets and contract schema digests
  -> current provider adapter execution
  -> optional live transport probe, targets and transport schema digests
  -> Procedure references by exact capability id + version + operation id
```

Required properties of that chain:

- operation IDs and case IDs are unique; every operation has an executable
  case; inputs and exact success expectations validate against the resolved
  canonical schemas; error cases name only declared stable errors;
- relative schema references cannot escape the catalog capability root;
- a manifest implements each declared Profile version at most once and binds
  exactly the Profile's operation set—no missing, extra, or duplicate public or
  canonical adapter binding;
- `contractSchemaDigests` equal the current canonical Profile schemas. A live
  `transportSchemaDigest` describes the observed product transport and need not
  equal the canonical schema because the adapter may translate between them;
- `profileDigest` equals the JCS digest of the complete Profile with relative
  operation schemas resolved inline and `$schema` location omitted. Semantic,
  lifecycle, stable-error, or description drift is rejected even when schema
  digests remain unchanged;
- adapter and probe working directories remain relative and contained by the
  explicitly supplied provider root;
- Provider Manifest v0.3 `adapterBindings` identify the real canonical adapter
  targets. Its four annotations must exactly project each operation's
  `stateAccess`, `idempotency`, and `openWorld` semantics; they are not trusted
  independent claims. A public `bindings` entry is only a declaration until the
  executable transport probe observes its current transport, target, and schemas;
- every active pilot is either enrolled in the current pilot runner with its
  real provider-local drift check or explicitly documented as catalog-only.
  Adding a catalog file without updating the owning cross-repository route is
  an incomplete integration.

## Conformance claim discipline

- **L0** establishes document, identity, schema, error, manifest, bounded
  adapter-envelope, and at-least-one-case-per-operation consistency.
- **L1** additionally requires, for every operation, a normal success, a
  boundary, every stable error, and an ambiguity case whenever applicable.
  It is one-provider portable golden coverage, not broad correctness.
- **L2** requires executable properties over generated inputs and invariants.
- **L3** requires two independent providers for the same Profile and a shared
  differential corpus. Different-domain pilots do not count toward this claim.
- **L4** requires observed-effect evidence from an authority outside the
  implementation under test. A provider-generated trace or receipt cannot
  verify its own durable effects.

A suite's declared level is the highest fully enforced level, not an aspiration.
One provider passing L0/L1 supports only provider conformance to an experimental
Profile. Do not say “interchangeable”, “substitutable”, or “standardized across
providers” without the applicable L2/L3 evidence.

## Runner safety and adversarial matrix

The canonical adapter runner must preserve all of these boundaries:

- one newline-delimited JSON request per case and one response with the exact
  `{id, ok, result}` or `{id, ok, error}` envelope;
- an error contains exactly `{code, message}` or
  `{code, message, retryable}`; its code is declared by the bound operation and
  an echoed `retryable` exactly matches the Profile;
- at most 1 MiB for each request line and response line, 64 KiB captured stderr,
  each case's whole-call timeout, forced termination on protocol or timeout
  failure, and a two-second clean-shutdown bound;
- rejection of malformed/duplicate-key JSON, contradictory envelopes, unknown
  or duplicate response IDs, partial final lines, undeclared error codes,
  invalid result schemas, wrong exact/subset expectations, early exit, hang,
  oversized output, stderr flooding, and provider-root escape;
- failure isolation: a failed or timed-out adapter cannot remain alive or let a
  later case inherit pending state.

The live-transport runner separately requires one bounded JSONL response,
exactly the declared operation order/set, transport and target identity, and
current input/output schema digests. Exercise missing probe, wrong target,
wrong schema, extra/missing binding, duplicate keys, multi-line output, stderr
overflow, timeout, non-zero exit, and path escape when that lane changes.

Reference conformance is deliberately sequential and claim-oriented. It is not
a provider load test. A Profile or runner change that targets scale must publish
a reproducible before/after corpus with document/case counts, bytes, validation
time, adapter startup and case timing, peak memory, timeout/cleanup behavior,
and failure rate. Provider throughput, concurrency, cost, and batch robustness
remain provider-owned review items.

## Scope and promotion guards

- No planner, memory, Agent scheduler, GUI, billing, marketplace, hosted
  registry, generic approval system, optional future consumer fields, or full
  Agent OS belongs in this repository.
- 3D scene graphs, primitives, meshes, materials, cameras, lights, animation,
  renderers, Three.js/R3F bindings, Scene Lab, `scene.create`, and
  `recipe.apply` remain frozen out of scope. The projective Profile is a 2D
  image transform contract.
- Add a common ABI field only when current provider/Profile evidence shows the
  same cross-project meaning. One provider needing a value normally means the
  adapter or manifest owns it.
- Promote an experimental Profile or a substitution claim only at the smallest
  level supported by current evidence. Public organization, repository naming,
  stable 1.0 governance, and publication remain owner decisions.

## Rerunnable evidence and reporting lanes

Run the standard repository checks from its root:

```sh
npm run check
```

`npm run check` covers reference-tool regressions, the central catalog, legal
inventory drift, and public repository invariants.

For current provider integrations run:

```sh
npm run check:local-pilots
```

This is a cross-repository check. A PASS means the provider-local drift command
and canonical adapter suites passed for the providers the script currently
lists; live public-transport evidence exists only for pilots on which the script
also ran the transport probe. It does not establish that a plugin is installed,
an Agent naturally routed to it, the human product works, or two providers are
substitutable.

Report separately:

- **Development regression:** schemas, reference tests, catalog validation,
  repository invariants, and changed-provider source checks.
- **Provider conformance:** exact Profile/provider/version, suite claim level,
  case count, canonical adapter target, and current digest agreement.
- **Live transport binding:** exact observed binding/probe and what it does not
  establish.
- **Installed Agent flow:** host availability, permissions/credentials, cold
  routing, real invocation, and invalid-entry behavior.
- **Human runtime flow:** provider product behavior and persistence, if it has a
  human surface.
- **Substitution/effects/business acceptance:** L2/L3/L4 and owner/system
  judgments, never inferred from the lanes above.

Close each applicable lane with `PASS`, `FAIL`, or `BLOCKED`, naming the current
command or flow, provider checkout, manifest/profile versions, and unresolved
risk. If a central file, provider source, manifest, or Procedure reference moved
during review, restart against the new stable target.
