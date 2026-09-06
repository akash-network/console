"use client";
import { Badge, Card, CardContent } from "@akashnetwork/ui/components";
import { Check, WarningCircle } from "iconoir-react";

import { LabelValue } from "@src/components/shared/LabelValue";
import type { ClientProviderDetailWithStatus, CpuArchAgreement } from "@src/types/provider";
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
          <LabelValue label="CPU Architecture (declared)" value={provider.hardwareCpuArch || "Unknown"} />
          <LabelValue
            label="CPU Architecture (reported)"
            value={<ReportedCpuArchitectures archs={provider.reportedCpuArchs ?? []} agreement={provider.cpuArchAgreement} />}
          />
          <LabelValue label="Disk Storage" value={provider.hardwareDisk} />
          <LabelValue label="Persistent Disk Storage" value={provider.featPersistentStorageType} />
          <LabelValue label="Upload speed" value={provider.networkSpeedUp} />
        </div>
      </CardContent>
    </Card>
  );
};

const ReportedCpuArchitectures: React.FunctionComponent<{ archs: string[]; agreement: CpuArchAgreement }> = ({ archs, agreement }) => {
  if (archs.length === 0) return <>Unknown</>;

  return (
    <span className="flex flex-wrap items-center gap-2">
      {archs.map(arch => (
        <Badge key={arch}>{arch}</Badge>
      ))}
      {agreement === "mismatch" && (
        <span className="flex items-center text-xs text-warning">
          <WarningCircle className="mr-1" />
          Differs from the declared architecture
        </span>
      )}
    </span>
  );
};
