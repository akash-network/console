import type { FC } from "react";
import { useMemo } from "react";
import { Badge, LoadingButton } from "@akashnetwork/ui/components";
import { BookmarkIcon } from "lucide-react";
import Link from "next/link";

import type { ServiceType } from "@src/types";
import type { TemplateMode } from "../../useDeploymentFlow/deploymentIntent";
import { countOf, summarizeTemplateServices } from "../templateServicesSummary";

type Props = {
  mode: TemplateMode;
  /** The deployment the template is saved from, which the banner names and links back to. */
  source?: { name: string; href: string };
  services: ServiceType[];
  askedCount: number;
  isSaving: boolean;
  canSave?: boolean;
  onSave: () => void;
};

export const ConfigureTemplateHeader: FC<Props> = ({ mode, source, services, askedCount, isSaving, canSave = true, onSave }) => {
  const templateSummary = useMemo(() => {
    const { serviceCount, resources } = summarizeTemplateServices(services);
    return `${serviceCount} · ${resources}`;
  }, [services]);

  return (
    <header>
      {source && (
        <div className="flex items-center justify-between gap-4 border-b border-blue-200 bg-blue-50 px-6 py-2.5 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100">
          <p className="flex items-center gap-2">
            <BookmarkIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              Saving <span className="font-semibold">{source.name}</span> as a template. Bids and pricing are hidden.
            </span>
          </p>
          <Link href={source.href} className="font-semibold hover:underline">
            Back to deployment
          </Link>
        </div>
      )}
      <div className="flex flex-wrap items-end justify-between gap-6 px-6 pt-6">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Configure your template</h1>
            <Badge variant="outline" className="gap-1 border-blue-300 text-blue-700 dark:border-blue-800 dark:text-blue-300">
              <BookmarkIcon className="h-3 w-3" aria-hidden="true" />
              Template mode
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Turn on <span className="font-medium text-foreground">Ask the deployer</span> for values each person should fill in.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <Stat label="Your template" value={templateSummary} />
          <Stat label="Asked to the deployer" value={countOf(askedCount, "value", "values")} />
          <LoadingButton type="button" className="gap-2" loading={isSaving} disabled={isSaving || !canSave} onClick={onSave}>
            <BookmarkIcon className="h-4 w-4" aria-hidden="true" />
            {mode === "edit" ? "Save new version" : "Save template"}
          </LoadingButton>
        </div>
      </div>
    </header>
  );
};

const Stat: FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="flex flex-col gap-1">
    <span className="font-mono text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
    <span className="font-mono text-base font-medium">{value}</span>
  </div>
);
