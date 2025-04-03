import type { z } from "zod";

import type { providerAttributesFormValuesSchema } from "@src/types/providerAttributes";

export const defaultProviderAttributes: z.infer<typeof providerAttributesFormValuesSchema> = {
  "host-uri": "",
  email: "",
  host: "",
  organization: "",
  website: "",
  "status-page": "",
  "location-region": "",
  country: "",
  city: "",
  timezone: "",
  "location-type": "",
  "hosting-provider": "",
  "hardware-cpu": "",
  "hardware-cpu-arch": "",
  "hardware-gpu": "",
  "hardware-gpu-model": [],
  "hardware-disk": [],
  "hardware-memory": "",
  "network-provider": "",
  "network-speed-up": 0,
  "network-speed-down": 0,
  "feat-persistent-storage": false,
  "feat-persistent-storage-type": [],
  tier: "",
  "workload-support-chia": false,
  "workload-support-chia-capabilities": [],
  "feat-endpoint-ip": false,
  "feat-endpoint-custom-domain": false,
  "unknown-attributes": []
};
