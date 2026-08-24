# Capability Profile document format v0.2

## Decision

`openadam.capability-profile.v0.2` was the first Profile-named machine-document
format. Current authoring has moved to
[Capability Profile v0.3](capability-profile-schema-v0.3.md); this document now
describes compatibility history only.

`openadam.capability-definition.v0.1` remains readable as a compatibility
format. The validators and conformance runner prefer `--profile`; the legacy
`--definition` argument remains accepted for existing callers. New catalog
documents use v0.3 and `--profile`.

## Compatibility boundary

This is a document-format and terminology migration, not a change to the
semantic version of any Capability Profile. It does not alter operation input
or output schemas, stable errors, conformance cases, Provider Manifests,
provider operation schema digests, or the `openadam.capability-jsonl.v0.1`
adapter envelope.

Reading a legacy document proves only format compatibility. It does not create
a substitution claim, upgrade a Profile lifecycle, or imply that two providers
implement the same semantics.

## Migration rule

For an existing v0.1 definition whose semantic content is unchanged:

1. change only `schemaVersion` to `openadam.capability-profile.v0.2`;
2. invoke tooling with `--profile`;
3. keep the Profile's own `version` and provider schema digests unchanged;
4. rerun catalog validation and real-provider conformance.

If any semantic field changes, treat that as a separate Profile change and
apply the normal semantic-version and conformance review instead of calling it
a format-only migration.
