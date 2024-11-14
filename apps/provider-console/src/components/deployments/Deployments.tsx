import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import consoleClient from "@src/utils/consoleClient";
import { useWallet } from "@src/context/WalletProvider";
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
  TableCell,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  CustomPagination,
  Separator
} from "@akashnetwork/ui/components";
import { Spinner } from "@akashnetwork/ui/components";
import { useRouter } from "next/router";

import { useWallet } from "@src/context/WalletProvider";
import { useProviderDeployments } from "@src/queries/useProviderQuery";
import { formatBytes } from "@src/utils/formatBytes";
import { uaktToAKT } from "@src/utils/priceUtils";
import { formatBytes } from "@src/utils/formatBytes";
import { Spinner } from "@akashnetwork/ui/components";

interface Deployment {
  owner: string;
  dseq: string;
  denom: string;
  createdDate: string;
  status: string;
  balance: number;
  resources: {
    cpu: number;
    memory: number;
    gpu: number;
    ephemeralStorage: number;
    persistentStorage: number;
  };
  amountSpent: number;
  costPerMonth: number;
}

const Deployments: React.FC = () => {
  const router = useRouter();
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [total, setTotal] = useState<number>(0);
  const { address } = useWallet();
  const [status, setStatus] = useState<string>("active");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [pageCount, setPageCount] = useState<number>(0);

  const { data, isLoading: isDeploymentsLoading } = useProviderDeployments(address, status, currentPage, pageSize);

  useEffect(() => {
    if (data) {
      setDeployments(data.deployments);
      setTotal(data.total);
    }
  }, [data]);

  useEffect(() => {
    setPageCount(Math.ceil(total / pageSize));
  }, [total, pageSize]);

  const handleChangePage = (newPage: number) => {
    setCurrentPage(newPage + 1); // CustomPagination uses 0-based index
  };

  const onPageSizeChange = (newPageSize: number) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // Reset to first page when changing page size
  };

  const handleRowClick = (owner, dseq: string) => {
    router.push(`/deployments/${owner}/${dseq}`);
  };

  const DeploymentTable = () => (
    <div className="min-h-[578px]">
      {isDeploymentsLoading ? (
        <div className="flex h-64 flex-col items-center justify-center">
          <Spinner className="mb-2 h-8 w-8" />
          <div>Loading deployments...</div>
        </div>
      ) : deployments.length > 0 ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[10%] font-bold">Owner</TableHead>
              <TableHead className="w-[15%] font-bold">DSEQ</TableHead>
              <TableHead className="w-[15%] font-bold">Spent</TableHead>
              <TableHead className="w-[15%] font-bold">Monthly Cost</TableHead>
              <TableHead className="w-[5%] font-bold">GPUs</TableHead>
              <TableHead className="w-[5%] font-bold">CPUs</TableHead>
              <TableHead className="w-[10%] font-bold">Memory</TableHead>
              <TableHead className="w-[10%] font-bold">E. Disk</TableHead>
              <TableHead className="w-[10%] font-bold">P. Disk</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {deployments.map(deployment => (
              <TableRow
                key={deployment.dseq}
                className="provider-list-row hover:bg-muted-foreground/10 cursor-pointer p-4"
                onClick={() => handleRowClick(deployment.owner, deployment.dseq)}
              >
                <TableCell>
                  <span className="text-xs">{deployment.owner}</span>
                </TableCell>
                <TableCell className="">
                  <span className="text-xs">{deployment.dseq}</span>
                </TableCell>
                <TableCell className="">
                  <span className="text-xs">{uaktToAKT(deployment.amountSpent)} AKT</span>
                </TableCell>
                <TableCell className="">
                  <span className="text-xs">{uaktToAKT(deployment.costPerMonth)} AKT</span>
                </TableCell>
                <TableCell className="">
                  <span className="text-xs">{deployment.resources.gpu}</span>
                </TableCell>
                <TableCell className="">
                  <span className="text-xs">{deployment.resources.cpu / 1000}</span>
                </TableCell>
                <TableCell className="">
                  <span className="text-xs">{formatBytes(deployment.resources.memory)}</span>
                </TableCell>
                <TableCell className="">
                  <span className="text-xs">{formatBytes(deployment.resources.ephemeralStorage)}</span>
                </TableCell>
                <TableCell className="text-center">
                  <span className="text-xs">{formatBytes(deployment.resources.persistentStorage)}</span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <div className="py-8 text-center">No {status} deployments found.</div>
      )}
    </div>
  );

  return (
    <div className="">
      <h2 className="mb-4 text-lg font-bold">Total Deployments: {total}</h2>
      <Tabs defaultValue="active" onValueChange={setStatus} className="w-full">
        <TabsList className="grid w-72 grid-cols-2">
          <TabsTrigger value="active">Active</TabsTrigger>
          <TabsTrigger value="closed">Inactive</TabsTrigger>
        </TabsList>
        <TabsContent value="active">
          <DeploymentTable />
        </TabsContent>
        <TabsContent value="closed">
          <DeploymentTable />
        </TabsContent>
      </Tabs>
      <Separator className="mt-4" />
      <div className="mt-4 flex justify-center">
        <CustomPagination
          pageSize={pageSize}
          setPageIndex={handleChangePage}
          pageIndex={currentPage - 1} // CustomPagination uses 0-based index
          totalPageCount={pageCount}
          setPageSize={onPageSizeChange}
        />
      </div>
    </div>
  );
};

export default Deployments;
