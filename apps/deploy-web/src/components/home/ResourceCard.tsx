"use client";
import React from "react";
import { Card, CardContent } from "@akashnetwork/ui/components";

type Props = {
  icon: React.ReactNode;
  value: string | number;
  label: string;
};

export const ResourceCard: React.FC<Props> = ({ icon, value, label }) => {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-6">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-muted-foreground/10">{icon}</div>
        <div className="flex flex-col">
          <div className="text-xl font-bold">{value}</div>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
};
