"use client";
import React, { useEffect, useState } from "react";
import { useAddressDeployments } from "@/queries";
import { DataTable } from "@/components/table/data-table";
import { columns } from "./columns";
import { ColumnFiltersState } from "@tanstack/table-core";
import { Card, CardContent } from "@/components/ui/card";
import { SearchX } from "lucide-react";

interface IProps {
  address: string;
}

export function AddressDeployments({ address }: IProps) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState("*");
  const [isSortingReversed, setIsSortingReversed] = useState(true);
  const { data: deploymentsResult, isLoading } = useAddressDeployments(address, page * pageSize, pageSize, isSortingReversed, { status: statusFilter });
  const pageCount = deploymentsResult?.count ? Math.ceil((deploymentsResult.count || 0) / pageSize) : undefined;

  // const handleRequestSort = (event: React.MouseEvent<unknown>) => {
  //   setIsSortingReversed(current => !current);
  // };

  const onColumnFiltersChange = (columnFilters: ColumnFiltersState) => {
    const statusFilter = (columnFilters.find(filter => filter.id === "status")?.value as string) || "*";
    setStatusFilter(statusFilter);
  };

  return (
    <Card>
      <CardContent className="pt-6">
        {deploymentsResult?.results.length === 0 && statusFilter === "*" ? (
          <div className="flex items-center p-4">
            <SearchX size="1rem" />
            &nbsp;This address has no deployments
          </div>
        ) : (
          <DataTable
            data={deploymentsResult?.results || []}
            columns={columns}
            manualPagniation
            pageCount={pageCount}
            manualFiltering
            onColumnFiltersChange={onColumnFiltersChange}
            noResultsText="This address has no deployments."
            isLoading={isLoading}
            setPageIndex={pageIndex => setPage(pageIndex)}
            setPageSize={pageSize => setPageSize(pageSize)}
          />
        )}
      </CardContent>
    </Card>
  );
}
