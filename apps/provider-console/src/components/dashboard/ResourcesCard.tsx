import { useMemo } from "react";
import { Card, CardContent, CardHeader } from "@akashnetwork/ui/components";

import { formatBytes } from "@src/utils/formatBytes";
import { StatPieChart } from "./StatPieChart";

interface ResourceSummaryInput {
  active?: number;
  pending?: number;
  available?: number;
  isBytes?: boolean;
}

const summarizeStatuses = ({
  active = 0,
  pending = 0,
  available = 0,
  isBytes = false
}: ResourceSummaryInput) => {
  const total = active + pending + available;
  if (total === 0) return null;

  const formatValue = (value: number) => {
    if (isBytes) return formatBytes(value);
    return Number.isInteger(value) ? value : value.toFixed(2);
  };

  const activePercentage = (active / total) * 100;
  const pendingPercentage = (pending / total) * 100;
  const availablePercentage = (available / total) * 100;

  return {
    active: formatValue(active),
    activePercentage,
    pending: formatValue(pending),
    pendingPercentage,
    available: formatValue(available),
    availablePercentage,
    total: formatValue(total)
  };
};

export const RenderResourceCard: React.FC<{
  title: string;
  active: number | string;
  activePercentage: number;
  pending: number | string;
  pendingPercentage: number;
  available: number | string;
  availablePercentage: number;
  total: number | string;
}> = ({ title, active, activePercentage, pendingPercentage, availablePercentage, total }) => (
  <Card>
    <CardHeader>
      <div className="text-sm">{title}</div>
    </CardHeader>
    <CardContent className="pb-4 pt-0">
      <div className="grid grid-cols-3 gap-2">
        <div className="">
          <div className="whitespace-nowrap text-lg font-bold">{active}</div>
          <div className="whitespace-nowrap text-xs text-gray-500">/{total}</div>
        </div>
        <div className="col-span-2 flex items-center justify-end">
          <div className="w-full overflow-hidden">
            <StatPieChart activeResources={activePercentage} pendingResources={pendingPercentage} availableResources={availablePercentage} />
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
);

export const ResourceCards = ({ providerDetails }: { providerDetails: any }) => {
  const resources = useMemo(() => [
    {
      title: "CPUs",
      data: providerDetails?.activeStats?.cpu || providerDetails?.pendingStats?.cpu || providerDetails?.availableStats?.cpu
        ? summarizeStatuses({
            active: (providerDetails?.activeStats?.cpu ?? 0) / 1000,
            pending: (providerDetails?.pendingStats?.cpu ?? 0) / 1000,
            available: (providerDetails?.availableStats?.cpu ?? 0) / 1000
          })
        : null
    },
    {
      title: "GPUs",
      data: summarizeStatuses({
        active: providerDetails?.activeStats?.gpu,
        pending: providerDetails?.pendingStats?.gpu,
        available: providerDetails?.availableStats?.gpu
      })
    },
    {
      title: "Memory",
      data: summarizeStatuses({
        active: providerDetails?.activeStats?.memory,
        pending: providerDetails?.pendingStats?.memory,
        available: providerDetails?.availableStats?.memory,
        isBytes: true
      })
    },
    {
      title: "Storage",
      data: summarizeStatuses({
        active: providerDetails?.activeStats?.storage,
        pending: providerDetails?.pendingStats?.storage,
        available: providerDetails?.availableStats?.storage,
        isBytes: true
      })
    }
  ], [providerDetails]);

  const validResources = resources.filter(resource => resource.data !== null);

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {validResources.map(({ title, data }: { title: string; data: any }) => (
        <RenderResourceCard
          key={title}
          title={title}
          active={data.active ?? 0}
          activePercentage={data.activePercentage ?? 0}
          pending={data.pending ?? 0}
          pendingPercentage={data.pendingPercentage ?? 0}
          available={data.available ?? 0}
          availablePercentage={data.availablePercentage ?? 0}
          total={data.total ?? 0}
        />
      ))}
    </div>
  );
};
