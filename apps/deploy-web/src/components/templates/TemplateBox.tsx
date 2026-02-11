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
        <div className="flex items-center">
          <Avatar className="h-10 w-10">
            <AvatarImage src={template.logoUrl || undefined} alt={template.name} className="object-contain" />
            <AvatarFallback>
              <MediaImage />
            </AvatarFallback>
          </Avatar>

          <div className="ml-4 min-w-0 flex-1 font-bold tracking-tight">
            <div className="truncate text-nowrap">{template.name}</div>
          </div>
          {isRecommended && (
            <Badge className="ml-2 shrink-0 gap-1">
              <Rocket className="h-3 w-3" /> Recommended
            </Badge>
          )}
          {isPopular && !isRecommended && (
            <Badge variant="secondary" className="ml-2 shrink-0 gap-1">
              <FireFlame className="h-3 w-3" /> Popular
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <p className="line-clamp-2 text-xs text-muted-foreground">{template.summary}</p>
      </CardContent>
    </Link>
  );
};
