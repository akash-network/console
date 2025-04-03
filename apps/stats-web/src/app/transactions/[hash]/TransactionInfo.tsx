"use client";
import React from "react";
import { FormattedDate, FormattedRelativeTime } from "react-intl";
import { Alert, AlertDescription, AlertTitle, Card, CardContent } from "@akashnetwork/ui/components";
import { WarningCircle } from "iconoir-react";
import Link from "next/link";

import { AddressLink } from "@/components/AddressLink";
import { AKTAmount } from "@/components/AKTAmount";
import { LabelValue } from "@/components/LabelValue";
import { UrlService } from "@/lib/urlUtils";
import type { TransactionDetail } from "@/types";

interface IProps {
  transaction: TransactionDetail;
}

export function TransactionInfo({ transaction }: IProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <LabelValue label="Hash" value={transaction.hash} />
        <LabelValue label="Status" value={transaction.isSuccess ? "Success" : "Failed"} />
        <LabelValue label="Height" value={<Link href={UrlService.block(transaction.height)}>{transaction.height}</Link>} />
        <LabelValue
          label="Time"
          value={
            <>
              <FormattedRelativeTime
                value={(new Date(transaction.datetime).getTime() - new Date().getTime()) / 1000}
                numeric="auto"
                unit="second"
                updateIntervalInSeconds={7}
              />
              &nbsp;(
              <FormattedDate value={transaction.datetime} year="numeric" month="2-digit" day="2-digit" hour="2-digit" minute="2-digit" second="2-digit" />)
            </>
          }
        />
        <LabelValue label="Fee" value={<AKTAmount uakt={transaction.fee} showAKTLabel />} />
        <LabelValue label="Gas (used/wanted)" value={`${transaction.gasUsed} / ${transaction.gasWanted}`} />
        {transaction.multisigThreshold && <LabelValue label="Multisig Threshold" value={transaction.multisigThreshold} />}
        <LabelValue
          label={transaction.signers.length > 1 ? "Signers" : "Signer"}
          value={
            <>
              {transaction.signers.map(signer => (
                <React.Fragment key={signer}>
                  <AddressLink address={signer} />
                  <br />
                </React.Fragment>
              ))}
            </>
          }
        />
        <LabelValue label="Memo" value={transaction.memo} />

        {transaction.error && (
          <Alert variant="destructive">
            <WarningCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{transaction.error}</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
