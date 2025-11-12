"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TemplateBox = void 0;
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var iconoir_react_1 = require("iconoir-react");
var link_1 = require("next/link");
var stringUtils_1 = require("@src/utils/stringUtils");
var urlUtils_1 = require("@src/utils/urlUtils");
var TemplateBox = function (_a) {
    var template = _a.template, linkHref = _a.linkHref;
    return (<link_1.default className={(0, utils_1.cn)(components_1.cardClasses, "min-h-[100px] cursor-pointer !no-underline hover:bg-secondary/60 dark:hover:bg-secondary/30")} href={linkHref ? linkHref : urlUtils_1.UrlService.templateDetails(template.id)} prefetch={false}>
      <components_1.CardHeader>
        <div className="flex items-center">
          <components_1.Avatar className="h-10 w-10">
            <components_1.AvatarImage src={template.logoUrl || undefined} alt={template.name} className="object-contain"/>
            <components_1.AvatarFallback>
              <iconoir_react_1.MediaImage />
            </components_1.AvatarFallback>
          </components_1.Avatar>

          <div className="ml-4 truncate text-nowrap font-bold tracking-tight">{template.name}</div>
        </div>
      </components_1.CardHeader>
      <components_1.CardContent className="pb-4 pt-0">
        <p className="text-xs text-muted-foreground">{(0, stringUtils_1.getShortText)(template.summary, 80)}</p>
      </components_1.CardContent>
    </link_1.default>);
};
exports.TemplateBox = TemplateBox;
