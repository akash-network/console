"use client";
import { Card, CardContent } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";

export function FormPaper({ children, className = "", contentClassName = "" }: React.PropsWithChildren<{ className?: string; contentClassName?: string }>) {
  return (
    <Card className={cn(className, "bg-background/30")}>
      <CardContent className={cn("px-4 py-4", contentClassName)}>{children}</CardContent>
    </Card>
  );
}
