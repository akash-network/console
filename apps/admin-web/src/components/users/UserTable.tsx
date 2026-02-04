"use client";
import React from "react";
import {
  Address,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@akashnetwork/ui/components";
import { NavArrowLeft, NavArrowRight } from "iconoir-react";

import type { User } from "@src/types/user";

interface UserTableProps {
  users: User[];
  page: number;
  pageSize: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  isLoading?: boolean;
}

export const UserTable: React.FunctionComponent<UserTableProps> = ({ users, page, pageSize, totalPages, total, onPageChange, onPageSizeChange, isLoading }) => {
  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return "-";
    return `$${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric"
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Wallet Address / User</TableHead>
              <TableHead className="text-right">USD Spent</TableHead>
              <TableHead className="text-right">Credits</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Last Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              users.map(user => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">{user.email || "-"}</span>
                      {user.walletAddress ? (
                        <Address address={user.walletAddress} isCopyable className="text-muted-foreground text-xs" />
                      ) : (
                        <span className="text-muted-foreground text-xs">No wallet</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(user.totalSpent)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(user.totalCredits)}</TableCell>
                  <TableCell>{formatDate(user.createdAt)}</TableCell>
                  <TableCell>{formatDate(user.lastActiveAt)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-muted-foreground text-sm">
            Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} users
          </p>
          {onPageSizeChange && (
            <Select value={`${pageSize}`} onValueChange={v => onPageSizeChange(Number(v))}>
              <SelectTrigger className="h-8 w-[70px]">
                <SelectValue placeholder={pageSize} />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 50].map(size => (
                  <SelectItem key={size} value={`${size}`}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1 || isLoading}>
            <NavArrowLeft className="mr-1 h-4 w-4" />
            Previous
          </Button>
          <span className="text-muted-foreground text-sm">
            Page {page} of {totalPages}
          </span>
          <Button variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages || isLoading}>
            Next
            <NavArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default UserTable;
