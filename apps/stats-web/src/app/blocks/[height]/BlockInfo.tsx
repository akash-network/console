"use client";
import { FormattedDate, FormattedRelativeTime } from "react-intl";
import Link from "next/link";

import { LabelValue } from "@/components/LabelValue";
import { Card, CardContent } from "@/components/ui/card";
import { UrlService } from "@/lib/urlUtils";
import { BlockDetail } from "@/types";

interface IProps {
  block: BlockDetail;
}

export function BlockInfo({ block }: IProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <LabelValue label="Height" value={block.height} />
        <LabelValue label="Poposer" value={<Link href={UrlService.validator(block.proposer.operatorAddress)}>{block.proposer.moniker}</Link>} />
        <LabelValue
          label="Block Time"
          value={
            <>
              <FormattedRelativeTime
                value={(new Date(block.datetime).getTime() - new Date().getTime()) / 1000}
                numeric="auto"
                unit="second"
                updateIntervalInSeconds={7}
              />
              &nbsp;(
              <FormattedDate value={block.datetime} year="numeric" month="2-digit" day="2-digit" hour="2-digit" minute="2-digit" second="2-digit" />)
            </>
          }
        />
        <LabelValue label="Block Hash" value={block.hash} />
        <LabelValue label="# of Transactions" value={block.transactions.length} />
        <LabelValue label="Gas wanted / used" value={block.gasUsed === 0 || block.gasWanted === 0 ? 0 : `${block.gasUsed} / ${block.gasWanted}`} />
      </CardContent>
    </Card>
  );
}
