"use client";
import React from "react";

import { columns } from "./columns";

import { DataTable } from "@/components/table/data-table";
import { useValidators } from "@/queries";

interface IProps {}

export function ValidatorsTable({}: IProps) {
  const { data: validators, isLoading } = useValidators();

  return (
    <div>
      <DataTable data={validators || []} columns={columns} noResultsText="This address has no deployments." isLoading={isLoading} initialPageSize={1000} />
    </div>
  );
}
