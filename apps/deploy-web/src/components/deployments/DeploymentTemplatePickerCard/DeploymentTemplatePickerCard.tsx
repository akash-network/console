"use client";

import { Badge, Button } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import { ArrowRight, Lock } from "iconoir-react";
import Image from "next/image";

type DeploymentTemplatePickerCard = {
  chip: string;
  title: string;
  description: string;
  priceBold: string;
  priceRest: string;
  ctaLabel: string;
  ctaVariant?: "primary" | "outline";
  ctaIcon?: "arrow" | "lock";
  heroImageSrc: string;
  heroImageAlt: string;
  heroNoiseOverlaySrc?: string;
  heroBackgroundClassName?: string;
  recommended?: boolean;
  disabled?: boolean;
  onDeploy?: () => void;
};

export function DeploymentTemplatePickerCard({
  chip,
  title,
  description,
  priceBold,
  priceRest,
  ctaLabel,
  ctaVariant = "outline",
  ctaIcon = "arrow",
  heroImageSrc,
  heroImageAlt,
  heroNoiseOverlaySrc,
  heroBackgroundClassName,
  recommended = false,
  disabled = false,
  onDeploy
}: DeploymentTemplatePickerCard) {
  const Icon = ctaIcon === "lock" ? Lock : ArrowRight;

  return (
    <div
      className={cn(
        "relative z-50 flex flex-col rounded-xl transition-[filter] duration-200",
        "hover:drop-shadow-[0_0_6px_rgba(0,166,255,0.25)] dark:hover:drop-shadow-[0_0_8px_rgba(0,166,255,0.4)]"
      )}
    >
      {recommended && (
        <Badge
          variant="info"
          className="absolute -top-2 left-4 z-10 rounded-md border border-blue-500 bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-500 hover:bg-blue-50"
        >
          Recommended for new users
        </Badge>
      )}

      <div className={cn("relative h-40 w-full overflow-hidden rounded-t-xl border border-b-0 border-border", heroBackgroundClassName)}>
        <Image src={heroImageSrc} alt={heroImageAlt} fill className="scale-110 object-cover" sizes="(min-width: 768px) 33vw, 100vw" priority={recommended} />
        {heroNoiseOverlaySrc && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.13] mix-blend-overlay"
            style={{ backgroundImage: `url('${heroNoiseOverlaySrc}')`, backgroundSize: "470px 470px" }}
          />
        )}
      </div>

      <div className="flex flex-col gap-4 rounded-b-xl border border-border bg-card p-4">
        <div className="flex flex-col gap-4">
          <div className="self-start">
            <span className="inline-flex items-center rounded-md border border-input bg-background px-2 py-0.5 text-[11px] leading-4 text-muted-foreground">
              {chip}
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <h3 className="truncate text-2xl leading-8 text-card-foreground">{title}</h3>
            <p className="line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">{description}</p>
          </div>

          <p className="font-mono text-xs leading-5 text-muted-foreground">
            <span className="font-bold">{priceBold}</span>
            <span>{priceRest}</span>
          </p>
        </div>

        <Button variant={ctaVariant === "primary" ? "default" : "outline"} disabled={disabled} className="w-full gap-2" onClick={onDeploy}>
          <span>{ctaLabel}</span>
          <Icon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
