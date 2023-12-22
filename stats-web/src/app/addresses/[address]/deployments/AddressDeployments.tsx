"use client";
import { Card, CardContent } from "@/components/ui/card";
import React, { useState } from "react";
import { useAddressDeployments } from "@/queries";
import Spinner from "@/components/Spinner";
import { SearchX } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DeploymentRow } from "./DeploymentRow";
import { DataTable } from "@/components/table/data-table";
import { columns } from "./columns";
import { ColumnFiltersState, PaginationState, Updater, functionalUpdate } from "@tanstack/table-core";

interface IProps {
  address: string;
}

export function AddressDeployments({ address }: IProps) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState("*");
  const [isSortingReversed, setIsSortingReversed] = useState(true);
  const { data: deploymentsResult, isLoading } = useAddressDeployments(address, page * pageSize, pageSize, isSortingReversed, { status: statusFilter });
  const pageCount = Math.ceil((deploymentsResult?.count || 0) / pageSize);

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
            pageCount={deploymentsResult?.count}
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
