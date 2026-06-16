"use client";
import { Badge, Card, CardContent } from "@akashnetwork/ui/components";
import { Check } from "iconoir-react";

import { LabelValue } from "@src/components/shared/LabelValue";
import type { ClientProviderDetailWithStatus } from "@src/types/provider";
import { createFilterUnique } from "@src/utils/array";

type Props = {
  provider: ClientProviderDetailWithStatus;
};

export const ProviderSpecs: React.FunctionComponent<Props> = ({ provider }) => {
  const gpuModels =
    provider?.gpuModels
      ?.map(x => x.model + " " + x.ram)
      .filter(createFilterUnique())
      .sort((a, b) => a.localeCompare(b)) || [];

  return (
    <Card>
      <CardContent className="grid grid-cols-1 gap-4 pt-6 sm:grid-cols-2">
        <div>
          <LabelValue label="GPU" value={provider.hardwareGpuVendor || "Unknown"} />
          <LabelValue label="CPU" value={provider.hardwareCpu || "Unknown"} />
          <LabelValue label="Memory (RAM)" value={provider.hardwareMemory || "Unknown"} />
          <LabelValue label="Persistent Storage" value={provider.featPersistentStorage && <Check className="ml-2 text-primary" />} />
          <LabelValue label="Shared Memory (SHM)" value={provider.featShm && <Check className="ml-2 text-primary" />} />
          <LabelValue label="Download speed" value={provider.networkSpeedDown} />
          <LabelValue label="Network Provider" value={provider.networkProvider} />
        </div>

        <div>
          <LabelValue
            label="GPU Models"
            value={gpuModels.map(x => (
              <Badge key={x} className="mr-2">
                {x}
              </Badge>
            ))}
          />
          <LabelValue label="CPU Architecture" value={provider.hardwareCpuArch} />
          <LabelValue label="Persistent Storage Class" value={provider.hardwarePersistentStorageClass || "Unknown"} />
          <LabelValue label="CUDA" value={provider.hardwareCuda || "Unknown"} />
          <LabelValue label="Datacenter" value={provider.datacenter || "Unknown"} />
          <LabelValue label="Upload speed" value={provider.networkSpeedUp} />
        </div>
      </CardContent>
    </Card>
  );
};
