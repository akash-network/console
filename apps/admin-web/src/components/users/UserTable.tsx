"use client";
import React from "react";
import { Button, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@akashnetwork/ui/components";
import { NavArrowLeft, NavArrowRight } from "iconoir-react";

import type { User } from "@src/types/user";

interface UserTableProps {
  users: User[];
  page: number;
  pageSize: number;
  totalPages: number;
  total: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

export const UserTable: React.FunctionComponent<UserTableProps> = ({ users, page, pageSize, totalPages, total, onPageChange, isLoading }) => {
  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return "-";
    return `$${value.toFixed(2)}`;
  };

  const truncateAddress = (address: string | null) => {
    if (!address) return "-";
    if (address.length <= 16) return address;
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
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
              <TableHead className="w-[100px]">User ID</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Username</TableHead>
              <TableHead>Wallet Address</TableHead>
              <TableHead className="text-right">USD Spent</TableHead>
              <TableHead className="text-right">Credits</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Last Active</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  Loading...
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center">
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              users.map(user => (
                <TableRow key={user.id}>
                  <TableCell className="font-mono text-xs">{user.id.slice(0, 8)}...</TableCell>
                  <TableCell>{user.email || "-"}</TableCell>
                  <TableCell>{user.username || "-"}</TableCell>
                  <TableCell className="font-mono text-xs">{truncateAddress(user.walletAddress)}</TableCell>
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
        <p className="text-muted-foreground text-sm">
          Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total} users
        </p>

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
