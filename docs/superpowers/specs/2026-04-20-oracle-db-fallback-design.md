# Oracle DB Fallback for DenomExchangeService

## Why

The API's `/v1/market-data` endpoint is the primary price source for deploy-web and stats-web. `DenomExchangeService.getExchangeRateToUSD()` currently calls the on-chain oracle with no fallback — if the oracle reports unhealthy or the RPC call fails, the endpoint errors out.

This design adds a persistent DB fallback using `day.aktPrice` so pricing remains available even when the oracle is temporarily down.

## Approach

**Approach B: Separate health check from RPC failure** — distinguish "oracle unhealthy" from "oracle unreachable" with distinct log messages, but use the same DB fallback for both cases.

## Data Flow

```
GET /v1/market-data/{coin}
  -> MarketDataController
    -> StatsService.getMarketData()
      -> DenomExchangeService.getExchangeRateToUSD()
          |-- Try oracle RPC call (getAggregatedPrice + getPrices + getLatestBlock)
          |   |-- Success + isHealthy=true -> return oracle price + 24h change
          |   |-- Success + isHealthy=false -> log warning -> fall back to DB
          |-- RPC exception -> log warning -> fall back to DB
                                               |
                                               v
                                    DayRepository.getLatestAktPrice()
                                      -> { price, volume:0, marketCap:0,
                                           priceChange24h:0, priceChangePercentage24:0 }
```

## Changes

### 1. DenomExchangeService (`apps/api/src/chain/services/denom-exchange/denom-exchange.service.ts`)

**New dependencies injected:**
- `DayRepository` — reads `day.aktPrice` from DB
- `LoggerService` — logs fallback warnings

**Modified method: `getExchangeRateToUSD()`**

1. **Try** the oracle RPC call (existing `getAggregatedPrice` + `getPrices` + `getLatestBlock`)
2. **On success**, check `currentRate.priceHealth?.isHealthy`
   - `true` -> return oracle data (current behavior, unchanged)
   - `false` -> log `{ event: "ORACLE_PRICE_UNHEALTHY", denom }` at warn level -> call DB fallback
3. **On exception** -> log `{ event: "ORACLE_RPC_FAILED", denom, error }` at warn level -> call DB fallback

**Fallback return shape** (identical to happy path):
```typescript
{
  price: day.aktPrice ?? 0,
  volume: 0,
  marketCap: 0,
  marketCapRank: 0,
  priceChange24h: 0,
  priceChangePercentage24: 0
}
```

**Caching:** The existing `memoizeAsync` wrapper (10-minute TTL) stays unchanged. Fallback responses are cached the same way.

### 2. DayRepository (`apps/api/src/gpu/repositories/day.repository.ts`)

**New method: `getLatestAktPrice()`**

Queries the most recent `day` row with a non-null `aktPrice`, ordered by `date` descending, limit 1. Returns the `aktPrice` number or `null` if no rows have a price.

### 3. No Changes Needed

- `StatsService`, `MarketDataController`, route handler, response schema — unchanged
- deploy-web and stats-web — no frontend changes, same `/v1/market-data` response shape
- `memoizeAsync` config — stays at 10-minute TTL
- volume, marketCap, marketCapRank already return 0 on the oracle path

## Testing

**Unit tests only** (`denom-exchange.service.spec.ts`):

| Test case | Condition | Expected |
|-----------|-----------|----------|
| Oracle happy path | `isHealthy: true` | Returns oracle price + 24h change (existing test) |
| Oracle unhealthy | `isHealthy: false` | Returns DB price, `priceChange24h: 0`, logs `ORACLE_PRICE_UNHEALTHY` warning |
| Oracle RPC failure | `getAggregatedPrice` throws | Returns DB price, `priceChange24h: 0`, logs `ORACLE_RPC_FAILED` warning |
| Oracle down + no DB price | RPC throws, DB returns `null` | Returns `price: 0`, logs warning |

## Decisions

- **Fallback source:** `day.aktPrice` from existing `DayRepository` (currently populated by indexer via CoinGecko)
- **Cross-module dependency:** `DenomExchangeService` (chain module) imports `DayRepository` (gpu module) — accepted trade-off for simplicity
- **24h price change on fallback:** Returns 0 (no historical data available in fallback mode)
- **Cache behavior on fallback:** Same 10-minute TTL as happy path — acceptable even if oracle recovers sooner
- **No functional tests:** Covered at unit test level only
