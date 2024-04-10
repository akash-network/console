"use client";
import React from "react";
import { Card, CardContent } from "../ui/card";

type Props = {
  label: string;
  className?: string;
  children: React.ReactNode;
};

export const Fieldset: React.FunctionComponent<Props> = ({ label, className = "", children }) => {
  return (
    <Card className={className}>
      <CardContent className="relative rounded-sm">
        <div className="p-2 text-muted-foreground">
          <p>{label}</p>
        </div>

        <div className="p-4">{children}</div>
      </CardContent>
    </Card>
  );
};
