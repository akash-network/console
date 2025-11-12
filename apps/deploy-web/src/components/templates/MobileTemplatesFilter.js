"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MobileTemplatesFilter = void 0;
var react_1 = require("react");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var Drawer_1 = require("@mui/material/Drawer");
var iconoir_react_1 = require("iconoir-react");
var MobileTemplatesFilter = function (_a) {
    var _b;
    var isOpen = _a.isOpen, handleDrawerToggle = _a.handleDrawerToggle, templates = _a.templates, categories = _a.categories, selectedCategoryTitle = _a.selectedCategoryTitle, onCategoryClick = _a.onCategoryClick;
    return (<Drawer_1.default anchor="bottom" variant="temporary" open={isOpen} onClose={handleDrawerToggle} ModalProps={{
            keepMounted: true // Better open performance on mobile.
        }} sx={{
            "& .MuiDrawer-paper": { boxSizing: "border-box", overflow: "hidden", maxHeight: "60%", wdith: "100%" }
        }} PaperProps={{
            sx: {
                border: "none"
            }
        }}>
      <div className="flex items-center justify-between py-2">
        <p className="p-2 text-xl font-bold">Filter Templates</p>

        <components_1.Button onClick={handleDrawerToggle} variant="ghost">
          <iconoir_react_1.Xmark className="text-sm"/>
        </components_1.Button>
      </div>

      <ul className="flex flex-col items-center overflow-y-scroll">
        {templates && (<li className={(0, utils_1.cn)((_b = {}, _b["bg-muted-foreground/10"] = !selectedCategoryTitle, _b), (0, components_1.buttonVariants)({ variant: "ghost" }), "flex w-full items-center justify-start p-4")} onClick={function () { return onCategoryClick(null); }}>
            <p>
              All <small>({templates.length - 1})</small>
            </p>
          </li>)}

        {categories
            .sort(function (a, b) { return (a.title < b.title ? -1 : 1); })
            .map(function (category) {
            var _a;
            return (<li key={category.title} onClick={function () { return onCategoryClick(category.title); }} className={(0, utils_1.cn)((_a = {}, _a["bg-muted-foreground/10"] = category.title === selectedCategoryTitle, _a), (0, components_1.buttonVariants)({ variant: "ghost" }), "flex w-full items-center justify-start p-4")}>
              <p>
                {category.title} <small>({category.templates.length})</small>
              </p>
            </li>);
        })}
      </ul>
    </Drawer_1.default>);
};
exports.MobileTemplatesFilter = MobileTemplatesFilter;
