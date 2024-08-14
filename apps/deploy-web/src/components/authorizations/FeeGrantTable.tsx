import { Button, CustomPagination, Table, TableBody, TableHead, TableHeader, TableRow } from "@akashnetwork/ui/components";
import { AllowanceType } from "@src/types/grant";
import React, { Dispatch, SetStateAction, useState } from "react";
import { LinkTo } from "../shared/LinkTo";
import { AllowanceIssuedRow } from "./AllowanceIssuedRow";

interface Props {
  allowances: AllowanceType[];
  selectedAllowances: AllowanceType[];
  onEditAllowance: (feeAllowance: AllowanceType) => void;
  setDeletingAllowances: Dispatch<SetStateAction<AllowanceType[] | null>>;
  setSelectedAllowances: Dispatch<SetStateAction<AllowanceType[]>>;
}

export const FeeGrantTable: React.FC<Props> = ({ allowances, selectedAllowances, onEditAllowance, setDeletingAllowances, setSelectedAllowances }) => {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState<number>(10);
  const start = pageIndex * pageSize;
  const end = start + pageSize;
  const currentPageGrants = allowances.slice(start, end);
  const pageCount = Math.ceil(allowances.length / pageSize);

  const onSelectGrant = (checked: boolean, grant: AllowanceType) => {
    setSelectedAllowances(prev => {
      return checked ? prev.concat([grant]) : prev.filter(x => x.grantee !== grant.grantee);
    });
  };

  const onGrantDelete = (grant: AllowanceType) => {
    setDeletingAllowances([grant]);
  };

  const onDeleteGrants = () => {
    setDeletingAllowances(selectedAllowances);
  };

  const onDeleteAll = () => {
    setDeletingAllowances(allowances);
  };

  const onClearSelection = () => {
    setSelectedAllowances([]);
  };

  const handleChangePage = (newPage: number) => {
    setPageIndex(newPage);
  };

  const onPageSizeChange = (value: number) => {
    setPageSize(value);
    setPageIndex(0);
  };

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-1/5">Type</TableHead>
            <TableHead className="w-1/5 text-center">Grantee</TableHead>
            <TableHead className="w-1/5 text-center">Spending Limit</TableHead>
            <TableHead className="w-1/5 text-center">Expiration</TableHead>
            <TableHead className="w-1/5 text-center">
              {selectedAllowances.length > 0 && (
                <div className="flex items-center justify-end space-x-4">
                  <LinkTo onClick={onClearSelection} className="text-xs">
                    Clear
                  </LinkTo>
                  <Button onClick={onDeleteGrants} variant="destructive" size="sm" className="h-6 p-2 text-xs">
                    Revoke selected ({selectedAllowances.length})
                  </Button>
                </div>
              )}
              {allowances.length > 0 && selectedAllowances.length === 0 && (
                <div className="flex items-center justify-end">
                  <Button onClick={onDeleteAll} variant="destructive" size="sm" className="h-6 p-2 text-xs">
                    Revoke all
                  </Button>
                </div>
              )}
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {currentPageGrants.map(grant => (
            <AllowanceIssuedRow
              key={grant.grantee}
              allowance={grant}
              onEditAllowance={onEditAllowance}
              setDeletingAllowance={onGrantDelete}
              onSelectAllowance={onSelectGrant}
              checked={selectedAllowances.some(x => x.grantee === grant.grantee && x.granter === grant.granter)}
            />
          ))}
        </TableBody>
      </Table>

      {(allowances?.length || 0) > 0 && (
        <div className="flex items-center justify-center pt-6">
          <CustomPagination
            totalPageCount={pageCount}
            setPageIndex={handleChangePage}
            pageIndex={pageIndex}
            pageSize={pageSize}
            setPageSize={onPageSizeChange}
          />
        </div>
      )}
    </div>
  );
};
