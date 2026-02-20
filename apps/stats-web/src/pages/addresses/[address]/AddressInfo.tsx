import React from "react";
import { QRCode } from "react-qrcode-logo";
import { Address, Card, CardContent, CustomTooltip, Separator } from "@akashnetwork/ui/components";
import { QrCode } from "iconoir-react";

import { AKTAmount } from "@/components/AKTAmount";
import { LabelValue } from "@/components/LabelValue";
import { customColors } from "@/lib/colors";
import type { AddressDetail } from "@/types";

interface IProps {
  address: string;
  addressDetail: AddressDetail;
}

export function AddressInfo({ address, addressDetail }: IProps) {
  const QRcode = (
    <QRCode
      value={address}
      size={175}
      quietZone={8}
      fgColor={customColors.akashRed}
      bgColor={customColors.black}
    />
  );

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex flex-col items-start sm:flex-row">
          <div className="hidden sm:block">{QRcode}</div>
          <div className="block sm:hidden">
            <CustomTooltip title={QRcode}>
              <QrCode />
            </CustomTooltip>
          </div>

          <div className="flex-grow pt-2 sm:pl-4 sm:pt-0">
            <LabelValue
              label="Address"
              value={
                <div>
                  <Address address={address} isCopyable disableTruncate />
                </div>
              }
              labelWidth="10rem"
            />

            <div className="text-2xl">
              <LabelValue label={<strong>AKT</strong>} value={<AKTAmount uakt={addressDetail.total} showUSD />} labelWidth="10rem" />
            </div>

            <Separator className="mb-4 mt-4" />

            <LabelValue label="Available" value={<AKTAmount uakt={addressDetail.available} showUSD />} labelWidth="10rem" />
            <LabelValue label="Delegated" value={<AKTAmount uakt={addressDetail.delegated} showUSD />} labelWidth="10rem" />
            <LabelValue label="Rewards" value={<AKTAmount uakt={addressDetail.rewards} showUSD />} labelWidth="10rem" />
            <LabelValue label="Commission" value={<AKTAmount uakt={addressDetail.commission} showUSD />} labelWidth="10rem" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
