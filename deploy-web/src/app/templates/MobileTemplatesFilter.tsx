"use client";
import Drawer from "@mui/material/Drawer";
import React, { ReactNode } from "react";
import { ApiTemplate } from "@src/types";
import { Button, buttonVariants } from "@src/components/ui/button";
import { Xmark } from "iconoir-react";
import { cn } from "@src/utils/styleUtils";

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
      <div className="flex items-center justify-between">
        <p className="p-2 text-lg">Filter Templates</p>

        <Button onClick={handleDrawerToggle} variant="ghost" className="mr-2">
          <Xmark className="text-sm" />
        </Button>
      </div>

      <ul className="overflow-y-scroll">
        {templates && (
          <li
            className={cn({ ["bg-muted/20"]: !selectedCategoryTitle }, buttonVariants({ variant: "ghost" }), "px-4 py-2")}
            onClick={() => onCategoryClick(null)}
          >
            <p>All (${templates.length - 1})</p>
          </li>
        )}

        {categories
          .sort((a, b) => (a.title < b.title ? -1 : 1))
          .map(category => (
            <li
              key={category.title}
              onClick={() => onCategoryClick(category.title)}
              className={cn({ ["bg-muted/20"]: category.title === selectedCategoryTitle }, buttonVariants({ variant: "ghost" }), "px-4 py-2")}
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
