"use client";
import React, { useState } from "react";
import {
  Card,
  CardContent,
  DataTable,
  MIN_PAGE_SIZE,
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
  PaginationSizeSelector
} from "@akashnetwork/ui/components";
import { SearchX } from "lucide-react";

import { columns } from "./columns";

import { useAddressTransactions } from "@/queries";

interface IProps {
  address: string;
}

export function AddressTransactions({ address }: IProps) {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(MIN_PAGE_SIZE);
  const { data: transactionsPage, isLoading } = useAddressTransactions(address, pageIndex * pageSize, pageSize);
  const hasNextPage = !!transactionsPage?.hasMore;
  const isPaginated = hasNextPage || pageIndex > 0;

  const changePageSize = (value: number) => {
    setPageSize(value);
    setPageIndex(0);
  };

  return (
    <Card>
      <CardContent className="pt-6">
        {pageIndex === 0 && transactionsPage?.results.length === 0 ? (
          <div className="flex items-center p-4">
            <SearchX size="1rem" />
            &nbsp;This address has no transactions
          </div>
        ) : (
          <>
            <DataTable
              data={transactionsPage?.results || []}
              columns={columns}
              manualPagniation
              noResultsText="This address has no transactions."
              isLoading={isLoading}
            />
            <div className="flex flex-col items-center justify-between px-2 pt-4 md:flex-row md:space-x-4">
              <PaginationSizeSelector pageSize={pageSize} setPageSize={changePageSize} />
              {isPaginated && (
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious onClick={() => setPageIndex(current => Math.max(current - 1, 0))} disabled={pageIndex === 0} />
                    </PaginationItem>
                    <PaginationItem>
                      <PaginationNext onClick={() => setPageIndex(current => current + 1)} disabled={!hasNextPage} />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
