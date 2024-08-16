"use client";
import React from "react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@akashnetwork/ui/components";

import Layout from "@src/components/layout/Layout";
import { domainName, UrlService } from "@src/utils/urlUtils";
import { Title } from "@src/components/shared/Title";
import { DashboardCharts } from "@src/components/dashboard-charts/dashboard-charts";

const GetStarted: React.FunctionComponent = () => {
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
            <CardHeader className="pb-2">
              <div className="text-xs font-bold">Total Paid 24H</div>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <div className="grid grid-cols-3 gap-2">
                <div className="">
                  <div className="text-xl font-bold">$2555.0</div>
                  <div className="text-sm">3.35%</div>
                </div>
                <div className="col-span-2 place-self-center">
                  <div className="">
                    <DashboardCharts />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="text-sm">Total Paid 7D</div>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <div className="grid grid-cols-2 gap-4">
                <div className="">
                  <div className="text-lg font-bold">$10K.0</div>
                  <div className="text-sm">3.35%</div>
                </div>
                <div className="">Graph here</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <div className="text-sm">Active Leases</div>
            </CardHeader>
            <CardContent className="pb-4 pt-0">
              <div className="grid grid-cols-2 gap-4">
                <div className="">
                  <div className="text-lg font-bold">15</div>
                  <div className="text-sm">3.35%</div>
                </div>
                <div className="">Graph here</div>
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
      </div>
    </Layout>
  );
};

export default GetStarted;
