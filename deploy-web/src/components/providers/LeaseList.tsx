"use client";
import React, { useState, useEffect } from "react";
import isEqual from "lodash/isEqual";
import { LeaseRow } from "./LeaseRow";
import { LeaseDto } from "@src/types/deployment";
import { CustomPagination } from "@src/components/shared/CustomPagination";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@src/components/ui/table";
import Spinner from "@src/components/shared/Spinner";
import { CheckboxWithLabel } from "@src/components/ui/checkbox";

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
      let _filteredLeases = [...leases].sort((a, b) => (a.state === "active" ? -1 : 1));

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
              {currentPageLeases.map((lease, i) => (
                <LeaseRow key={lease.id} lease={lease} />
              ))}
            </TableBody>
          </Table>

          <div className="px-4 pb-8 pt-4">
            <CustomPagination pageSize={pageSize} setPageIndex={setPageIndex} pageIndex={pageIndex} totalPageCount={pageCount} setPageSize={setPageSize} />
          </div>
        </>
      )}
    </>
  );
};

export const LeaseList = React.memo(MemoLeaseList, (prevProps, nextProps) => {
  return isEqual(prevProps, nextProps);
});
