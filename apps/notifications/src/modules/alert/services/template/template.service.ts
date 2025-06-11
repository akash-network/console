import { Injectable } from "@nestjs/common";
import Handlebars from "handlebars";

Handlebars.registerHelper("eq", function (a, b) {
  return a === b;
});

@Injectable()
export class TemplateService {
  interpolate(template: string, context: object): string {
    return Handlebars.compile(template)(context);
  }
}
