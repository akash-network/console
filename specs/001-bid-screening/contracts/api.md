# API Contract: Bid Screening

**Feature**: Bid Screening
**Date**: 2026-04-27

## POST /v1/bid-screening

Check which online providers can fulfil a deployment's resource
requirements.

### Request

**Method**: POST
**Path**: `/v1/bid-screening`
**Security**: None (public endpoint; provider data is public)
**Content-Type**: `application/json`
**Cache**: `max-age: 30, stale-while-revalidate: 60`
**Body Limit**: 64KB

#### Request Body Schema

```json
{
  "name": "string",
  "requirements": {
    "signedBy": {
      "allOf": ["string"],
      "anyOf": ["string"]
    },
    "attributes": [
      { "key": "string", "value": "string" }
    ]
  },
  "resources": [
    {
      "resource": {
        "id": 1,
        "cpu": {
          "units": { "val": "1000" },
          "attributes": []
        },
        "memory": {
          "quantity": { "val": "4294967296" },
          "attributes": []
        },
        "gpu": {
          "units": { "val": "0" },
          "attributes": []
        },
        "storage": [
          {
            "name": "default",
            "quantity": { "val": "10737418240" },
            "attributes": [
              { "key": "persistent", "value": "false" },
              { "key": "class", "value": "ephemeral" }
            ]
          }
        ],
        "endpoints": []
      },
      "count": 1,
      "price": {
        "denom": "uakt",
        "amount": "1000"
      }
    }
  ]
}
```

The body follows the `GroupSpec` protobuf schema from
`@akashnetwork/chain-sdk` (deployment/v1beta4). The `val` fields in
ResourceValue are string-encoded integers (matching protobuf
Uint8Array serialization).

### Response

**Status**: 200 OK
**Content-Type**: `application/json`

#### Response Body Schema

```json
{
  "providers": [
    {
      "owner": "akash1abc...",
      "hostUri": "https://provider.example.com:8443",
      "region": "us-east",
      "uptime7d": 0.9987,
      "isAudited": true
    }
  ]
}
```

| Field | Type | Description |
|-------|------|-------------|
| owner | string | Provider address (primary key) |
| hostUri | string | Provider HTTPS endpoint |
| region | string | null | Geo-resolved region from IP |
| uptime7d | number | null | 7-day uptime as decimal (0.0-1.0) |
| isAudited | boolean | True if signed by a known auditor |

### Error Responses

#### 400 Bad Request — Invalid Input

```json
{
  "error": "Bad Request",
  "message": "Persistent storage volume must specify a valid storage class"
}
```

Returned when:
- GroupSpec contains no resource units
- Persistent volume has empty class or class "ram"
- GPU attributes are malformed (invalid vendor/model path format)
- ResourceValue cannot be parsed as a valid integer

#### 400 Bad Request — Validation Error

```json
{
  "error": "Bad Request",
  "message": "resources[0].resource.cpu.units.val must be a positive integer"
}
```

Returned when Zod schema validation fails on the request body.

### Performance

- Hard ceiling: <5s for up to 10,000 online providers
- Normal load (~1,000 providers): sub-second expected
- Concurrent: 50 simultaneous requests MUST each complete within 5s
