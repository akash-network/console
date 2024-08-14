import { Button, CustomPagination, Table, TableBody, TableHead, TableHeader, TableRow } from "@akashnetwork/ui/components";
import { GrantType } from "@src/types/grant";
import React, { Dispatch, SetStateAction, useState } from "react";
import { GranterRow } from "./GranterRow";
import { LinkTo } from "../shared/LinkTo";

interface Props {
  grants: GrantType[];
  selectedGrants: GrantType[];
  onEditGrant: (grant: GrantType) => void;
  setDeletingGrants: Dispatch<SetStateAction<GrantType[] | null>>;
  setSelectedGrants: Dispatch<SetStateAction<GrantType[]>>;
}

const DeploymentGrantTable: React.FC<Props> = ({ grants, onEditGrant, setDeletingGrants, setSelectedGrants, selectedGrants }) => {
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState<number>(10);
  const start = pageIndex * pageSize;
  const end = start + pageSize;
  const currentPageGrants = grants.slice(start, end);
  const pageCount = Math.ceil(grants.length / pageSize);

  const onSelectGrant = (checked: boolean, grant: GrantType) => {
    setSelectedGrants(prev => {
      return checked ? prev.concat([grant]) : prev.filter(x => x.grantee !== grant.grantee);
    });
  };

  const onGrantDelete = (grant: GrantType) => {
    setDeletingGrants([grant]);
  };

  const onDeleteGrants = () => {
    setDeletingGrants(selectedGrants);
  };

  const onDeleteAll = () => {
    setDeletingGrants(grants);
  };

  const onClearSelection = () => {
    setSelectedGrants([]);
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
            <TableHead className="w-1/4">Grantee</TableHead>
            <TableHead className="w-1/4 text-center">Spending Limit</TableHead>
            <TableHead className="w-1/4 text-center">Expiration</TableHead>
            <TableHead className="w-1/4 text-center">
              {selectedGrants.length > 0 && (
                <div className="flex items-center justify-end space-x-4">
                  <LinkTo onClick={onClearSelection} className="text-xs">
                    Clear
                  </LinkTo>
                  <Button onClick={onDeleteGrants} variant="destructive" size="sm" className="h-6 p-2 text-xs">
                    Revoke selected ({selectedGrants.length})
                  </Button>
                </div>
              )}
              {grants.length > 0 && selectedGrants.length === 0 && (
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
            <GranterRow
              key={grant.grantee}
              grant={grant}
              onEditGrant={onEditGrant}
              setDeletingGrant={onGrantDelete}
              onSelectGrant={onSelectGrant}
              checked={selectedGrants.some(x => x.grantee === grant.grantee && x.granter === grant.granter)}
            />
          ))}
        </TableBody>
      </Table>

      {(grants?.length || 0) > 0 && (
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

export default DeploymentGrantTable;
