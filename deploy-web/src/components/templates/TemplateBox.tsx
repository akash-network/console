"use client";
import { ApiTemplate } from "@src/types";
import Link from "next/link";
import { UrlService } from "@src/utils/urlUtils";
import { getShortText } from "@src/utils/stringUtils";
import { CardContent, CardHeader, cardClasses } from "../ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { MediaImage } from "iconoir-react";
import { cn } from "@src/utils/styleUtils";

type Props = {
  template: ApiTemplate;
  linkHref?: string;
  children?: React.ReactNode;
};

export const TemplateBox: React.FunctionComponent<Props> = ({ template, linkHref }) => {
  return (
    <Link
      className={cn(cardClasses, "min-h-[100px] cursor-pointer !no-underline hover:bg-primary/10")}
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

          <div className="ml-4 font-bold">{template.name}</div>
        </div>
      </CardHeader>
      <CardContent className="pb-4 pt-0">
        <p className="text-sm text-muted-foreground">{getShortText(template.summary, 128)}</p>
      </CardContent>
    </Link>
  );
};
