"use client";
import React from "react";
import { FormattedNumber } from "react-intl";
import { Avatar, AvatarFallback, AvatarImage, Badge, Card, CardContent } from "@akashnetwork/ui/components";
import { User } from "lucide-react";

import { AKTAmount } from "@/components/AKTAmount";
import { LabelValue } from "@/components/LabelValue";
import { toValidatorWebsiteUrl } from "@/lib/validatorWebsiteUrl/validatorWebsiteUrl";
import type { ValidatorDetail } from "@/types";

interface IProps {
  validator: ValidatorDetail;
}

export function ValidatorsInfo({ validator }: IProps) {
  const website = validator.website?.trim();
  const websiteUrl = toValidatorWebsiteUrl(website);

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="mb-4 flex items-center">
          <div className="relative mr-4">
            <Avatar className="h-[5rem] w-[5rem]">
              <AvatarImage src={validator.keybaseAvatarUrl} alt={validator.moniker} />
              <AvatarFallback>
                <User />
              </AvatarFallback>
            </Avatar>
            <Badge color="secondary" className="absolute right-0 top-0">
              {validator.rank}
            </Badge>
          </div>
          <h1 className="text-lg">{validator.moniker}</h1>
        </div>

        <LabelValue label="Operator Address" value={validator.operatorAddress} />
        <LabelValue label="Voting Power" value={<AKTAmount uakt={validator.votingPower} showAKTLabel showUSD />} />
        <LabelValue label="Commission" value={<FormattedNumber style="percent" value={validator.commission} minimumFractionDigits={2} />} />
        <LabelValue label="Max Commission" value={<FormattedNumber style="percent" value={validator.maxCommission} minimumFractionDigits={2} />} />
        <LabelValue label="Max Commission Change" value={<FormattedNumber style="percent" value={validator.maxCommissionChange} minimumFractionDigits={2} />} />
        <LabelValue
          label="Website"
          value={
            website && (
              <>
                {websiteUrl ? (
                  <a href={websiteUrl} target="_blank">
                    {websiteUrl}
                  </a>
                ) : (
                  website
                )}
              </>
            )
          }
        />
        <LabelValue
          label="Identity"
          value={
            validator?.keybaseUsername ? (
              <a href={"https://keybase.io/" + validator?.keybaseUsername} target="_blank">
                {validator.identity}
              </a>
            ) : (
              <>{validator.identity}</>
            )
          }
        />
        <LabelValue label="Description" value={<div className="break-words">{validator.description}</div>} />
      </CardContent>
    </Card>
  );
}
