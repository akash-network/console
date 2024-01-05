"use client";
import React, { useState } from "react";
import { useAddressDeployments, useValidators } from "@/queries";
import { DataTable } from "@/components/table/data-table";
import { columns } from "./columns";
import { ColumnFiltersState, SortingState } from "@tanstack/table-core";
import { Card, CardContent } from "@/components/ui/card";
import { SearchX } from "lucide-react";

interface IProps {}

export function ValidatorsTable({}: IProps) {
  // const [page, setPage] = useState(0);
  // const [pageSize, setPageSize] = useState(10);
  // const [statusFilter, setStatusFilter] = useState("*");
  const [isSortingReversed, setIsSortingReversed] = useState(true);
  const { data: validators, isLoading } = useValidators();
  // const pageCount = deploymentsResult?.count ? Math.ceil((deploymentsResult.count || 0) / pageSize) : undefined;

  // const onColumnSortingChange = (sorting: SortingState) => {
  //   const dseqSort = sorting.find(sort => sort.id === "dseq");

  //   if (dseqSort) {
  //     setIsSortingReversed(dseqSort.desc);
  //   }
  // };

  // const onColumnFiltersChange = (columnFilters: ColumnFiltersState) => {
  //   const statusFilter = (columnFilters.find(filter => filter.id === "status")?.value as string) || "*";
  //   setStatusFilter(statusFilter);
  // };

  return (
    <Card>
      <CardContent className="pt-6">
        {/* {deploymentsResult?.results.length === 0 && statusFilter === "*" ? (
          <div className="flex items-center p-4">
            <SearchX size="1rem" />
            &nbsp;This address has no deployments
          </div>
        ) : (
          <DataTable
            data={deploymentsResult?.results || []}
            columns={columns}
            pageCount={pageCount}
            manualPagniation
            manualFiltering
            manualSorting
            onColumnFiltersChange={onColumnFiltersChange}
            onColumnSortingChange={onColumnSortingChange}
            noResultsText="This address has no deployments."
            isLoading={isLoading}
            setPageIndex={pageIndex => setPage(pageIndex)}
            setPageSize={pageSize => setPageSize(pageSize)}
          />
        )} */}
        Coming soon!
      </CardContent>
    </Card>
  );
}
