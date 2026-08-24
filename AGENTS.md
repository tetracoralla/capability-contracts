# Capability Contracts repository guidance

Read `docs/PRODUCT_MODEL.md`, `docs/SEMANTIC_TERMS.md`, and
`docs/REVIEW_CONTRACT.md` before changing or reviewing the ABI, catalog,
manifests, conformance suites, or reference tooling.

A plain owner request to review, audit, 审核, or 复核 automatically invokes the
complete review contract in read-only mode unless fixes are also requested.
Treat it as the minimum scope, not a ceiling, and finish with `tools-dev
workspace escalations` for provider, Procedure, installed-host, or shared
resource implications; do not ask the owner to supply a separate checklist.

## Ownership boundary

This repository owns portable capability semantics, provider declarations, conformance cases, and the reference validator/runner. It does not own provider business logic, product UI, provider releases, Agent planning, desktop permissions, or a full Agent OS.

## Change discipline

- Treat current provider source and live runtime schemas as the implementation facts; never infer them from an old manifest.
- A Capability Profile is provider-neutral even when a provider seeds the experimental contract.
- Never copy a provider's product or transport schema wholesale and rename it a standard. Define a canonical semantic projection and require the provider adapter to translate it.
- Keep contract schemas, provider contract digests, and live transport digests mechanically aligned.
- Transport bindings such as MCP are replaceable adapters and must not become the capability identity.
- Add the smallest negative regression test whenever a drift, bounds, ambiguity, or error-carrier bug is fixed.
- Report development regression, provider conformance, installed Agent flow, human runtime flow, and owner business acceptance as separate lanes.
- One provider passing one profile does not prove substitution. Require two independent providers for the same profile plus differential coverage before making a cross-provider substitution claim.
- Do not auto-commit or publish. Repository name, public organization, license, and stable-version governance remain owner decisions.

## Scope guard

Do not add planners, memory, Agent scheduling, GUI, billing, marketplace policy, device control, or speculative universal ontology to this repository. New fields must be justified by a real provider contract or an explicit owner requirement.

The owner has frozen the 3D direction. Do not add scene graphs, primitives,
meshes, materials, cameras, lights, animation, renderers, scene recipes,
Three.js/R3F bindings, Scene Lab, `scene.create`, or `recipe.apply` without a new
explicit owner decision and a fresh standardization case. Projective remains a
two-dimensional image-transformation Profile and must not be presented as a 3D
runtime foundation.
