"use client";
import React from "react";
import { Card, CardContent, CustomTooltip, Separator, Address } from "@akashnetwork/ui/components";
import { QrCode } from "iconoir-react";
import { useQRCode } from "next-qrcode";

import { AKTAmount } from "@/components/AKTAmount";
import { LabelValue } from "@/components/LabelValue";
import { customColors } from "@/lib/colors";
import { AddressDetail } from "@/types";

interface IProps {
  address: string;
  addressDetail: AddressDetail;
}

export function AddressInfo({ address, addressDetail }: IProps) {
  const { Canvas } = useQRCode();

  const QRcode = (
    <Canvas
      text={address}
      options={{
        type: "image/jpeg",
        quality: 0.3,
        margin: 2,
        scale: 4,
        width: 175,
        color: {
          dark: customColors.akashRed,
          light: customColors.black
        }
      }}
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
