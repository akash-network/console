import { useState } from "react";
import { Button, Checkbox, Spinner, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@akashnetwork/ui/components";
import { WarningCircle } from "iconoir-react";
import { useRouter } from "next/router";

import { Layout } from "@src/components/layout/Layout";
import { Title } from "@src/components/shared/Title";
import { withAuth } from "@src/components/shared/withAuth";
import { useControlMachine } from "@src/context/ControlMachineProvider";
import { useSelectedChain } from "@src/context/CustomChainProvider";
import { usePersistentStorage, useProviderDetails } from "@src/queries/useProviderQuery";
import restClient from "@src/utils/restClient";
import { sanitizeMachineAccess } from "@src/utils/sanityUtils";
import { formatBytes } from "@src/utils/formatBytes";

const PersistentStoragePage: React.FC = () => {
  const router = useRouter();
  const { activeControlMachine } = useControlMachine();
  const { data: persistentDrives }: any = usePersistentStorage(activeControlMachine);
  const { address }: any = useSelectedChain();
  const { data: providerDetails }: any = useProviderDetails(address);

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
          router.push(`/actions/${pstorageResponse.action_id}`);
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
      <div className="flex items-center">
        <div className="w-10 flex-1">
          <Title>Persistent Storage</Title>
          {providerDetails && !providerDetails.featPersistentStorage && (
            <div className="mt-2 rounded-md bg-yellow-50 p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <WarningCircle color="black" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-yellow-700">Persistent Storage is not enabled</p>
                </div>
              </div>
            </div>
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

export default withAuth(PersistentStoragePage);
