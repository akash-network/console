# Context Map

## Contexts

- [Bid Screening](./apps/provider-inventory/CONTEXT.md) — pre-filters the providers likely to satisfy a deployment's resource groups, fed by the provider inventory streamer
- [Console API](./apps/api/CONTEXT.md) — the public REST API Console users and API-key clients call to deploy and pay for workloads

## Relationships

- **Console API → Bid Screening**: the API keeps the public bid-screening route only as a thin proxy to `apps/provider-inventory`
