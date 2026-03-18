import type { Dispatch, SetStateAction } from "react";
import React from "react";
import { FormattedTime } from "react-intl";
import { LoggerService } from "@akashnetwork/logging";
import {
  Address,
  Button,
  Checkbox,
  CustomPagination,
  MIN_PAGE_SIZE,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@akashnetwork/ui/components";
import { createColumnHelper, flexRender, getCoreRowModel, getPaginationRowModel, useReactTable } from "@tanstack/react-table";
import { Bin, Edit } from "iconoir-react";

import { DenomAmount } from "@src/components/shared/DenomAmount/DenomAmount";
import type { GrantType } from "@src/types/grant";
import { coinToUDenom } from "@src/utils/priceUtils";
import { LinkTo } from "../../shared/LinkTo";

export const DEPENDENCIES = {
  FormattedTime,
  Address,
  Button,
  Checkbox,
  CustomPagination,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  DenomAmount,
  LinkTo,
  Bin,
  Edit
};

interface Props {
  grants: GrantType[];
  selectedGrants: GrantType[];
  totalCount: number;
  onEditGrant: (grant: GrantType) => void;
  setDeletingGrants: Dispatch<SetStateAction<GrantType[] | null>>;
  setSelectedGrants: Dispatch<SetStateAction<GrantType[]>>;
  onPageChange: (pageIndex: number, pageSize: number) => void;
  pageIndex: number;
  pageSize: number;
  dependencies?: typeof DEPENDENCIES;
}

const logger = LoggerService.forContext("DeploymentGrantTable");

export const DeploymentGrantTable: React.FC<Props> = ({
  grants,
  totalCount,
  onEditGrant,
  onPageChange,
  setDeletingGrants,
  setSelectedGrants,
  selectedGrants,
  pageIndex,
  pageSize,
  dependencies: d = DEPENDENCIES
}) => {
  const selectGrants = (checked: boolean, grant: GrantType) => {
    setSelectedGrants(prev => {
      return checked ? prev.concat([grant]) : prev.filter(x => x.grantee !== grant.grantee);
    });
  };

  const columnHelper = createColumnHelper<GrantType>();

  const columns = [
    columnHelper.accessor("grantee", {
      header: () => <div>Grantee</div>,
      cell: info => <d.Address address={info.getValue()} isCopyable />
    }),
    columnHelper.accessor(
      row => {
        return row.authorization.spend_limits;
      },
      {
        id: "spendingLimit",
        cell: info => {
          const value = info.getValue();

          return (
            <div className="text-center">
              {value.map(limit => (
                <d.DenomAmount key={limit.denom} amount={coinToUDenom(limit)} denom={limit.denom} />
              ))}
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
          <d.FormattedTime year="numeric" month={"numeric"} day={"numeric"} value={info.getValue()} />
        </div>
      )
    }),
    columnHelper.display({
      id: "actions",
      header: () => (
        <div>
          {selectedGrants.length > 0 && (
            <div className="flex items-center justify-end space-x-4">
              <d.LinkTo onClick={() => setSelectedGrants([])} className="text-xs">
                Clear
              </d.LinkTo>
              <d.Button onClick={() => setDeletingGrants(selectedGrants)} variant="outline" size="sm" className="h-6 p-2 text-xs">
                Revoke selected ({selectedGrants.length})
              </d.Button>
            </div>
          )}
          {grants.length > 0 && selectedGrants.length === 0 && (
            <div className="flex items-center justify-end">
              <d.Button onClick={() => setDeletingGrants(grants)} variant="outline" size="sm" className="h-6 p-2 text-xs">
                Revoke all
              </d.Button>
            </div>
          )}
        </div>
      ),
      cell: info => {
        const grant = info.row.original;

        return (
          <div className="flex items-center justify-end space-x-2">
            <div className="flex w-[40px] items-center justify-center">
              <d.Checkbox
                checked={selectedGrants.some(x => x.grantee === grant.grantee && x.granter === grant.granter)}
                onClick={event => {
                  event.stopPropagation();
                }}
                onCheckedChange={value => {
                  if (value !== "indeterminate") {
                    selectGrants(value, grant);
                  } else {
                    logger.warn("Unable to determinate checked state");
                  }
                }}
              />
            </div>
            <d.Button variant="ghost" size="icon" onClick={() => onEditGrant(grant)} aria-label="Edit Authorization">
              <d.Edit className="text-xs" />
            </d.Button>
            <d.Button variant="ghost" size="icon" onClick={() => setDeletingGrants([grant])} aria-label="Revoke Authorization">
              <d.Bin className="text-xs" />
            </d.Button>
          </div>
        );
      }
    })
  ];

  const table = useReactTable({
    data: grants,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    onPaginationChange: updaterOrValue => {
      const pagination = typeof updaterOrValue === "function" ? updaterOrValue(table.getState().pagination) : updaterOrValue;
      onPageChange(pagination.pageIndex, pagination.pageSize);
    },
    state: {
      pagination: {
        pageIndex,
        pageSize
      }
    }
  });
  const pagination = table.getState().pagination;
  const pageCount = Math.ceil(totalCount / pagination.pageSize);

  return (
    <div>
      <d.Table>
        <d.TableHeader>
          {table.getHeaderGroups().map(headerGroup => (
            <d.TableRow key={headerGroup.id}>
              {headerGroup.headers.map(header => (
                <d.TableHead key={header.id} className="w-1/4">
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </d.TableHead>
              ))}
            </d.TableRow>
          ))}
        </d.TableHeader>

        <d.TableBody>
          {table.getRowModel().rows.map(row => (
            <d.TableRow key={row.id} className="[&>td]:px-2 [&>td]:py-1">
              {row.getVisibleCells().map(cell => (
                <d.TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</d.TableCell>
              ))}
            </d.TableRow>
          ))}
        </d.TableBody>
      </d.Table>

      {pageCount > MIN_PAGE_SIZE && (
        <div className="flex items-center justify-center pt-6">
          <d.CustomPagination
            totalPageCount={pageCount}
            setPageIndex={table.setPageIndex}
            pageIndex={pagination.pageIndex}
            pageSize={pagination.pageSize}
            setPageSize={table.setPageSize}
          />
        </div>
      )}
    </div>
  );
};
