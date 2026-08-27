# Provider Manifest v0.3

Current Capability Profiles use `openadam.provider-manifest.v0.3`.

v0.2 bound canonical operation schemas but could not detect a semantic-only
Profile change. It also left operation annotations as provider-authored hints.
v0.3 closes both gaps:

- every implementation declares `profileDigest`, the JCS SHA-256 digest of the
  complete Profile with relative operation schemas resolved inline and the
  document-location-only `$schema` field omitted;
- `adapterBindings` are required for every implemented operation;
- the four annotations are closed booleans and must exactly match the bound
  operation semantics;
- `transportSchemaProbe` remains optional because live public transport
  acquisition is a separate conformance lane.

To migrate a provider, resolve the current v0.3 Profile and operation schemas,
compute the complete Profile digest, move the manifest to v0.3, declare the
complete adapter operation set, and derive annotations from Profile semantics.
Then rerun provider drift, canonical adapter conformance, and any applicable
live transport probe. Changing only the digest to accept semantic drift is not
a migration; review and version the changed Capability meaning first.

Older manifest schemas remain published historical inputs, but a current v0.3
Profile is not validly bound by them.
