# Provider Attributes Schema

| Field                        | Type                | Required | Description                                                                                                                           | Values                                                                                                                            |
| ---------------------------- | ------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| host                         | string              | true     | Name of the host. Ex.: 'd3akash.cloud'.                                                                                              |                                                                                                                                   |
| email                        | string              | true     | Email associated with the provider.                                                                                                  |                                                                                                                                   |
| discord-username             | string              | false    | Discord username for provider contact. **Required for audited providers**; you must be in the [Akash Discord](https://discord.gg/akash) with the Provider role. |                                                                                                                                   |
| organization                 | string              | true     | Name of the organization that owns the provider.                                                                                     |                                                                                                                                   |
| website                      | string              | false    | Link to the organization's website.                                                                                                  |                                                                                                                                   |
| status-page                  | string              | false    | Link to a status page for the provider.                                                                                              |                                                                                                                                   |
| location-region              | option              | true     | Geo location region of the provider. **Required key: `location-region`** (the legacy `region` key is not supported). [UN Geoscheme](https://en.wikipedia.org/wiki/United_Nations_geoscheme) | See [Location Region Values](#location-region-values)                                                                                               |
| country                      | string              | false    | Country ISO 3166 Alpha-2 code of the provider. [ISO 3166 Country Codes](https://en.wikipedia.org/wiki/List_of_ISO_3166_country_codes)   |                                                                                                                                   |
| city                         | string              | false    | City 3 letter code of the provider. [Harbor Code](https://www.hh-express.com/en/support/three_code/harbor.html)                       |                                                                                                                                   |
| timezone                     | option              | false    | Timezone UTC-12 to UTC+14 of the provider. [Timezone Map](https://www.timeanddate.com/time/map/)                                      | See [Timezone Values](#timezone-values)                                                                                                           |
| location-type                | option              | false    | One of: datacenter, colo, home, office, mix.                                                                                         | datacenter, colo, home, office, mix                                                                                            |
| hosting-provider             | string              | false    | Name of the datacenter, colo, public cloud, etc where hosted.                                                                        |                                                                                                                                   |
| hardware-cpu                 | option              | true     | CPU manufacturer.                                                                                                                     | intel, amd, arm                                                                                                                  |
| hardware-cpu-arch            | option              | false    | CPU architecture.                                                                                                                     | x86, x86-64, arm, arm-64                                                                                                         |
| hardware-gpu                 | option              | false    | GPU manufacturer.                                                                                                                     | nvidia, amd, intel, xilinx                                                                                                       |
| hardware-gpu-model           | multiple-option     | false    | GPU model. Synced from [provider-configs/devices/pcie/gpus.json](https://github.com/akash-network/provider-configs/blob/main/devices/pcie/gpus.json). | AMD mi100, AMD mi60, Nvidia a100, ... |
| hardware-gpu-capability      | multiple-option     | false    | GPU capability keys (model, RAM, interface). Synced from provider-configs. | Per-model RAM/interface keys |
| hardware-persistent-storage-class | option         | false    | Primary persistent storage class on `capabilities/storage/1/class`. | beta1 (HDD), beta2 (SSD), beta3 (NVMe) |
| hardware-persistent-storage-capability | boolean  | false    | Persistent storage on storage class 1 (`capabilities/storage/1/persistent`). | |
| hardware-cuda                | string              | false    | CUDA version on GPU nodes (for example 12.7). | |
| datacenter                   | string              | false    | Provider datacenter or site identifier. | |
| hardware-memory              | option              | true     | Memory (RAM) type.                                                                                                                    | ddr2, ddr3, ddr3ecc, ddr4, ddr4ecc, ddr5, ddr5ecc                                                                                 |
| network-provider             | string              | false    | Internet service provider.                                                                                                            |                                                                                                                                   |
| network-speed-up             | number              | false    | Upload Bandwidth in mbps.                                                                                                            |                                                                                                                                   |
| network-speed-down           | number              | false    | Download Bandwidth in mbps.                                                                                                          |                                                                                                                                   |
| feat-persistent-storage       | boolean             | true     | True if the provider offers persistent storage (legacy flag; also use storage class 1 capability keys).                               |                                                                                                                                   |
| feat-shm                      | boolean             | false    | True if the provider offers shared memory (SHM) via the ram storage class.                                                           |                                                                                                                                   |
| hardware-shm                  | multiple-option     | false    | On-chain SHM capability keys (`capabilities/storage/2/class=ram`, `capabilities/storage/2/persistent=false`).                      | SHM storage class, SHM non-persistent                                                                                            |
| tier                         | option              | false    | Is this an Akash hosted provider or community hosted?                                                                               | akash, community                                                                                                                 |
| feat-endpoint-ip             | boolean             | false    | Does this provider support leasing of IP addresses?                                                                                  |                                                                                                                                   |
| feat-endpoint-custom-domain   | boolean             | false    | Does this provider support custom domains?                                                                                           |                                                                                                                                   |

## Location Region Values

| Value         | Description                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------- |
| na-ca-west    | North America Canada West coast. Provinces: (BC).                                                             |
| na-ca-central | North America Canada Central. Provinces: (QC, ON).                                                            |
| na-ca-prairie | North America Canada Prairie. Provinces: (AB, SK, MB).                                                        |
| na-ca-atlantic| North America Canada Atlantic. Provinces: (NL, PE, NS, NB).                                                   |
| na-ca-north   | North America Canada North. Provinces: (NU, NT, YT).                                                          |
| na-us-west    | North America United States of America West. States: (CA, OR, WA, ID, MT, WY, UT, CO, NV, AK, HI).            |
| na-us-southwest | North America United States of America Southwest. States: (AZ, NM, TX, OK).                                 |
| na-us-midwest | North America United States of America Midwest. States: (ND, SD, NE, KS, MN, IA, MO, WI, IL, MI, IN, OH).     |
| na-us-southeast | North America United States of America Southeast. States: (AR, LA, MS, AL, TN, KY, WV, VA, NC, SC, GA, FL). |
| na-us-northeast | North America United States of America Northeast. States: (PA, NY, VT, NH, ME, MA, RI, CT, NJ, DE, MD).     |
| central-america | Central America. Countries: (BZ, CR, SV, GT, HN, NI, PA).                                                   |
| caribbean     | Caribbean. Countries: (AI, AG, AW, BS, BB, BQ, VG, KY, CU, CW, DM, DO, GD, GP, HT, JM, MQ, MS, VE, PR, BQ, BL, KN, LC, MF, VC, SX, TT, TC, VI). |
| sa-north      | South America North. Countries: (CO, VE, GY, SR, GF).                                                         |
| sa-west      | South America West. Countries: (PE, EC, BO).                                                                   |
| sa-south      | South America South. Countries: (AR, UY, CL, PY).                                                             |
| sa-brazil      | South America Brazil.                                                                                        |
| eu-central      | Central Europe. Countries (SI, HU, SK, PL, CZ, AT, CH, DE).                                                 |
| eu-east      | Eastern Europe. Countries (MD, UA, BY, LT, LV, EE, RU).                                                        |
| eu-north      | Northern Europe. Countries (DK, SE, NO, FI, IS).                                                              |
| eu-southeast      | South-eastern Europe. Countries (AL, MK, BG, RO, RS, XK, ME, BA, HR).                                     |
| eu-south      | Southern Europe. Countries (IT, GR).                                                                          |
| eu-southwest      | South-western Europe. Countries (PT, ES, AD).                                                             |
| eu-west      | Western Europe. Countries (FR, LU, BE, NL, GB, IE).                                                            |
| af-east      | Eastern Africa. Countries (MZ, ZW, ZM, MW, TZ, BI, RW, KE, UG, SO, ET, DJ, ER, SS).                            |
| af-middle      | Middle Africa. Countries (TD, CF, CM, GQ, GA, CG, CD, AO).                                                   |
| af-north      | Northern Africa. Countries (EH, MA, DZ, TN, LY, EG, SD).                                                      |
| af-south      | Southern Africa. Countries (NA, BW, ZA, LS, SZ).                                                              |
| af-west      | Western Africa. Countries (MR, ML, NE, NG, BJ, TG, GH, BF, CI, LR, GN, SL, GW, GM, SN).                        |
| as-central      | Central Asia. Countries (KZ, KG, TJ, TM, UZ).                                                               |
| as-east      | Eastern Asia. Countries (CN, JP, KP, KR, MN, HK, MO, TW).                                                      |
| as-southeast      | South-eastern Asia. Countries (MM, LA, TH, VN, KH, MY, SG, ID, TL, PH).                                   |
| as-south      | Southern Asia. Countries (IR, AF, PK, IN, BD, BT, NP, LK, MV).                                                |
| as-west      | Western Asia. Countries (TR, GE, AM, AZ, SY, LB, JO, IL, IQ, KW, SA, YE, OM, AE, QA, BH, CY, PS).              |
| oc-aus      | Oceania Australia. Countries (AU).                                                                              |
| oc-nz      | Oceania New Zealand. Countries (NZ).                                                                             |
| oc-mel      | Oceania Melanesia. Countries (PG, NR, SB, VU, NC, FJ).                                                          |
| oc-mic      | Oceania Micronesia. Countries (PW, MP, GU, FM, MH, KI).                                                         |
| oc-pol      | Oceania Polynesia. Countries (TV, WF, TK, AS, TO, NU, CK, PF, PN).                                              |

## Timezone Values

| Value     | Description |
| --------- | ----------- |
| utc-12    | UTC-12      |
| utc-11    | UTC-11      |
| utc-10    | UTC-10      |
| utc-9     | UTC-9       |
| utc-8     | UTC-8       |
| utc-7     | UTC-7       |
| utc-6     | UTC-6       |
| utc-5     | UTC-5       |
| utc-4     | UTC-4       |
| utc-3     | UTC-3       |
| utc-2     | UTC-2       |
| utc-1     | UTC-1       |
| utc+0     | UTC+0       |
| utc+1     | UTC+1       |
| utc+2     | UTC+2       |
| utc+3     | UTC+3       |
| utc+4     | UTC+4       |
| utc+5     | UTC+5       |
| utc+6     | UTC+6       |
| utc+7     | UTC+7       |
| utc+8     | UTC+8       |
| utc+9     | UTC+9       |
| utc+10    | UTC+10      |
| utc+11    | UTC+11      |
| utc+12    | UTC+12      |
| utc+13    | UTC+13      |
| utc+14    | UTC+14      |
