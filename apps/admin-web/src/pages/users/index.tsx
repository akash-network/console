"use client";
import React, { useCallback, useEffect, useState } from "react";
import { Card, CardContent } from "@akashnetwork/ui/components";
import { withPageAuthRequired } from "@auth0/nextjs-auth0/client";
import { Activity, Group, PlusCircle } from "iconoir-react";
import { useDebounceValue } from "usehooks-ts";

import { AdminLayout } from "@src/components/layout/AdminLayout";
import { UserSearch } from "@src/components/users/UserSearch";
import { UserTable } from "@src/components/users/UserTable";
import { useUserStatsQuery } from "@src/queries/useAnalyticsQuery";
import { useSearchUsersQuery, useUsersQuery } from "@src/queries/useUsersQuery";

const UsersPage: React.FunctionComponent = () => {
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch] = useDebounceValue(searchQuery, 300);
  const pageSize = 20;

  const isSearching = debouncedSearch.length > 0;

  const listQuery = useUsersQuery({ page, pageSize });
  const searchQueryResult = useSearchUsersQuery({
    query: debouncedSearch,
    page,
    pageSize
  });
  const { data: stats } = useUserStatsQuery();

  const activeQuery = isSearching ? searchQueryResult : listQuery;
  const { data, isLoading, error } = activeQuery;

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
  }, []);

  const formatNumber = (value: number | undefined) => {
    if (value === undefined) return "-";
    return value.toLocaleString();
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Users</h2>
          <p className="text-muted-foreground">Manage and view Console users</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
                <Group className="text-primary h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Total Users</p>
                <p className="text-2xl font-bold">{formatNumber(stats?.totalUsers)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
                <PlusCircle className="text-primary h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">New (7D)</p>
                <p className="text-2xl font-bold">{formatNumber(stats?.newUsersLast7Days)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center gap-4 p-4">
              <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
                <Activity className="text-primary h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="text-muted-foreground text-xs font-medium uppercase tracking-wide">Active (30D)</p>
                <p className="text-2xl font-bold">{formatNumber(stats?.activeUsersLast30Days)}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex-1">
            <UserSearch value={searchQuery} onChange={handleSearchChange} />
          </div>
        </div>

        {error ? (
          <div className="border-destructive/50 bg-destructive/10 rounded-md border p-4">
            <p className="text-destructive text-sm">Failed to load users: {error instanceof Error ? error.message : "Unknown error"}</p>
          </div>
        ) : (
          <UserTable
            users={data?.users || []}
            page={page}
            pageSize={pageSize}
            totalPages={data?.totalPages || 1}
            total={data?.total || 0}
            onPageChange={handlePageChange}
            isLoading={isLoading}
          />
        )}
      </div>
    </AdminLayout>
  );
};

export default withPageAuthRequired(UsersPage, {
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
