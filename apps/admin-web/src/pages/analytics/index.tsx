"use client";
import React from "react";
import { Card, CardContent, CardHeader, CardTitle, Spinner } from "@akashnetwork/ui/components";
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client";
import { Group, PlusCircle, StatsUpSquare } from "iconoir-react";

import { AdminLayout } from "@src/components/layout/AdminLayout";
import { useUserStatsQuery } from "@src/queries/useAnalyticsQuery";

const AnalyticsPage: React.FunctionComponent = () => {
  const { data: stats, isLoading, error } = useUserStatsQuery();

  const formatNumber = (value: number | undefined) => {
    if (value === undefined) return "-";
    return value.toLocaleString();
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Analytics</h2>
          <p className="text-muted-foreground">Overview of Console usage statistics</p>
        </div>

        {error ? (
          <div className="border-destructive/50 bg-destructive/10 rounded-md border p-4">
            <p className="text-destructive text-sm">Failed to load analytics: {error instanceof Error ? error.message : "Unknown error"}</p>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="large" />
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Group className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(stats?.totalUsers)}</div>
                <p className="text-muted-foreground text-xs">All registered users</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">New Users (7 days)</CardTitle>
                <PlusCircle className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(stats?.newUsersLast7Days)}</div>
                <p className="text-muted-foreground text-xs">Registered in the last 7 days</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Users (30 days)</CardTitle>
                <StatsUpSquare className="text-muted-foreground h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(stats?.activeUsersLast30Days)}</div>
                <p className="text-muted-foreground text-xs">Active in the last 30 days</p>
              </CardContent>
            </Card>
          </div>
        )}

        <div className="border-muted rounded-md border p-6">
          <p className="text-muted-foreground text-center">More analytics features coming soon...</p>
        </div>
      </div>
    </AdminLayout>
  );
};

export default withPageAuthRequired(AnalyticsPage, {
  onRedirecting: () => (
    <div className="flex h-screen w-full items-center justify-center">
      <p>Redirecting to login...</p>
    </div>
  ),
  onError: error => (
    <div className="flex h-screen w-full items-center justify-center">
      <p className="text-destructive">Error: {error.message}</p>
    </div>
  )
});
