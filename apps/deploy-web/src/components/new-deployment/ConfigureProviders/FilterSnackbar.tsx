"use client";
import type { FC } from "react";
import { useEffect } from "react";
import { Button } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { Redo, Undo } from "iconoir-react";

type Props = {
  message: string;
  visible: boolean;
  action: "undo" | "redo" | null;
  onUndo: () => void;
  onRedo: () => void;
  onDismiss: () => void;
};

export const FilterSnackbar: FC<Props> = ({ message, visible, action, onUndo, onRedo, onDismiss }) => {
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [visible, onDismiss]);

  useEffect(() => {
    if (!visible) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [visible, onDismiss]);

  if (!visible) return null;

  return (
    <div
      className={cn("fixed bottom-20 left-1/2 z-50 -translate-x-1/2", "flex items-center gap-3 rounded-lg border border-border bg-popover px-4 py-3 shadow-lg")}
    >
      <span className="text-sm font-medium">{message}</span>
      {action === "undo" && (
        <Button variant="text" size="xs" onClick={onUndo} className="gap-1 text-destructive">
          <Undo className="h-3.5 w-3.5" />
          Undo
        </Button>
      )}
      {action === "redo" && (
        <Button variant="text" size="xs" onClick={onRedo} className="gap-1 text-destructive">
          <Redo className="h-3.5 w-3.5" />
          Redo
        </Button>
      )}
      <span className="text-[10px] text-muted-foreground">Press Esc to exit</span>
    </div>
  );
};
