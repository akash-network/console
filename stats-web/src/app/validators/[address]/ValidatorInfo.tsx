"use client";
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { ValidatorDetail } from "@/types";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { User } from "iconoir-react";
import { LabelValue } from "@/components/LabelValue";
import { AKTAmount } from "@/components/AKTAmount";
import { FormattedNumber } from "react-intl";
import { isValidHttpUrl } from "@/lib/urlUtils";

interface IProps {
  validator: ValidatorDetail;
}

export function ValidatorsInfo({ validator }: IProps) {
  let website = validator.website?.trim();

  if (website && !/^https?:\/\//i.test(website) && isValidHttpUrl("http://" + website)) {
    website = "http://" + website;
  }

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
          <h1 className="text-lg font-bold">{validator.moniker}</h1>
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
                {isValidHttpUrl(website) ? (
                  <a href={website} target="_blank">
                    {website}
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
