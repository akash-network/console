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

export function AssetAllocation({ address, addressDetail }: IProps) {
  const [assetTab, setAssetTab] = useState("delegations");

  const handleTabChange = (newValue: string) => {
    setAssetTab(newValue);
  };

  return (
    <Card className="h-full">
      <CardContent className="p-0">
        <div className="mb-2">
          <Tabs value={assetTab} onValueChange={handleTabChange}>
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
