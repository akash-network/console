"use client";
import type { ReactNode } from "react";
import React from "react";
import { FormattedTime } from "react-intl";
import { Address, TableCell, TableRow } from "@akashnetwork/ui/components";

import type { GrantType } from "@src/types/grant";
import { coinToUDenom } from "@src/utils/priceUtils";
import { DenomAmount } from "../../shared/DenomAmount/DenomAmount";

export const DEPENDENCIES = {
  FormattedTime,
  Address,
  TableCell,
  TableRow,
  DenomAmount
};

type Props = {
  grant: GrantType;
  children?: ReactNode;
  dependencies?: typeof DEPENDENCIES;
};

export const GranteeRow: React.FunctionComponent<Props> = ({ grant, dependencies: d = DEPENDENCIES }) => {
  const limits = grant?.authorization?.spend_limits;

  return (
    <d.TableRow className="[&>td]:px-2 [&>td]:py-1">
      <d.TableCell>
        <d.Address address={grant.granter} isCopyable />
      </d.TableCell>
      <d.TableCell align="right">
        {limits ? (
          <>
            {limits.map((limit, index) => (
              <d.DenomAmount key={index} amount={coinToUDenom(limit)} denom={limit.denom} />
            ))}
          </>
        ) : (
          <span>Unlimited</span>
        )}
      </d.TableCell>
      <d.TableCell align="right">
        <d.FormattedTime year="numeric" month={"numeric"} day={"numeric"} value={grant.expiration} />
      </d.TableCell>
    </d.TableRow>
  );
};
