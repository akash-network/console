"use client";
import React from "react";
import { Card, CardContent } from "../ui/card";

type Props = {
  label: string;
  children: React.ReactNode;
};

export const Fieldset: React.FunctionComponent<Props> = ({ label, children }) => {
  return (
    <Card>
      <CardContent className="relative mb-4 rounded-sm">
        <div className="p-2 text-muted-foreground">
          <p>{label}</p>
        </div>

        <div className="p-4">{children}</div>
      </CardContent>
    </Card>
  );
};
