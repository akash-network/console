import { Injectable } from "@nestjs/common";
import Handlebars from "handlebars";

Handlebars.registerHelper("eq", function (a, b) {
  return a === b;
});

const DENOM_LABELS: Record<string, string> = {
  uakt: "AKT",
  uact: "ACT"
};

Handlebars.registerHelper("denomLabel", function (denom: unknown) {
  if (typeof denom !== "string") {
    return "";
  }

  return DENOM_LABELS[denom] ?? denom;
});

Handlebars.registerHelper("udenomToDenom", function (amount: unknown, precision?: unknown) {
  const parsedAmount = typeof amount === "string" ? parseFloat(amount) : Number(amount);

  if (isNaN(parsedAmount)) {
    return "";
  }

  const parsedPrecision = typeof precision === "number" ? precision : 6;
  const multiplier = Math.pow(10, parsedPrecision);

  return String(Math.round((parsedAmount / 1_000_000 + Number.EPSILON) * multiplier) / multiplier);
});

@Injectable()
export class TemplateService {
  interpolate(template: string, context: object): string {
    return Handlebars.compile(template)(context);
  }
}
