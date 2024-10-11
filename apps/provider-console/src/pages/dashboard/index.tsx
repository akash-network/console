"use client";
import React, { useEffect, useState } from "react";
import { Button, Card, CardContent, CardHeader, Separator } from "@akashnetwork/ui/components";

import Layout from "@src/components/layout/Layout";
import { Title } from "@src/components/shared/Title";
import { DashboardCharts } from "@src/components/dashboard/stat-charts";
import { ProviderProcess } from "@src/components/become-provider/ProviderProcess";
import restClient from "@src/utils/restClient";
import ProviderActionList from "@src/components/shared/ProviderActionList";

const GetStarted: React.FunctionComponent = () => {
  const [providerActions, setProviderActions] = useState<any>([]);
  useEffect(() => {
    // get provider actions
    fetchProviderActions();
  }, []);

  const fetchProviderActions = async () => {
    const response: any = await restClient.get("/actions");
    setProviderActions(response.actions);
  };

  return (
    <Layout>
      <div className="flex items-center">
        <div className="w-10 flex-1">
          <Title>Dashboard</Title>
        </div>
        <div className="flex-end text-center md:h-auto">
          <Button variant="outline" className="md:h-auto">
            AKT Current Price: $2.68
          </Button>
        </div>
      </div>
      <div className="mt-10">
        <div className="text-sm">Provider Summary</div>
        <div className="mt-2 grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="rounded-lg p-6 shadow-md">
              <div className="grid grid-cols-3 gap-4">
                <div className="">
                  <div className="text-sm font-medium">Total Paid 24H</div>
                  <div className="text-2xl font-semibold">$2555.0</div>
                  <div className="mt-1 text-sm font-medium text-green-500">+3.35%</div>
                </div>
                <div className="col-span-2 flex items-center justify-end">
                  <div className="w-full overflow-hidden">
                    <DashboardCharts data={[15, 0, 25, 0, 45, 70]} labels={["Mon", "Tue", "Wed", "Thu", "Fri"]} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="rounded-lg p-6 shadow-md">
              <div className="grid grid-cols-3 gap-4">
                <div className="">
                  <div className="text-sm font-medium">Total Paid 7D</div>
                  <div className="text-2xl font-semibold">$7354.0</div>
                  <div className="mt-1 text-sm font-medium">+7.35%</div>
                </div>
                <div className="col-span-2 flex items-center justify-end">
                  <div className="w-full overflow-hidden">
                    <DashboardCharts data={[25, 65, 30, 45, 80]} labels={["Mon", "Tue", "Wed", "Thu", "Fri"]} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="rounded-lg p-6 shadow-md">
              <div className="grid grid-cols-3 gap-4">
                <div className="">
                  <div className="text-sm font-medium">Total Leases</div>
                  <div className="text-2xl font-semibold">18</div>
                  <div className="mt-1 text-sm font-medium">+5.70%</div>
                </div>
                <div className="col-span-2 flex items-center justify-end">
                  <div className="w-full overflow-hidden">
                    <DashboardCharts data={[10, 34, 20, 60, 75]} labels={["Mon", "Tue", "Wed", "Thu", "Fri"]} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <div className="mt-8">
        <div className="text-sm">Resources Leased Summary</div>
        <div className="mt-2 grid grid-cols-5 gap-4">
          <Card>
            <CardHeader>
              <div className="text-sm">CPUs</div>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <div className="grid grid-cols-2 gap-4">
                <div className="">
                  <div className="text-lg font-bold">24</div>
                  <div className="text-sm">5.35%</div>
                </div>
                <div className="">Graph here</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="text-sm">GPUs</div>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <div className="grid grid-cols-2 gap-4">
                <div className="">
                  <div className="text-lg font-bold">8</div>
                  <div className="text-sm">5.35%</div>
                </div>
                <div className="">Graph here</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="text-sm">Memory</div>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <div className="grid grid-cols-2 gap-4">
                <div className="">
                  <div className="text-lg font-bold">156GB</div>
                  <div className="text-sm">5.35%</div>
                </div>
                <div className="">Graph here</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="text-sm">Storage</div>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <div className="grid grid-cols-2 gap-4">
                <div className="">
                  <div className="text-lg font-bold">2.4T</div>
                  <div className="text-sm">5.35%</div>
                </div>
                <div className="">Graph here</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="text-sm">Persistent Storage</div>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <div className="grid grid-cols-2 gap-4">
                <div className="">
                  <div className="text-lg font-bold">1T</div>
                  <div className="text-sm">2.5%</div>
                </div>
                <div className="">Graph here</div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      <div className="mt-8">
        <div className="text-sm">Spent Assets Summary</div>
        <div className="mt-2 grid grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <div className="text-sm">AKT Spent</div>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <div className="grid grid-cols-2 gap-4">
                <div className="">
                  <div className="text-lg font-bold">$2555.0</div>
                  <div className="text-sm">3.35%</div>
                </div>
                <div className="">Graph here</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>Total Paid</CardHeader>
            <CardContent className="pb-4 pt-0">$2555.0</CardContent>
          </Card>
          <Card>
            <CardHeader>Total Paid</CardHeader>
            <CardContent className="pb-4 pt-0">$2555.0</CardContent>
          </Card>
        </div>
        {providerActions.length > 0 && (
          <>
            <Separator className="my-4" />
            <div className="mt-2">
              <div className="text-sm">Provider Activity</div>
              <ProviderActionList actions={providerActions} />
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default GetStarted;
