# Time-zone conversion Profile v0.2

`org.openadam.time-zone.convert@0.1.0` was the local baseline experiment. Its
active catalog files mirrored Migratory Time's product-facing aliases,
presentation fields, and carrier shapes too closely, so it was never a valid
cross-provider substitution boundary and was not published from this repository.
The original committed files remain available in Git history at commit
`72b9765`.

Version `0.2.0` is the first active provider-neutral projection. It changes the
accepted inputs and result meaning, so the correction is versioned rather than
silently retaining the old identity. The Profile now uses canonical ISO local
date-time text, named IANA zones, ordered targets, explicit repeated/nonexistent
time branches, and the provider's time-zone database context. Product aliases,
labels, copy text, share URLs, and transport limits remain in Migratory Time.

Migratory Time implements `0.2.0` through its canonical adapter, which currently
passes the L0 suite. That does not by itself introspect the packaged MCP target;
live transport and installed-host evidence remain separate. No second provider
currently establishes substitution.
