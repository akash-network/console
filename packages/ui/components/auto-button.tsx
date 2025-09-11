"use client";
import "./auto-button.css";

import React, { useEffect, useState } from "react";
import { cn } from "@akashnetwork/ui/utils";

import { buttonVariants } from "./button";
import { Button } from "./button";

type AutoButtonProps = {
  onClick: () => void;
  text: string | React.ReactNode;
  timeout: number;
};

export const AutoButton = ({ onClick, text, timeout }: AutoButtonProps) => {
  const [started, setStarted] = useState(false);

  useEffect(() => {
    setStarted(true);
    setTimeout(onClick, timeout);
  }, [onClick, timeout]);

  return (
    <div className="pt-6">
      <Button
        className={cn(buttonVariants({ variant: "default" }), "auto-button inline-flex items-center", { started: started })}
        onClick={onClick}
        style={{ ["--timeout" as string]: `${timeout}ms` }}
      >
        {text}
      </Button>
    </div>
  );
};
