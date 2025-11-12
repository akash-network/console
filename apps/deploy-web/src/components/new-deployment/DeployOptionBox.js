"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeployOptionBox = void 0;
var components_1 = require("@akashnetwork/ui/components");
var image_1 = require("next/image");
var next_themes_1 = require("next-themes");
var DeployOptionBox = function (_a) {
    var title = _a.title, description = _a.description, topIcons = _a.topIcons, bottomIcons = _a.bottomIcons, onClick = _a.onClick, testId = _a.testId;
    var resolvedTheme = (0, next_themes_1.useTheme)().resolvedTheme;
    var getIconSrc = function (icon) {
        if (typeof icon === "string")
            return icon;
        return resolvedTheme === "dark" ? icon.dark : icon.light;
    };
    return (<components_1.Card className="min-h-[100px] cursor-pointer text-center hover:bg-secondary/60 dark:hover:bg-secondary/30" onClick={onClick} data-testid={testId}>
      <components_1.CardHeader className="pb-2">
        <div className="mb-2 flex items-center justify-center">
          <div className="flex items-center space-x-2 rounded-sm bg-secondary p-1">
            {topIcons === null || topIcons === void 0 ? void 0 : topIcons.map(function (icon, index) { return (<image_1.default src={getIconSrc(icon)} alt="icon" width={28} height={28} key={index} className="max-h-[28px] object-contain"/>); })}
          </div>
        </div>
        <div className="text-xl font-bold tracking-tight">{title}</div>
      </components_1.CardHeader>
      <components_1.CardContent>
        <p className="mx-auto max-w-[200px] text-sm text-muted-foreground">{description}</p>
      </components_1.CardContent>

      <components_1.CardFooter className="flex justify-center">
        <div className="flex items-center space-x-1 px-2 py-1">
          {bottomIcons === null || bottomIcons === void 0 ? void 0 : bottomIcons.map(function (icon, index) { return (<div key={index} className="rounded-sm border px-2 py-1 dark:bg-secondary">
              <image_1.default src={getIconSrc(icon)} alt="icon" width={24} height={24} className="max-h-[24px] object-contain"/>
            </div>); })}
        </div>
      </components_1.CardFooter>
    </components_1.Card>);
};
exports.DeployOptionBox = DeployOptionBox;
