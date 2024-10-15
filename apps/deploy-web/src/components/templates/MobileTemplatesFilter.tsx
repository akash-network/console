"use client";
import React, { ReactNode } from "react";
import { Button, buttonVariants } from "@akashnetwork/ui/components";
import Drawer from "@mui/material/Drawer";
import { Xmark } from "iconoir-react";

import { ApiTemplate } from "@src/types";
import { cn } from "@akashnetwork/ui/utils";

type Props = {
  children?: ReactNode;
  isOpen: boolean;
  handleDrawerToggle: () => void;
  categories: Array<{ title: string; templates: Array<ApiTemplate> }>;
  templates: Array<ApiTemplate>;
  selectedCategoryTitle: string | null;
  onCategoryClick: (categoryTitle: string | null) => void;
};

export const MobileTemplatesFilter: React.FunctionComponent<Props> = ({
  isOpen,
  handleDrawerToggle,
  templates,
  categories,
  selectedCategoryTitle,
  onCategoryClick
}) => {
  return (
    <Drawer
      anchor="bottom"
      variant="temporary"
      open={isOpen}
      onClose={handleDrawerToggle}
      ModalProps={{
        keepMounted: true // Better open performance on mobile.
      }}
      sx={{
        "& .MuiDrawer-paper": { boxSizing: "border-box", overflow: "hidden", maxHeight: `60%`, wdith: "100%" }
      }}
      PaperProps={{
        sx: {
          border: "none"
        }
      }}
    >
      <div className="flex items-center justify-between py-2">
        <p className="p-2 text-xl font-bold">Filter Templates</p>

        <Button onClick={handleDrawerToggle} variant="ghost">
          <Xmark className="text-sm" />
        </Button>
      </div>

      <ul className="flex flex-col items-center overflow-y-scroll">
        {templates && (
          <li
            className={cn(
              { ["bg-muted-foreground/10"]: !selectedCategoryTitle },
              buttonVariants({ variant: "ghost" }),
              "flex w-full items-center justify-start p-4"
            )}
            onClick={() => onCategoryClick(null)}
          >
            <p>
              All <small>({templates.length - 1})</small>
            </p>
          </li>
        )}

        {categories
          .sort((a, b) => (a.title < b.title ? -1 : 1))
          .map(category => (
            <li
              key={category.title}
              onClick={() => onCategoryClick(category.title)}
              className={cn(
                { ["bg-muted-foreground/10"]: category.title === selectedCategoryTitle },
                buttonVariants({ variant: "ghost" }),
                "flex w-full items-center justify-start p-4"
              )}
            >
              <p>
                {category.title} <small>({category.templates.length})</small>
              </p>
            </li>
          ))}
      </ul>
    </Drawer>
  );
};
