"use client";
import { cn } from "@src/utils/styleUtils";
import { Card, CardContent } from "../ui/card";

export function FormPaper({ children, className = "" }: React.PropsWithChildren<{ className?: string }>) {
  return (
    <Card className="bg-background/30">
      <CardContent className={cn("px-4 py-4", className)}>{children}</CardContent>
    </Card>
  );
}
