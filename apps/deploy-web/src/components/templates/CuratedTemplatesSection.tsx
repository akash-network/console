"use client";
import { useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";

import type { TemplateOutputSummaryWithCategory } from "@src/queries/useTemplateQuery";
import { TemplateBox } from "./TemplateBox";

const recommendedTemplateIds = [
  "akash-network-awesome-akash-openclaw",
  "akash-network-awesome-akash-comfyui",
  "akash-network-awesome-akash-DeepSeek-V3.1",
  "akash-network-awesome-akash-DeepSeek-R1"
];

const mostPopularTemplateIds = [
  "akash-network-awesome-akash-openclaw",
  "akash-network-awesome-akash-ssh-ubuntu",
  "akash-network-awesome-akash-comfyui",
  "akash-network-awesome-akash-DeepSeek-V3.1"
];

type CuratedTemplatesSectionProps = {
  templates: TemplateOutputSummaryWithCategory[];
  onViewAllClick: () => void;
};

export const CuratedTemplatesSection: React.FunctionComponent<CuratedTemplatesSectionProps> = ({ templates, onViewAllClick }) => {
  const [activeTab, setActiveTab] = useState("recommended");

  const curatedTemplates = useMemo(() => {
    const ids = activeTab === "recommended" ? recommendedTemplateIds : mostPopularTemplateIds;
    return ids.map(id => templates.find(t => t.id === id)).filter((t): t is TemplateOutputSummaryWithCategory => t !== undefined);
  }, [activeTab, templates]);

  if (curatedTemplates.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <div className="mb-4 flex items-center justify-between">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="recommended" className={cn({ ["font-bold"]: activeTab === "recommended" })}>
              Recommended
            </TabsTrigger>
            <TabsTrigger value="most-popular" className={cn({ ["font-bold"]: activeTab === "most-popular" })}>
              Most Popular
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <button onClick={onViewAllClick} className="text-sm text-primary hover:underline">
          View All Templates &darr;
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {curatedTemplates.map(template => (
          <TemplateBox key={template.id} template={template} />
        ))}
      </div>
    </div>
  );
};
