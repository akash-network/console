"use client";
import { AddressDetail } from "@/types";
import { Card, CardContent } from "@/components/ui/card";
import React, { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Delegations } from "./Delegations";
import { Redelegations } from "./Redelegations";

interface IProps {
  address: string;
  addressDetail: AddressDetail;
}

export function AssetList({ address, addressDetail }: IProps) {
  const [assetTab, setAssetTab] = useState("delegations");

  const handleTabChange = (newValue: string) => {
    setAssetTab(newValue);
  };

  return (
    <Card>
      <CardContent className="pt-6">
        {/* <Paper sx={{ padding: 2, height: "100%" }} elevation={2}> */}
        <div
          className="mb-2 border-b border-muted-foreground"
          // sx={{ borderBottom: 1, borderColor: "divider", marginBottom: 1 }}
        >
          <Tabs
            value={assetTab}
            onValueChange={handleTabChange}
            // aria-label="address tabs"
            // textColor="secondary"
            // indicatorColor="secondary"
            // variant="scrollable"
            // scrollButtons="auto"
          >
            {/* <Box sx={{ borderBottom: 1, borderColor: "divider", marginBottom: "1rem" }}> */}
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="delegations">Delegations</TabsTrigger>
              <TabsTrigger value="redelegations">Redelegations</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {assetTab === "delegations" && <Delegations delegations={addressDetail.delegations} />}
        {assetTab === "redelegations" && <Redelegations redelegations={addressDetail.redelegations} />}
      </CardContent>
    </Card>
  );
}
