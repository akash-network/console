"use client";
import { Avatar, AvatarFallback, AvatarImage, Badge, cardClasses, CardContent, CardHeader } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { FireFlame, MediaImage, Rocket } from "iconoir-react";
import Link from "next/link";

import type { TemplateOutputSummaryWithCategory } from "@src/queries/useTemplateQuery";
import { UrlService } from "@src/utils/urlUtils";

type Props = {
  template: TemplateOutputSummaryWithCategory;
  linkHref?: string;
  children?: React.ReactNode;
  isRecommended?: boolean;
  isPopular?: boolean;
};

export const TemplateBox: React.FunctionComponent<Props> = ({ template, linkHref, isRecommended, isPopular }) => {
  return (
    <Link
      className={cn(cardClasses, "min-h-[100px] cursor-pointer !no-underline hover:bg-secondary/60 dark:hover:bg-secondary/30")}
      href={linkHref ? linkHref : UrlService.templateDetails(template.id as string)}
      prefetch={false}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <Avatar className="h-10 w-10">
            <AvatarImage src={template.logoUrl || undefined} alt={template.name} className="object-contain" />
            <AvatarFallback>
              <MediaImage />
            </AvatarFallback>
          </Avatar>

          {isRecommended && (
            <Badge className="gap-1 px-1.5 py-0.5 text-[10px]">
              <Rocket className="h-2.5 w-2.5" /> Recommended
            </Badge>
          )}
          {isPopular && !isRecommended && (
            <Badge variant="outline" className="gap-1 border-orange-500/50 px-1.5 py-0.5 text-[10px] text-orange-500">
              <FireFlame className="h-2.5 w-2.5" /> Popular
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="mt-0 pt-0">
        <div className="mb-2 truncate font-bold tracking-tight">{template.name}</div>
        <p className="line-clamp-2 text-xs text-muted-foreground">{template.summary}</p>
      </CardContent>
    </Link>
  );
};
