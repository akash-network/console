"use client";
import type { ReactNode } from "react";
import React from "react";
import { FormattedTime } from "react-intl";
import { Address, Button, Checkbox, TableCell, TableRow } from "@akashnetwork/ui/components";
import { Bin, Edit } from "iconoir-react";

import type { AllowanceType } from "@src/types/grant";
import { getAllowanceTitleByType } from "@src/utils/grants";
import { coinToUDenom } from "@src/utils/priceUtils";
import { DenomAmount } from "../../shared/DenomAmount/DenomAmount";

export const DEPENDENCIES = {
  FormattedTime,
  Address,
  Button,
  Checkbox,
  TableCell,
  TableRow,
  DenomAmount,
  Bin,
  Edit
};

type Props = {
  allowance: AllowanceType;
  children?: ReactNode;
  checked?: boolean;
  onEditAllowance: (allowance: AllowanceType) => void;
  setDeletingAllowance: (grantallowance: AllowanceType) => void;
  onSelectAllowance: (isChecked: boolean, allowance: AllowanceType) => void;
  dependencies?: typeof DEPENDENCIES;
};

export const AllowanceIssuedRow: React.FunctionComponent<Props> = ({
  allowance,
  checked,
  onEditAllowance,
  setDeletingAllowance,
  onSelectAllowance,
  dependencies: d = DEPENDENCIES
}) => {
  const limit = allowance?.allowance?.spend_limit?.[0];

  return (
    <d.TableRow className="[&>td]:px-2 [&>td]:py-1">
      <d.TableCell>{getAllowanceTitleByType(allowance)}</d.TableCell>
      <d.TableCell align="center">
        <d.Address address={allowance.grantee} isCopyable />
      </d.TableCell>
      <d.TableCell align="center">{limit ? <d.DenomAmount amount={coinToUDenom(limit)} denom={limit.denom} /> : <span>Unlimited</span>}</d.TableCell>
      <d.TableCell align="center">
        <d.FormattedTime year="numeric" month={"numeric"} day={"numeric"} value={allowance.allowance.expiration} />
      </d.TableCell>
      <d.TableCell align="center">
        <div className="flex items-center justify-end space-x-2">
          <div className="flex w-[40px] items-center justify-center">
            <d.Checkbox
              checked={checked}
              onClick={event => {
                event.stopPropagation();
              }}
              onCheckedChange={value => {
                onSelectAllowance(value as boolean, allowance);
              }}
            />
          </div>
          <d.Button variant="ghost" size="icon" onClick={() => onEditAllowance(allowance)} aria-label="Edit Authorization">
            <d.Edit className="text-xs" />
          </d.Button>
          <d.Button variant="ghost" size="icon" onClick={() => setDeletingAllowance(allowance)} aria-label="Revoke Authorization">
            <d.Bin className="text-xs" />
          </d.Button>
        </div>
      </d.TableCell>
    </d.TableRow>
  );
};
