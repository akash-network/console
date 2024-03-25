"use client";
import { LabelValue } from "@src/components/shared/LabelValue";
import { Badge } from "@src/components/ui/badge";
import { Card, CardContent } from "@src/components/ui/card";
import { ClientProviderDetailWithStatus } from "@src/types/provider";
import { Check } from "iconoir-react";

// const useStyles = makeStyles()(theme => ({
//   root: {
//     padding: "1rem",
//     display: "grid",
//     gridTemplateColumns: "repeat(2,1fr)",
//     gap: "1rem",
//     [theme.breakpoints.down("sm")]: {
//       gridTemplateColumns: "repeat(1,1fr)"
//     }
//   }
// }));

type Props = {
  provider: ClientProviderDetailWithStatus;
};

export const ProviderSpecs: React.FunctionComponent<Props> = ({ provider }) => {
  return (
    <Card>
      <CardContent className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2">
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
            value={provider.hardwareGpuModels.map(x => (
              <Badge key={x} className="mr-2">
                {x}
              </Badge>
            ))}
          />
          <LabelValue label="CPU Architecture" value={provider.hardwareCpuArch} />
          <LabelValue label="Disk Storage" value={provider.hardwareDisk} />
          <LabelValue label="Persistent Disk Storage" value={provider.featPersistentStorageType} />
          <LabelValue label="Upload speed" value={provider.networkSpeedUp} />
        </div>
      </CardContent>
    </Card>
  );
};
