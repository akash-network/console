"use client";
import React, { useState } from "react";
import { SearchX } from "lucide-react";

import { columns } from "./columns";

import { Card, CardContent, DataTable } from "@akashnetwork/ui/components";
import { useAddressTransactions } from "@/queries";

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
