import { Card, CardContent, CardHeader } from "@akashnetwork/ui/components";

import { formatBytes } from "@src/utils/formatBytes";
import { StatPieChart } from "./StatPieChart";

const getResourceData = (active: number = 0, pending: number = 0, available: number = 0, isBytes: boolean = false) => {
  const total = active + pending + available;
  if (total === 0) return null;

  const activePercentage = (active / total) * 100;
  const pendingPercentage = (pending / total) * 100;
  const availablePercentage = (available / total) * 100;

  return {
    active: isBytes ? formatBytes(active) : active,
    activePercentage,
    pending: isBytes ? formatBytes(pending) : pending,
    pendingPercentage,
    available: isBytes ? formatBytes(available) : available,
    availablePercentage,
    total: isBytes ? formatBytes(total) : total
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
  console.log(providerDetails);
  const resources = [
    {
      title: "CPUs",
      data:
        providerDetails?.activeStats?.cpu || providerDetails?.pendingStats?.cpu || providerDetails?.availableStats?.cpu
          ? getResourceData(
              (providerDetails?.activeStats?.cpu ?? 0) / 1000,
              (providerDetails?.pendingStats?.cpu ?? 0) / 1000,
              (providerDetails?.availableStats?.cpu ?? 0) / 1000
            )
          : null
    },
    { title: "GPUs", data: getResourceData(providerDetails?.activeStats?.gpu, providerDetails?.pendingStats?.gpu, providerDetails?.availableStats?.gpu) },
    {
      title: "Memory",
      data: getResourceData(providerDetails?.activeStats?.memory, providerDetails?.pendingStats?.memory, providerDetails?.availableStats?.memory, true)
    },
    {
      title: "Storage",
      data: getResourceData(providerDetails?.activeStats?.storage, providerDetails?.pendingStats?.storage, providerDetails?.availableStats?.storage, true)
    }
  ];

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
