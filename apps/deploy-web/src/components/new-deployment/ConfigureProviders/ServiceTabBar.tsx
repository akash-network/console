"use client";
import type { FC, KeyboardEvent } from "react";
import { useEffect, useRef, useState } from "react";
import { CustomTooltip } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { BinMinusIn, InfoCircle, Plus } from "iconoir-react";

import type { ServiceType } from "@src/types";

type Props = {
  services: ServiceType[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
  onRename: (index: number, name: string) => void;
};

export const ServiceTabBar: FC<Props> = ({ services, activeIndex, onSelect, onAdd, onRemove, onRename }) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingIndex !== null) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editingIndex]);

  const commitRename = (index: number) => {
    const value = inputRef.current?.value.trim().toLowerCase();
    if (value) {
      onRename(index, value);
    }
    setEditingIndex(null);
  };

  const handleKeyDown = (e: KeyboardEvent, index: number) => {
    if (e.key === "Enter") {
      commitRename(index);
    } else if (e.key === "Escape") {
      setEditingIndex(null);
    }
  };

  return (
    <div className="flex h-[52px] shrink-0 items-center gap-2 px-3">
      <div className="flex shrink-0 items-center gap-1.5">
        <span className="whitespace-nowrap text-sm font-medium text-foreground">Services</span>
        <CustomTooltip
          title={
            <p>
              Services are independent workloads in your deployment. Each service runs its own container and can be configured with its own image, resources,
              and placement.
            </p>
          }
        >
          <InfoCircle className="h-3.5 w-3.5 text-muted-foreground" />
        </CustomTooltip>
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {services.map((service, index) => {
          const isEditing = editingIndex === index;
          const label = service.title || `service-${index + 1}`;

          return (
            <div
              key={service.id ?? index}
              role="button"
              tabIndex={0}
              onClick={() => {
                if (!isEditing) onSelect(index);
              }}
              onDoubleClick={() => setEditingIndex(index)}
              className={cn(
                "group flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                index === activeIndex ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {isEditing ? (
                <input
                  ref={inputRef}
                  type="text"
                  defaultValue={label}
                  onBlur={() => commitRename(index)}
                  onKeyDown={e => handleKeyDown(e, index)}
                  className="w-[80px] bg-transparent text-xs font-medium outline-none"
                />
              ) : (
                <span className="max-w-[100px] truncate">{label}</span>
              )}
              {services.length > 1 && !isEditing && (
                <span
                  role="button"
                  onClick={e => {
                    e.stopPropagation();
                    onRemove(index);
                  }}
                  className="hidden rounded p-0.5 text-muted-foreground group-hover:inline-flex hover:bg-destructive/10 hover:text-destructive"
                >
                  <BinMinusIn className="h-3 w-3" />
                </span>
              )}
            </div>
          );
        })}
      </div>
      <button
        type="button"
        onClick={onAdd}
        className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Plus className="h-3 w-3" />
        <span>Add</span>
      </button>
    </div>
  );
};
