# Differential conformance

`openadam.differential-suite.v0.1` compares two distinct Provider Manifests
implementing one exact Capability Profile. It exists to find semantic drift
that one provider's own golden cases can miss.

The reference runner:

1. validates the Profile and ordinary Conformance Suite;
2. validates both complete Provider Manifest bindings and requires distinct
   Provider ids;
3. validates every shared input against the selected operation schema;
4. executes both real Capability JSONL adapters with bounded request, response,
   stderr, timeout, and shutdown behavior;
5. validates success results against the output schema and errors against the
   Profile's declared code and retryability;
6. removes only explicit, present, non-overlapping ignored JSON Pointer paths;
7. compares canonical semantic outcomes; and
8. reports mismatches by outcome and digest without printing result or stderr
   content.

Ignored paths are exceptional. The Profile owner records a typed comparison
policy once per suite; each permitted path has an operation, semantic role,
and human-reviewable basis. A case may select only paths from that allowlist,
and runtime-context or provenance roles must remain beneath their corresponding
result objects. This prevents an operation-wide context declaration from
authorizing omission of an unrelated business result. The policy basis still
requires review; the validator cannot prove a correctly located field is
semantically irrelevant.

The current time-zone suite ignores only
`/context/timeZoneDatabase`. Both implementations must still return that field,
while instant, ordering, offsets, ambiguity branches, source echo, status,
stable errors, and retryability compare exactly. The 12 cases cover modern
conversion, repeated-time candidates and choices, a skipped time, non-hour
offsets, `Etc/GMT` sign convention, invalid calendar input, unknown zone,
the rejected and accepted sides of the shared lower-year boundary, and
sub-minute historical precision.

## Semantic agreement and product replacement

Implementation independence and semantic coverage determine what a differential
comparison supports. A thin adapter around an independent engine can contribute
to scoped semantic substitution evidence; releasing a second product is not a
prerequisite. State the exact Profile, operations, tested input domain,
properties, comparison exceptions, and consumer behavior actually observed.
Agreement on a finite corpus does not establish equivalence for every input.

Distribution, installation, live public transports, support, and user adoption
are separate observations needed for the corresponding product claims. A
semantic comparison cannot establish that an alternative is a deployable or
supported replacement.

The current 12-case route supports drift detection and the tested semantic
agreement. The Python `zoneinfo` witness is not a released replacement product.
Neither that route nor the generated experiment below changes the ordinary
suite's declared L0 level; L2/L3 claims still require the applicable coverage
defined in [Semantic terms](SEMANTIC_TERMS.md#conformance-claim-levels).

## Generated development corpus

`npm run check:time-zone-differential -- --generated` preserves those 12 cases
and adds 192 reproducible UTC-anchored cases. Seed `20260905` selects 96 instants,
including fixed minute boundaries around New York and Lord Howe transitions;
each instant uses nine target zones in forward and reverse order. The generated
domain spans 2024–2028 and includes half-hour and quarter-hour offsets. The
generator uses neither Provider's answers nor a time-zone engine to select
inputs. Its complete 204-case suite validates against the existing schema and
uses the same one-field comparison exception. It changes no Profile, semantic
version, schema, or catalog claim level.

`scripts/time-zone-substitution-corpus.mjs` also supplies UTC instant, source
echo, target-order, and local-time/offset conservation assertions. These are
independent of pairwise agreement: two providers returning the same wrong
instant must still fail. Mutation regressions exercise those failures. The raw
differential command compares outcomes; the assertions additionally execute
through Agent Host's `check:local-substitution` maintainer experiment.

That Host experiment runs the unchanged consumer through its library and a CLI
client of its local service. It compares results and Profile-owned error codes
and retryability, rejects Host failures as semantic outcomes, checks current
contract identity, and records runtime/database context separately. The witness
remains a development dependency. Generated differential coverage and Host
mechanics do not promote the catalog from its declared L0 coverage, establish
two independent consumer products, or establish a released replacement.
