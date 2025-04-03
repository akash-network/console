"use client";
import { cardClasses, CardContent, CardHeader } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import Link from "next/link";

import { getShortText } from "@src/hooks/useShortText";
import type { ITemplate } from "@src/types";
import { UrlService } from "@src/utils/urlUtils";

type Props = {
  template: Partial<ITemplate>;
  onClick?: () => void;
};

export const TemplateGridButton: React.FunctionComponent<Props> = ({ template, onClick }) => {
  return (
    <Link
      className={cn(cardClasses, "min-h-[100px] cursor-pointer !no-underline hover:bg-secondary/60 dark:hover:bg-secondary/30")}
      href={UrlService.template(template.id as string)}
      onClick={onClick}
    >
      <CardHeader>
        <div className="flex items-center">
          <div className="break-all font-bold">{template.title}</div>
        </div>
      </CardHeader>
      <CardContent className="pb-4 pt-0">
        <p className="text-sm text-muted-foreground">{getShortText(template.description || "", 50)}</p>
      </CardContent>
    </Link>
  );
};
