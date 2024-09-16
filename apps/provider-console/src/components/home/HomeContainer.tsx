"use client";
import React, { ReactNode } from "react";

import { Footer } from "@src/components/layout/Footer";
import Layout from "../layout/Layout";
import { Title } from "../shared/Title";
import { Button, Tabs, TabsList, TabsTrigger } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";

export enum DashboardTabs {
  STATS = "STATS",
  LEASESUMMARY = "LEASESUMMARY"
}

type Props = {
  page: DashboardTabs;
  children?: ReactNode;
  title: string;
  headerActions?: ReactNode;
};

export const HomeContainer: React.FunctionComponent<Props> = ({ children, page, title, headerActions }) => {
  return (
    <div>
      <div className="flex items-center">
        <div className="w-10 flex-1">
          <Title>Dashboard</Title>
        </div>
        <div className="flex-end text-center md:h-auto">
          <Button variant="outline" className="md:h-auto">
            AKT Current Price: $2.68
          </Button>
        </div>
        <div className="flex-end mx-auto ml-2">
          <Button variant="outline" className="md:h-auto">
            13 June 2023 - 14 July 2024
          </Button>
        </div>
        <div className="flex-end ml-2 md:h-auto">
          <Button className="md:h-auto" variant="black">
            Download
          </Button>
        </div>
      </div>
      <div className="mt-4 flex items-center">
        <div className="w-14 flex-1">
          <Tabs className="w-15">
            <TabsList>
              <TabsTrigger value={DashboardTabs.STATS} className={cn({ ["font-bold"]: page === DashboardTabs.STATS })}>
                Stats
              </TabsTrigger>
              <TabsTrigger value={DashboardTabs.LEASESUMMARY} className={cn({ ["font-bold"]: page === DashboardTabs.STATS })}>
                Lease Summary
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
    </div>
  );
};
