import React from "react";
import { Card, CardContent } from "@akashnetwork/ui/components";

import { useDeploymentDetails } from "@src/queries/useProviderQuery";
import { getPrettyTimeFromSeconds } from "@src/utils/dateUtils";
import { formatBytes } from "@src/utils/formatBytes";
import { uaktToAKT } from "@src/utils/priceUtils";

interface DeploymentDetailsProps {
  dseq: string;
  owner: string;
}

export const DeploymentDetails: React.FC<DeploymentDetailsProps> = ({ dseq, owner }) => {
  const { data: deploymentDetails, isLoading, error } = useDeploymentDetails(owner, dseq);

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>Error: {(error as Error).message}</div>;
  }

  if (!deploymentDetails) {
    return <div>No deployment details found</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <span className={`rounded-full px-3 py-1 text-sm ${deploymentDetails.status === "active" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
          {deploymentDetails.status}
        </span>
        <span className="text-sm font-medium">DSEQ: {dseq}</span>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-4">
            <h3 className="mb-2 text-sm text-gray-500">Owner</h3>
            <p className="truncate font-semibold">{owner}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <h3 className="mb-2 text-sm text-gray-500">Created</h3>
            <p className="font-semibold">{new Date(deploymentDetails.createdDate).toLocaleDateString()}</p>
            <p className="text-sm text-gray-500">{new Date(deploymentDetails.createdDate).toLocaleTimeString()}</p>
          </CardContent>
        </Card>
        {(deploymentDetails.closedHeight || deploymentDetails.status === "active") && (
          <Card>
            <CardContent className="p-4">
              <h3 className="mb-2 text-sm text-gray-500">{deploymentDetails.closedHeight ? "Runtime" : "Deployment expires in"}</h3>
              <p className="font-semibold">{getPrettyTimeFromSeconds(deploymentDetails.timeLeft)}</p>
            </CardContent>
          </Card>
        )}
      </div>
      <h2 className="text-lg font-semibold">Finances</h2>
      <div className="grid grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-4">
            <h3 className="mb-2 text-sm text-gray-500">Cost</h3>
            <p className="font-semibold">{uaktToAKT(deploymentDetails.totalMonthlyCostUDenom, 2)} AKT</p>
            <p className="text-sm text-gray-500">/month</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <h3 className="mb-2 text-sm text-gray-500">Amount Spent</h3>
            <p className="font-semibold">{uaktToAKT(deploymentDetails?.amountSpent, 2)} AKT</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <h3 className="mb-2 text-sm text-gray-500">Balance</h3>
            <p className="font-semibold">{uaktToAKT(deploymentDetails.balance, 2)} AKT</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <h3 className="mb-2 text-sm text-gray-500">Transferred</h3>
            <p className="font-semibold">{uaktToAKT(deploymentDetails.other.escrow_account.transferred.amount, 2)} AKT</p>
          </CardContent>
        </Card>
      </div>
      <h2 className="text-lg font-semibold">Resources Deployed</h2>
      {deploymentDetails.leases.map((lease, index) => (
        <React.Fragment key={index}>
          <div className="space-y-6">
            <div className="flex items-center space-x-4">
              <span className="text-sm font-medium">GSEQ: {lease.gseq}</span>
              <span className="text-sm font-medium">OSEQ: {lease.oseq}</span>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-6">
            {lease.gpuUnits > 0 && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="mb-2 text-sm text-gray-500">GPU</h3>
                  <p className="font-semibold">{lease.gpuUnits}</p>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardContent className="p-4">
                <h3 className="mb-2 text-sm text-gray-500">CPU</h3>
                <p className="font-semibold">{lease.cpuUnits / 1000} vcpu</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <h3 className="mb-2 text-sm text-gray-500">Memory</h3>
                <p className="font-semibold">{formatBytes(lease.memoryQuantity)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <h3 className="mb-2 text-sm text-gray-500">Eph. Storage</h3>
                <p className="font-semibold">{formatBytes(lease.storageQuantity)}</p>
              </CardContent>
            </Card>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
};
