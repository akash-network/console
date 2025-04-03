"use client";
import React from "react";
import { MdMoneyOff } from "react-icons/md";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Card,
  CardContent,
  CustomTooltip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@akashnetwork/ui/components";
import { HelpCircle } from "iconoir-react";

import { FormattedDecimal } from "@/components/FormattedDecimal";
import { getSplitText } from "@/hooks/useShortText";
import type { AddressDetail } from "@/types";

interface IProps {
  addressDetail: AddressDetail;
}

export function AssetList({ addressDetail }: IProps) {
  return (
    <Card className="h-full">
      <CardContent className="pt-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="text-center">Amount</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {addressDetail.assets.map(asset => (
              <TableRow key={asset.symbol || asset.ibcToken}>
                <TableCell>
                  <div className="flex items-center">
                    <div className="mr-2">
                      <Avatar>
                        <AvatarImage src={asset.logoUrl} alt={asset.symbol} />
                        <AvatarFallback>
                          <MdMoneyOff />
                        </AvatarFallback>
                      </Avatar>
                    </div>
                    <div>
                      <div className="flex items-center">
                        {asset.symbol || "Unknown"}
                        {asset.description && (
                          <CustomTooltip title={asset.description}>
                            <HelpCircle className="ml-2" />
                          </CustomTooltip>
                        )}
                      </div>
                      {asset.ibcToken && (
                        <div>
                          <CustomTooltip title={asset.ibcToken}>
                            <small>{getSplitText(asset.ibcToken, 10, 10)}</small>
                          </CustomTooltip>
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell align="center">
                  <FormattedDecimal value={asset.amount} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
