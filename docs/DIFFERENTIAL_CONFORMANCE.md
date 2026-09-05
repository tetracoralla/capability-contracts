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

The checked Python `zoneinfo` implementation is a conformance witness, not a
second released provider product. The current route therefore supports drift
detection and the tested semantic agreement only. It does not support an L3
substitution or adoption claim.
