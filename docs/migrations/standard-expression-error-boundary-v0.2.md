# Standard Expression stable-error migration to 0.2

`org.openadam.standard-expression.run@0.1.0` declared
`ADAPTER_INVALID_REQUEST` and `PROVIDER_ERROR` as stable Capability errors.
Those codes describe the JSONL carrier and provider infrastructure rather than
portable expression semantics.

The corrected semantic identity is
`org.openadam.standard-expression.run@0.2.0`. Its canonical input and output
schemas are unchanged and its stable error set is empty. Expression-level
failure remains represented by the canonical structured output.

Consumers and Provider Manifests migrate explicitly from `0.1.0` to `0.2.0`
and update the complete resolved-Profile digest. The `0.1.0` Profile and suite
remain readable historical contracts; their meaning is not rewritten in
place.

Adapter-envelope validation, unsupported carrier operations, process startup,
connection loss, and provider transport failures terminate or fail the
carrier invocation. They must not be emitted as semantic `0.2.0` Capability
errors.
