"use client";
import React from "react";
import { Card, CardContent, CardHeader } from "@akashnetwork/ui/components";

type Props = {
  label: string | React.ReactNode;
  subLabel?: string;
  className?: string;
  children: React.ReactNode;
  "aria-label"?: string;
};

export const Fieldset: React.FunctionComponent<Props> = ({ label, subLabel, className = "", children, "aria-label": ariaLabel }) => {
  return (
    <Card className={className} aria-label={ariaLabel}>
      <CardHeader>
        {label}
        {subLabel && <p className="text-gray-400">{subLabel}</p>}
      </CardHeader>

      <CardContent className="relative rounded-sm">{children}</CardContent>
    </Card>
  );
};
