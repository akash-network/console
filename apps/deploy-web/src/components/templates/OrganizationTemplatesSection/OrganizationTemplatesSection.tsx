"use client";
import type { FC } from "react";
import { useId } from "react";
import Link from "next/link";

import { TemplateIcon } from "@src/components/templates/TemplateIcon/TemplateIcon";
import { useCustomUser } from "@src/hooks/useCustomUser";
import { useFlag } from "@src/hooks/useFlag";
import { useOrganizationTemplates } from "@src/queries/useUserTemplateQueries";
import type { UserTemplateListItem } from "@src/types/marketplace-template";
import { UrlService } from "@src/utils/urlUtils";

const OVERLINE_CLASSES = "font-mono text-[11px] font-medium uppercase leading-4 tracking-[0.08em] text-muted-foreground";

export const DEPENDENCIES = {
  useFlag,
  useCustomUser,
  useOrganizationTemplates,
  TemplateIcon
};

export const OrganizationTemplatesSection: FC<{ dependencies?: typeof DEPENDENCIES }> = ({ dependencies: d = DEPENDENCIES }) => {
  const headingId = useId();
  const isMarketplaceEnabled = d.useFlag("template_marketplace");
  const { user } = d.useCustomUser();
  const isEnabled = !!isMarketplaceEnabled && !!user;
  const { data: templates } = d.useOrganizationTemplates({ enabled: isEnabled });

  if (!isEnabled || !templates?.length) return null;

  return (
    <section aria-labelledby={headingId}>
      <h2 id={headingId} className={`${OVERLINE_CLASSES} pb-3 pt-2`}>
        Your organization
      </h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 min-[1400px]:grid-cols-3">
        {templates.map(template => (
          <OrganizationTemplateCard key={template.id} template={template} dependencies={d} />
        ))}
      </div>
    </section>
  );
};

const OrganizationTemplateCard: FC<{ template: UserTemplateListItem; dependencies: typeof DEPENDENCIES }> = ({ template, dependencies: d }) => (
  <Link
    href={UrlService.template(template.id)}
    prefetch={false}
    className="group flex flex-col gap-2 rounded-[14px] border border-border bg-card px-[18px] py-4 text-card-foreground !no-underline shadow-sm transition-[box-shadow,border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-blue-600/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  >
    <div className="flex items-center gap-2">
      <d.TemplateIcon icon={template.icon} className="h-4 w-4 shrink-0 text-muted-foreground" />
      <h3 className="min-w-0 flex-1 truncate text-base font-bold tracking-tight">{template.title}</h3>
      {template.currentVersion && <span className="font-mono text-xs text-muted-foreground">v{template.currentVersion.version}</span>}
    </div>
    <p className="line-clamp-2 min-h-[34px] break-words text-[12.5px] leading-[17px] text-muted-foreground">{template.summary}</p>
  </Link>
);
