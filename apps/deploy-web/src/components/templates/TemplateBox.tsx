"use client";
import { Avatar, AvatarFallback, AvatarImage, cardClasses, CardContent, CardHeader } from "@akashnetwork/ui/components";
import { MediaImage } from "iconoir-react";
import Link from "next/link";

import { ApiTemplate } from "@src/types";
import { getShortText } from "@src/utils/stringUtils";
import { cn } from "@src/utils/styleUtils";
import { UrlService } from "@src/utils/urlUtils";

type Props = {
  template: ApiTemplate;
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
            <AvatarImage src={template.logoUrl} alt={template.name} />
            <AvatarFallback>
              <MediaImage />
            </AvatarFallback>
          </Avatar>

          <div className="ml-4 break-all font-bold tracking-tight">{template.name}</div>
        </div>
      </CardHeader>
      <CardContent className="pb-4 pt-0">
        <p className="text-xs text-muted-foreground">{getShortText(template.summary, 128)}</p>
      </CardContent>
    </Link>
  );
};
