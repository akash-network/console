"use client";
import React from "react";
import { Card, CardContent, CardHeader } from "@akashnetwork/ui/components";

type Props = {
  label: string;
  className?: string;
  children: React.ReactNode;
};

export const Fieldset: React.FunctionComponent<Props> = ({ label, className = "", children }) => {
  return (
    <Card className={className}>
      <CardHeader>{label}</CardHeader>
      <CardContent className="relative rounded-sm">{children}</CardContent>
    </Card>
  );
};
