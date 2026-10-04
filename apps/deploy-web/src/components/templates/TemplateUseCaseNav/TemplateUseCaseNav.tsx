"use client";
import type { FC } from "react";
import { cn } from "@akashnetwork/ui/utils";
import type { LucideIcon } from "lucide-react";
import {
  Atom,
  BadgeCheck,
  Blocks,
  Box,
  Brain,
  Briefcase,
  ChartColumn,
  Code,
  Coins,
  Cpu,
  Database,
  Gamepad2,
  Gauge,
  Globe,
  HardDrive,
  LayoutGrid,
  MessageSquare,
  Network,
  Newspaper,
  Pickaxe,
  Search,
  Server,
  Share2,
  Sparkles,
  SquareKanban,
  Users,
  Video,
  Wallet,
  Workflow,
  Wrench
} from "lucide-react";

import type { UseCaseFilter } from "../templateGalleryModel";

/** Keyed by the category titles the template list serves today; a title missing here, such as a new category, gets the generic box. */
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  "AI - GPU": Sparkles,
  "AI - CPU": Cpu,
  "Machine Learning": Brain,
  "Databases and Administration": Database,
  "CI/CD, DevOps": Workflow,
  Blogging: Newspaper,
  Business: Briefcase,
  Chat: MessageSquare,
  "Data Visualization": ChartColumn,
  "Game Servers": Server,
  Games: Gamepad2,
  Hosting: Globe,
  Social: Users,
  "Decentralized Storage": HardDrive,
  Tools: Wrench,
  Benchmarking: Gauge,
  Blockchain: Blocks,
  "Built with Cosmos-SDK": Atom,
  DeFi: Coins,
  "Mining - CPU": Pickaxe,
  "Mining - GPU": Pickaxe,
  "Mining Pools": Pickaxe,
  Network: Network,
  Official: BadgeCheck,
  "Peer-to-peer File Sharing": Share2,
  "Project Management": SquareKanban,
  "Search Engines": Search,
  "Video Conferencing": Video,
  Wallet: Wallet,
  "Web Frameworks": Code
};

export interface TemplateUseCaseNavProps {
  filters: UseCaseFilter[];
  selectedCategory: string | null;
  onSelect: (category: string | null) => void;
  className?: string;
}

export const TemplateUseCaseNav: FC<TemplateUseCaseNavProps> = ({ filters, selectedCategory, onSelect, className }) => (
  <ul className={cn("flex flex-col gap-0.5", className)}>
    {filters.map(filter => {
      const Icon = filter.category === null ? LayoutGrid : CATEGORY_ICONS[filter.category] ?? Box;
      const isSelected = filter.category === selectedCategory;

      return (
        <li key={filter.label}>
          <button
            type="button"
            aria-current={isSelected ? "true" : undefined}
            onClick={() => onSelect(filter.category)}
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium transition-colors hover:bg-muted",
              isSelected ? "bg-muted text-foreground" : "text-muted-foreground"
            )}
          >
            <Icon className="h-[15px] w-[15px] shrink-0" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">{filter.label}</span>
            <span className="font-mono text-[11px] text-muted-foreground">{filter.count}</span>
          </button>
        </li>
      );
    })}
  </ul>
);
