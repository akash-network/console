"use client";
import React, { useEffect, useState } from "react";
import { CheckboxWithLabel, CustomPagination, Spinner, Table, TableBody, TableHead, TableHeader, TableRow } from "@akashnetwork/ui/components";
import isEqual from "lodash/isEqual";

import type { LeaseDto } from "@src/types/deployment";
import { LeaseRow } from "./LeaseRow";

type Props = {
  leases: LeaseDto[] | null;
  isLoadingLeases: boolean;
};

const MemoLeaseList: React.FunctionComponent<Props> = ({ leases, isLoadingLeases }) => {
  const [pageIndex, setPageIndex] = useState(0);
  const [filteredLeases, setFilteredLeases] = useState(leases || []);
  const [isFilteringActive, setIsFilteringActive] = useState(false);
  const [pageSize, setPageSize] = useState(10);
  const start = pageIndex * pageSize;
  const end = start + pageSize;
  const currentPageLeases = filteredLeases.slice(start, end);
  const pageCount = Math.ceil(filteredLeases.length / pageSize);

  useEffect(() => {
    if (leases) {
      let _filteredLeases = [...leases].sort(a => (a.state === "active" ? -1 : 1));

      if (isFilteringActive) {
        _filteredLeases = _filteredLeases.filter(x => x.state === "active");
      }

      setFilteredLeases(_filteredLeases);
    }
  }, [leases, isFilteringActive]);

  const onIsActiveChange = (value: boolean) => {
    setPageIndex(0);
    setIsFilteringActive(value);
  };

  const onPageSizeChange = (value: number) => {
    setPageSize(value);
    setPageIndex(0);
  };

  return (
    <>
      <div className="flex items-center pb-2">
        <h5 className="text-xl">Your leases</h5>

        <div className="ml-4">
          <CheckboxWithLabel checked={isFilteringActive} onCheckedChange={onIsActiveChange} label="Active" />
        </div>
      </div>

      {currentPageLeases?.length === 0 && isLoadingLeases && (
        <div className="flex items-center justify-center">
          <Spinner size="large" />
        </div>
      )}

      {currentPageLeases?.length === 0 && !isLoadingLeases && <p>You have 0 {isFilteringActive ? "active" : ""} lease for this provider.</p>}

      {currentPageLeases?.length > 0 && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Dseq</TableHead>
                <TableHead>Price</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {currentPageLeases.map(lease => (
                <LeaseRow key={lease.id} lease={lease} />
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-center py-8">
            <CustomPagination pageSize={pageSize} setPageIndex={setPageIndex} pageIndex={pageIndex} totalPageCount={pageCount} setPageSize={onPageSizeChange} />
          </div>
        </>
      )}
    </>
  );
};

export const LeaseList = React.memo(MemoLeaseList, (prevProps, nextProps) => {
  return isEqual(prevProps, nextProps);
});
