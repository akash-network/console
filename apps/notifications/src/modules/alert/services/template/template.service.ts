import { Injectable } from "@nestjs/common";
import Handlebars from "handlebars";

Handlebars.registerHelper("eq", function (a, b) {
  return a === b;
});

const DENOM_LABELS: Record<string, string> = {
  uakt: "AKT",
  uact: "ACT"
};

const numberFormatter = new Intl.NumberFormat("en-US");

Handlebars.registerHelper("formatBalance", function (amount: unknown, denom: unknown, precision?: unknown) {
  const parsedAmount = typeof amount === "string" ? parseFloat(amount) : Number(amount);

  if (isNaN(parsedAmount)) {
    return "";
  }

  const parsedPrecision = typeof precision === "number" ? precision : 6;
  const multiplier = Math.pow(10, parsedPrecision);
  const converted = Math.round((parsedAmount / 1_000_000 + Number.EPSILON) * multiplier) / multiplier;
  const label = typeof denom === "string" ? DENOM_LABELS[denom] ?? denom : "";

  return `${numberFormatter.format(converted)} ${label}`.trim();
});

@Injectable()
export class TemplateService {
  interpolate(template: string, context: object): string {
    return Handlebars.compile(template)(context);
  }
}
