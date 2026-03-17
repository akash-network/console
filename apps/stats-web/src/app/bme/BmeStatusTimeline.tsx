"use client";
import React from "react";
import { FormattedDate, FormattedNumber, FormattedTime } from "react-intl";
import { Card, CardContent, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@akashnetwork/ui/components";

import { BmeStatusBadge } from "./BmeStatusBadge";

import type { BmeStatusHistoryResponse } from "@/queries";

interface BmeStatusTimelineProps {
  statusHistory: BmeStatusHistoryResponse;
}

export const BmeStatusTimeline: React.FunctionComponent<BmeStatusTimelineProps> = ({ statusHistory }) => {
  const reversed = [...statusHistory].reverse();

  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead className="text-center">Height</TableHead>
              <TableHead className="text-center">Previous Status</TableHead>
              <TableHead className="text-center">New Status</TableHead>
              <TableHead className="text-center">Collateral Ratio</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reversed.map(entry => (
              <TableRow key={entry.height}>
                <TableCell>
                  <FormattedDate value={entry.date} year="numeric" month="short" day="numeric" /> <FormattedTime value={entry.date} />
                </TableCell>
                <TableCell className="text-center">
                  <FormattedNumber value={entry.height} />
                </TableCell>
                <TableCell className="text-center">
                  <BmeStatusBadge status={entry.previousStatus} size="sm" />
                </TableCell>
                <TableCell className="text-center">
                  <BmeStatusBadge status={entry.newStatus} size="sm" />
                </TableCell>
                <TableCell className="text-center">
                  <FormattedNumber value={entry.collateralRatio} maximumFractionDigits={6} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};
