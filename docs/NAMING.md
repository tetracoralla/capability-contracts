# Naming boundary

## Recommended terminology

The current implementation uses a descriptive hierarchy rather than forcing one brand across every product:

- **Capability Semantic ABI / 能力语义 ABI** — the current lower standard layer;
- **Procedure Standard / Procedure 标准** — the current upper composition layer;
- **capability-contracts** — the technical repository containing neutral schemas, catalog entries, conformance, and reference tooling;
- **Capability Contract / 能力契约** — one portable, versioned semantic interface;
- **Capability Provider / 能力提供者** — an independent product that implements one or more contracts.

Migratory Time, Equatorium, Laniakea, Math Anchor, and future tools keep their own product identities. This prevents a standard-layer rename from breaking product discovery, package names, CLI commands, plugins, or existing users.

## Preliminary conflict screen

Checked on 2026-08-14:

- the exact phrase “Agent Capability Substrate” did not show a dominant adjacent software project in the initial search;
- “Agent Stdlib” is already crowded, including the public `@agentic/stdlib` package, and is frozen outside the current two-standard scope;
- “Agent Capability Contract” is also used generically in current research and projects, which supports it as a descriptive artifact name but makes it weak as an exclusive brand;
- “AgentOS” and similar operating-system labels are already heavily occupied and imply a runtime, security, scheduling, and observability scope this project does not currently implement.

This is preliminary ecosystem screening, not trademark clearance. No domain, organization, package, or trademark should be reserved until the owner confirms the public identity.

## Stable identifier rule

Capability IDs remain descriptive reverse-domain identifiers such as `org.openadam.time-zone.convert`. Product brands and transport tool names are bindings, not capability identities. A future public brand decision must not silently rename stable capability IDs.
