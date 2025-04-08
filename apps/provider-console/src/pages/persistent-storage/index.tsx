import { useState } from "react";
import { Button, Checkbox, Spinner, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@akashnetwork/ui/components";
import { useRouter } from "next/router";

import { Layout } from "@src/components/layout/Layout";
import { ControlMachineError } from "@src/components/shared/ControlMachineError";
import { Title } from "@src/components/shared/Title";
import { withAuth } from "@src/components/shared/withAuth";
import { useControlMachine } from "@src/context/ControlMachineProvider";
import { useSelectedChain } from "@src/context/CustomChainProvider";
import { usePersistentStorage, useProviderDetails } from "@src/queries/useProviderQuery";
import { formatBytes } from "@src/utils/formatBytes";
import restClient from "@src/utils/restClient";
import { sanitizeMachineAccess } from "@src/utils/sanityUtils";

const PersistentStoragePage: React.FC = () => {
  const router = useRouter();
  const { activeControlMachine } = useControlMachine();
  const { address } = useSelectedChain();
  const { data: providerDetails } = useProviderDetails(address);

  const isPersistentStorageEnabled = providerDetails?.stats?.storage?.persistent?.available !== 0;
  const { data: persistentDrives, refetch } = usePersistentStorage(isPersistentStorageEnabled ? null : activeControlMachine);

  const [selectedDrives, setSelectedDrives] = useState<{ [key: string]: string[] }>({});
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const [loading, setLoading] = useState<boolean>(false);

  const handleDriveSelection = (nodeName: string, driveName: string, driveType: string) => {
    setSelectedDrives(prev => {
      const nodeDrivers = prev[nodeName] || [];
      const alreadySelected = nodeDrivers.includes(driveName);

      if (alreadySelected) {
        const updatedSelectedDrives = {
          ...prev,
          [nodeName]: nodeDrivers.filter(d => d !== driveName)
        };

        const isEmpty = Object.values(updatedSelectedDrives).every(drives => drives.length === 0);
        if (isEmpty) setSelectedType(null);

        return updatedSelectedDrives;
      }

      if (!selectedType) {
        setSelectedType(driveType);
      } else if (selectedType !== driveType) {
        return prev;
      }

      return {
        ...prev,
        [nodeName]: [...nodeDrivers, driveName]
      };
    });
  };

  const handleEnablePersistentStorage = async () => {
    setLoading(true);
    try {
      const getStorageClass = (type: string) => {
        switch (type) {
          case "nvme":
            return "beta3";
          case "ssd":
            return "beta2";
          case "hdd":
            return "beta1";
          default:
            return "";
        }
      };
      const storageClass = selectedType ? getStorageClass(selectedType) : "";

      const payload = {
        control_machine: sanitizeMachineAccess(activeControlMachine),
        storage_info: {
          storage_class: storageClass,
          nodes: Object.entries(selectedDrives).map(([nodeName, drives]) => ({
            node: nodeName,
            drives: drives.map(drive => ({
              device: drive
            }))
          }))
        }
      };

      const pstorageResponse: any = await restClient.post("/persistent-storage", payload);

      if (pstorageResponse) {
        if (pstorageResponse.action_id) {
          router.push(`/activity-logs/${pstorageResponse.action_id}`);
        }
      }
    } catch (error) {
      console.log(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <ControlMachineError activity="persistent storage" />
      <div className="flex items-center pt-5">
        <div className="w-10 flex-1">
          <Title>Persistent Storage</Title>
          <p className="text-muted-foreground text-sm">Enable persistent storage to start accepting deployments with persistent storage.</p>
          {providerDetails && providerDetails?.stats?.storage?.persistent?.available !== 0 && (
            <>
              <div className="mt-2">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  <div className="bg-card text-card-foreground rounded-lg border shadow-sm">
                    <div className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="text-muted-foreground text-sm font-medium">Available Storage</p>
                          <div className="text-2xl font-bold">{formatBytes(providerDetails?.stats?.storage?.persistent?.available ?? 0)}</div>
                        </div>
                        <div className="h-16 w-16">
                          <svg className="h-full w-full" viewBox="0 0 100 100">
                            <circle className="text-muted-foreground/20 stroke-current" strokeWidth="12" cx="50" cy="50" r="40" fill="transparent" />
                            <circle
                              className="stroke-current text-emerald-500"
                              strokeWidth="12"
                              strokeLinecap="round"
                              cx="50"
                              cy="50"
                              r="40"
                              fill="transparent"
                              strokeDasharray={`${(providerDetails?.stats?.storage?.persistent?.available / (providerDetails?.stats?.storage?.persistent?.available + providerDetails?.stats?.storage?.persistent?.active)) * 251.2} 251.2`}
                              transform="rotate(-90 50 50)"
                            />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-card text-card-foreground rounded-lg border shadow-sm">
                    <div className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <p className="text-muted-foreground text-sm font-medium">Active Storage</p>
                          <div className="text-2xl font-bold">{formatBytes(providerDetails.stats.storage.persistent.active)}</div>
                        </div>
                        <div className="h-16 w-16">
                          <svg className="h-full w-full" viewBox="0 0 100 100">
                            <circle className="text-muted-foreground/20 stroke-current" strokeWidth="12" cx="50" cy="50" r="40" fill="transparent" />
                            <circle
                              className="stroke-current text-blue-500"
                              strokeWidth="12"
                              strokeLinecap="round"
                              cx="50"
                              cy="50"
                              r="40"
                              fill="transparent"
                              strokeDasharray={`${(providerDetails.stats.storage.persistent.active / (providerDetails.stats.storage.persistent.available + providerDetails.stats.storage.persistent.active)) * 251.2} 251.2`}
                              transform="rotate(-90 50 50)"
                            />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>

                  {providerDetails.stats.storage.persistent.pending > 0 && (
                    <div className="bg-card text-card-foreground rounded-lg border shadow-sm">
                      <div className="p-6">
                        <div className="flex items-center justify-between">
                          <div className="space-y-1">
                            <p className="text-muted-foreground text-sm font-medium">Pending Storage</p>
                            <div className="text-2xl font-bold">{formatBytes(providerDetails.stats.storage.persistent.pending)}</div>
                          </div>
                          <div className="h-16 w-16">
                            <svg className="h-full w-full" viewBox="0 0 100 100">
                              <circle className="text-muted-foreground/20 stroke-current" strokeWidth="12" cx="50" cy="50" r="40" fill="transparent" />
                              <circle
                                className="stroke-current text-yellow-500"
                                strokeWidth="12"
                                strokeLinecap="round"
                                cx="50"
                                cy="50"
                                r="40"
                                fill="transparent"
                                strokeDasharray={`${(providerDetails.stats.storage.persistent.pending / (providerDetails.stats.storage.persistent.available + providerDetails.stats.storage.persistent.active + providerDetails.stats.storage.persistent.pending)) * 251.2} 251.2`}
                                transform="rotate(-90 50 50)"
                              />
                            </svg>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Button
                onClick={() => {
                  refetch();
                }}
                variant="secondary"
                className="mt-4"
              >
                Refresh Unformatted Drives
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="mt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead>Node</TableHead>
              <TableHead>Drive Name</TableHead>
              <TableHead>Size</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Mount Point</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {persistentDrives?.unformatted_drives &&
              Object.entries(persistentDrives.unformatted_drives).map(([nodeName, nodeData]: [any, any]) =>
                nodeData.blockdevices
                  .filter(device => !device.mountpoint && device.type === "disk")
                  .map(device => {
                    const isDisabled: any = selectedType && selectedType !== device.storage_type;
                    return (
                      <TableRow key={`${nodeName}-${device.name}`}>
                        <TableCell>
                          <Checkbox
                            checked={selectedDrives[nodeName]?.includes(device.name)}
                            onCheckedChange={() => handleDriveSelection(nodeName, device.name, device.storage_type)}
                            disabled={isDisabled}
                          />
                        </TableCell>
                        <TableCell>{nodeName}</TableCell>
                        <TableCell>{device.name}</TableCell>
                        <TableCell>{formatBytes(device.size)}</TableCell>
                        <TableCell>{device.storage_type}</TableCell>
                        <TableCell>{device.mountpoint || "Not mounted"}</TableCell>
                      </TableRow>
                    );
                  })
              )}
          </TableBody>
        </Table>

        <div className="mt-4">
          <Button onClick={handleEnablePersistentStorage} disabled={Object.keys(selectedDrives).length === 0 || loading}>
            {loading ? (
              <>
                <Spinner size="small" className="mr-2" />
                Enabling Persistent Storage...
              </>
            ) : (
              "Enable Persistent Storage"
            )}
          </Button>
        </div>
      </div>
    </Layout>
  );
};

export default withAuth({ WrappedComponent: PersistentStoragePage, authLevel: "provider" });
