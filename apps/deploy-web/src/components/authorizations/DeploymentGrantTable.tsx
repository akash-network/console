import React, { Dispatch, SetStateAction } from "react";
import { FormattedTime } from "react-intl";
import { Address, Button, Checkbox, CustomPagination, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@akashnetwork/ui/components";
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Bin, Edit } from "iconoir-react";

import { AKTAmount } from "@src/components/shared/AKTAmount";
import { GrantType } from "@src/types/grant";
import { coinToUDenom } from "@src/utils/priceUtils";
import { LinkTo } from "../shared/LinkTo";

interface Props {
  grants: GrantType[];
  selectedGrants: GrantType[];
  onEditGrant: (grant: GrantType) => void;
  setDeletingGrants: Dispatch<SetStateAction<GrantType[] | null>>;
  setSelectedGrants: Dispatch<SetStateAction<GrantType[]>>;
}

export const DeploymentGrantTable: React.FC<Props> = ({ grants, onEditGrant, setDeletingGrants, setSelectedGrants, selectedGrants }) => {
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

  const columnHelper = createColumnHelper<GrantType>();

  const columns = [
    columnHelper.accessor("grantee", {
      header: () => <div>Grantee</div>,
      cell: info => <Address address={info.getValue()} isCopyable />
    }),
    columnHelper.accessor(
      row => {
        return row.authorization.spend_limit;
      },
      {
        id: "spendingLimit",
        cell: info => {
          const value = info.getValue();

          return (
            <div className="text-center">
              <AKTAmount uakt={coinToUDenom(value)} /> {value.denom === "uakt" ? "AKT" : "USDC"}
            </div>
          );
        },
        header: () => <div className="text-center">Spending Limit</div>
      }
    ),
    columnHelper.accessor("expiration", {
      header: () => <div className="text-center">Expiration</div>,
      cell: info => (
        <div className="text-center">
          <FormattedTime year="numeric" month={"numeric"} day={"numeric"} value={info.getValue()} />
        </div>
      )
    }),
    columnHelper.display({
      id: "actions",
      header: () => (
        <div className="w-1/4 text-center">
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
        </div>
      ),
      cell: info => {
        const grant = info.row.original;

        return (
          <div className="flex items-center justify-end space-x-2">
            <div className="flex w-[40px] items-center justify-center">
              <Checkbox
                onClick={event => {
                  event.stopPropagation();
                }}
                onCheckedChange={value => {
                  onSelectGrant(value as boolean, grant);
                }}
              />
            </div>
            <Button variant="ghost" size="icon" onClick={() => onEditGrant(grant)}>
              <Edit className="text-xs" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onGrantDelete(grant)}>
              <Bin className="text-xs" />
            </Button>
          </div>
        );
      }
    })
  ];

  const table = useReactTable({
    data: grants,
    columns,
    getCoreRowModel: getCoreRowModel()
  });
  const pageCount = Math.ceil(grants.length / table.getState().pagination.pageSize);

  return (
    <div>
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map(headerGroup => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <TableHead key={header.id} className="w-1/4">
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>

        <TableBody>
          {table.getRowModel().rows.map(row => (
            <TableRow key={row.id}>
              {row.getVisibleCells().map(cell => (
                <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {(grants?.length || 0) > 0 && (
        <div className="flex items-center justify-center pt-6">
          <CustomPagination
            totalPageCount={pageCount}
            setPageIndex={table.setPageIndex}
            pageIndex={table.getState().pagination.pageIndex}
            pageSize={table.getState().pagination.pageSize}
            setPageSize={table.setPageSize}
          />
        </div>
      )}
    </div>
  );
};
