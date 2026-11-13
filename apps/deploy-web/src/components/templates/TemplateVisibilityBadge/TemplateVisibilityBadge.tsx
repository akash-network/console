import type { FC } from "react";
import type { LucideIcon } from "lucide-react";
import { Building2, Folder, Globe } from "lucide-react";

import type { TemplateVisibility } from "@src/types/marketplace-template";

export const VISIBILITY_LABELS: Record<TemplateVisibility, string> = { private: "Private", organization: "Organization", public: "Public" };

const VISIBILITY_ICONS: Record<TemplateVisibility, LucideIcon> = { private: Folder, organization: Building2, public: Globe };

export const TemplateVisibilityBadge: FC<{ visibility: TemplateVisibility }> = ({ visibility }) => {
  const Icon = VISIBILITY_ICONS[visibility];

  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-0.5 text-xs font-medium">
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {VISIBILITY_LABELS[visibility]}
    </span>
  );
};
