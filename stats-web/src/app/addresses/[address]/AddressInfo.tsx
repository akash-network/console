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
          // dark: theme.palette.secondary.main,
          // light: theme.palette.primary.main
          dark: customColors.akashRed,
          light: customColors.akashRed
        }
      }}
    />
  );

  return (
    <Card>
      <CardContent className="pt-6">
        <div
          className="flex flex-col items-start sm:flex-row"
          // sx={{
          //   display: "flex",
          //   alignItems: "flex-start",
          //   [theme.breakpoints.down("sm")]: {
          //     flexDirection: "column",
          //     alignItems: "flex-start"
          //   }
          // }}
        >
          <div
            className="hidden sm:block"
            // sx={{ display: { xs: "none", sm: "block" } }}
          >
            {QRcode}
            {/* <div
              className="pt-1 text-center"
              // sx={{ textAlign: "center", paddingTop: 1 }}
            >
              <Button variant="outlined" color="secondary" onClick={onSendClick}>
                <SendIcon />
                &nbsp; Send AKT
              </Button>
            </div> */}
          </div>
          <div
            className="block sm:hidden"
            // sx={{ display: { xs: "block", sm: "none" } }}
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <QrCode />
              </TooltipTrigger>
              <TooltipContent>{QRcode}</TooltipContent>
            </Tooltip>
          </div>

          <div
            className="flex-grow pt-2 sm:pl-4 sm:pt-0"
            // Ssx={{ paddingLeft: { xs: 0, sm: "1rem" }, paddingTop: { xs: ".5rem" }, flexGrow: 1 }}
          >
            <LabelValue
              label="Address"
              value={
                <div
                // sx={{ color: theme.palette.secondary.main, display: "flex", alignItems: "center" }}
                >
                  <Address address={address} isCopyable disableTruncate />
                </div>
              }
              labelWidth="10rem"
            />

            <div
              className="text-2xl"
              // sx={{
              //   marginBottom: "1rem",
              //   paddingBottom: ".5rem",
              //   borderBottom: `1px solid ${theme.palette.mode === "dark" ? theme.palette.grey[800] : theme.palette.grey[200]}`,
              //   fontSize: "1.5rem"
              // }}
            >
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

            <Separator className="mt-4 mb-4" />

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
