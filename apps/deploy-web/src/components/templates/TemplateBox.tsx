"use client";
import { Avatar, AvatarFallback, AvatarImage, cardClasses, CardContent, CardHeader } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { MediaImage } from "iconoir-react";
import Link from "next/link";

import type { TemplateOutputSummaryWithCategory } from "@src/queries/useTemplateQuery";
import { getShortText } from "@src/utils/stringUtils";
import { UrlService } from "@src/utils/urlUtils";

type Props = {
  template: TemplateOutputSummaryWithCategory;
  linkHref?: string;
  children?: React.ReactNode;
};

export const TemplateBox: React.FunctionComponent<Props> = ({ template, linkHref }) => {
  return (
    <Link
      className={cn(cardClasses, "min-h-[100px] cursor-pointer !no-underline hover:bg-secondary/60 dark:hover:bg-secondary/30")}
      href={linkHref ? linkHref : UrlService.templateDetails(template.id as string)}
    >
      <CardHeader>
        <div className="flex items-center">
          <Avatar className="h-10 w-10">
            <AvatarImage src={template.logoUrl || undefined} alt={template.name} className="object-contain" />
            <AvatarFallback>
              <MediaImage />
            </AvatarFallback>
          </Avatar>

          <div className="ml-4 truncate text-nowrap font-bold tracking-tight">{template.name}</div>
        </div>
      </CardHeader>
      <CardContent className="pb-4 pt-0">
        <p className="text-xs text-muted-foreground">{getShortText(template.summary, 80)}</p>
      </CardContent>
    </Link>
  );
};
