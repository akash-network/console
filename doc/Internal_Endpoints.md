# Internal endpoints that are not part of the public api

Those endpoints are used for debugging and analytics purposes.

- [GPU Stats](#gpu-stats) - Distribution of gpu vendor/model
- [Provider Versions](#provider-versions) - See what akash version providers are running

## GPU Stats

Url: https://api.console.akash.network/internal/gpu

Returns a summary of the gpus on the network.

### Example Response

```
{
  "gpus": {
    "total": {
      "allocatable": 2,
      "allocated": 0
    },
    "details": {
      "nvidia": [
        {
          "model": "t4",
          "ram": "16Gi",
          "interface": "PCIe",
          "allocatable": 1,
          "allocated": 0
        },
        {
          "model": "rtx3060ti",
          "ram": "8Gi",
          "interface": "PCIe",
          "allocatable": 1,
          "allocated": 0
        }
      ]
    }
  }
}
```

### Query parameters for filtering

---

| Param       | Description                                                                                                                                |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| provider    | Either a provider address (ex: `akash175llqyjvxfle9qwt740vm46772dzaznpzgm576`) or a host uri (ex: `https://provider.akashprovid.com:8443`) |
| vendor      | Ex: `nvidia`                                                                                                                               |
| model       | Ex: `t4`                                                                                                                                   |
| memory_size | Ex: `16Gi`                                                                                                                                 |

All query parameters can be combined, ex:
`https://api.console.akash.network/internal/gpu?provider=akash175llqyjvxfle9qwt740vm46772dzaznpzgm576&vendor=nvidia&model=rtx3060ti&memory_size=8Gi`

## Provider Versions

Url: https://api.console.akash.network/internal/provider-versions

Returns a list of versions and the providers that are currently on that version. The `<UNKNOWN>` version corresponds to providers where the version could not be determined. The `/version` endpoint was broken for a long time, but is now fixed in [v0.5.0-rc11](https://github.com/akash-network/provider/releases/tag/v0.5.0-rc11)

### Example Response

```
{
  "0.5.0-rc16": {
    "version": "0.5.0-rc16",
    "count": 4,
    "ratio": 0.05,
    "providers": [
      "https://provider.moonbys.cloud:8443",
      "https://provider.akashprovid.com:8443",
      "https://provider.akashtesting.xyz:8443"
    ]
  },
  "0.5.0-rc15": {
    "version": "0.5.0-rc16",
    "count": 4,
    "ratio": 0.05,
    "providers": [
      "https://provider.akash.pro:8443"
    ]
  },
  "<UNKNOWN>": {
    "version": "<UNKNOWN>",
    "count": 80,
    "ratio": 0.95,
    "providers": [
      "https://provider.macptrading.com:8443",
      "https://provider.digitaler-friedhof.com:8443",
      "https://provider.qioi.io:8443",
      "https://provider.bluepeer.io:8443",
      ...
    ]
  }
}
```
