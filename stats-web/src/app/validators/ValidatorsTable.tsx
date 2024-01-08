"use client";
import React from "react";
import { useValidators } from "@/queries";
import { DataTable } from "@/components/table/data-table";
import { columns } from "./columns";
import { SearchX } from "lucide-react";

interface IProps {}

export function ValidatorsTable({}: IProps) {
  const { data: validators, isLoading } = useValidators();

  return (
    <div>
      <DataTable data={validators || []} columns={columns} noResultsText="This address has no deployments." isLoading={isLoading} initialPageSize={1000} />
    </div>
  );
}
