"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateGridButton = void 0;
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var link_1 = require("next/link");
var useShortText_1 = require("@src/hooks/useShortText");
var urlUtils_1 = require("@src/utils/urlUtils");
var TemplateGridButton = function (_a) {
    var template = _a.template, onClick = _a.onClick;
    return (<link_1.default className={(0, utils_1.cn)(components_1.cardClasses, "min-h-[100px] cursor-pointer !no-underline hover:bg-secondary/60 dark:hover:bg-secondary/30")} href={urlUtils_1.UrlService.template(template.id)} onClick={onClick}>
      <components_1.CardHeader>
        <div className="flex items-center">
          <div className="break-all font-bold">{template.title}</div>
        </div>
      </components_1.CardHeader>
      <components_1.CardContent className="pb-4 pt-0">
        <p className="text-sm text-muted-foreground">{(0, useShortText_1.getShortText)(template.description || "", 50)}</p>
      </components_1.CardContent>
    </link_1.default>);
};
exports.TemplateGridButton = TemplateGridButton;
