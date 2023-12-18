"use client";
import { AddressDetail } from "@/types";
import { LabelValue } from "@/components/LabelValue";
import { Card, CardContent } from "@/components/ui/card";
import { AKTAmount } from "@/components/AKTAmount";
import React from "react";
import { useQRCode } from "next-qrcode";
import { customColors } from "@/lib/colors copy";
import { QrCode } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Address } from "@/components/Address";
import { GradientText } from "@/components/GradientText";
import { Separator } from "@/components/ui/separator";

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
            <Tooltip>
              <TooltipTrigger asChild>
                <QrCode />
              </TooltipTrigger>
              <TooltipContent>{QRcode}</TooltipContent>
            </Tooltip>
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
              <LabelValue
                label={
                  <GradientText>
                    <strong>AKT</strong>
                  </GradientText>
                }
                value={<AKTAmount uakt={addressDetail.total} showUSD />}
                labelWidth="10rem"
              />
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
