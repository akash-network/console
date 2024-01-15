"use client";
import { Card, CardContent } from "@/components/ui/card";
import React, { useState } from "react";
import { useAddressTransactions } from "@/queries";
import { SearchX } from "lucide-react";
import { DataTable } from "@/components/table/data-table";
import { columns } from "./columns";

interface IProps {
  address: string;
}

export function AddressTransactions({ address }: IProps) {
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const { data: transactionsResult, isLoading } = useAddressTransactions(address, page * pageSize, pageSize);
  const pageCount = transactionsResult?.count ? Math.ceil((transactionsResult.count || 0) / pageSize) : undefined;

  return (
    <Card>
      <CardContent className="pt-6">
        {transactionsResult?.results.length === 0 ? (
          <div className="flex items-center p-4">
            <SearchX size="1rem" />
            &nbsp;This address has no transactions
          </div>
        ) : (
          <DataTable
            data={transactionsResult?.results || []}
            columns={columns}
            pageCount={pageCount}
            manualPagniation
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
