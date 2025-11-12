"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageSelect = void 0;
var react_1 = require("react");
var react_hook_form_1 = require("react-hook-form");
var components_1 = require("@akashnetwork/ui/components");
var utils_1 = require("@akashnetwork/ui/utils");
var ClickAwayListener_1 = require("@mui/material/ClickAwayListener");
var InputAdornment_1 = require("@mui/material/InputAdornment");
var Popper_1 = require("@mui/material/Popper");
var styles_1 = require("@mui/material/styles");
var TextField_1 = require("@mui/material/TextField");
var iconoir_react_1 = require("iconoir-react");
var image_1 = require("next/image");
var link_1 = require("next/link");
var useGpuTemplates_1 = require("@src/hooks/useGpuTemplates");
var ImageSelect = function (_a) {
    var control = _a.control, currentService = _a.currentService, onSelectTemplate = _a.onSelectTemplate;
    var muiTheme = (0, styles_1.useTheme)();
    var gpuTemplates = (0, useGpuTemplates_1.useGpuTemplates)().gpuTemplates;
    var _b = (0, react_1.useState)(null), hoveredTemplate = _b[0], setHoveredTemplate = _b[1];
    var _c = (0, react_1.useState)(null), selectedTemplate = _c[0], setSelectedTemplate = _c[1];
    var _d = (0, react_1.useState)(null), popperWidth = _d[0], setPopperWidth = _d[1];
    var templateLiRefs = (0, react_1.useMemo)(function () {
        var map = new Map();
        gpuTemplates.forEach(function (template) {
            map.set(template.id, (0, react_1.createRef)());
        });
        return map;
    }, [gpuTemplates]);
    var textFieldRef = (0, react_1.useRef)(null);
    var _e = (0, react_1.useState)(null), anchorEl = _e[0], setAnchorEl = _e[1];
    var filteredGpuTemplates = gpuTemplates.filter(function (x) { var _a; return (_a = x.name) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(currentService.image); });
    var open = Boolean(anchorEl) && filteredGpuTemplates.length > 0;
    // Effect that scrolls active element when it changes
    (0, react_1.useLayoutEffect)(function () {
        var _a, _b;
        if (selectedTemplate) {
            (_b = (_a = templateLiRefs.get(selectedTemplate.id)) === null || _a === void 0 ? void 0 : _a.current) === null || _b === void 0 ? void 0 : _b.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
        }
    }, [gpuTemplates, selectedTemplate]);
    (0, react_1.useLayoutEffect)(function () {
        var _a;
        if (!popperWidth && textFieldRef.current) {
            setPopperWidth((_a = textFieldRef.current) === null || _a === void 0 ? void 0 : _a.offsetWidth);
        }
    }, [textFieldRef.current, popperWidth]);
    var handleClick = function (event) {
        setAnchorEl(event.currentTarget);
    };
    var handleKeyDown = function (event) {
        setAnchorEl(event.currentTarget);
        if (event.key === "Enter") {
            event.preventDefault();
            event.stopPropagation();
            if (selectedTemplate) {
                onSelectTemplate(selectedTemplate);
            }
            onClose();
        }
        if (event.key === "ArrowUp") {
            if (hoveredTemplate || selectedTemplate) {
                var index = filteredGpuTemplates.findIndex(function (x) { return x.id === (hoveredTemplate === null || hoveredTemplate === void 0 ? void 0 : hoveredTemplate.id) || x.id === (selectedTemplate === null || selectedTemplate === void 0 ? void 0 : selectedTemplate.id); });
                var newIndex = (index - 1 + filteredGpuTemplates.length) % filteredGpuTemplates.length;
                setSelectedTemplate(filteredGpuTemplates[newIndex]);
            }
            else {
                setSelectedTemplate(filteredGpuTemplates[filteredGpuTemplates.length - 1]);
            }
            setHoveredTemplate(null);
        }
        if (event.key === "ArrowDown") {
            if (hoveredTemplate || selectedTemplate) {
                var index = filteredGpuTemplates.findIndex(function (x) { return x.id === (hoveredTemplate === null || hoveredTemplate === void 0 ? void 0 : hoveredTemplate.id) || x.id === (selectedTemplate === null || selectedTemplate === void 0 ? void 0 : selectedTemplate.id); });
                var newIndex = (index + 1) % filteredGpuTemplates.length;
                setSelectedTemplate(filteredGpuTemplates[newIndex]);
            }
            else {
                setSelectedTemplate(filteredGpuTemplates[0]);
            }
            setHoveredTemplate(null);
        }
    };
    var _onSelectTemplate = function (template) {
        setAnchorEl(null);
        onSelectTemplate(template);
    };
    var onClose = function () {
        setAnchorEl(null);
        setSelectedTemplate(null);
        setHoveredTemplate(null);
    };
    return (<div className="flex w-full items-center">
      <ClickAwayListener_1.default onClickAway={onClose}>
        <div className="w-full">
          <react_hook_form_1.Controller control={control} name={"services.0.image"} render={function (_a) {
            var _b, _c;
            var field = _a.field, fieldState = _a.fieldState;
            return (<TextField_1.default type="text" variant="outlined" ref={textFieldRef} label={"Docker Image / OS"} placeholder="Example: mydockerimage:1.01" color="secondary" error={!!fieldState.error} helperText={(_b = fieldState.error) === null || _b === void 0 ? void 0 : _b.message} onClick={handleClick} onKeyDown={handleKeyDown} fullWidth size="small" value={field.value} onChange={function (event) { return field.onChange(event.target.value || ""); }} InputProps={{
                    startAdornment: (<InputAdornment_1.default position="start">
                      <image_1.default alt="Docker Logo" src="/images/docker.png" layout="fixed" quality={100} width={24} height={18} priority/>
                    </InputAdornment_1.default>),
                    endAdornment: (<InputAdornment_1.default position="end">
                      <link_1.default className={(0, utils_1.cn)((0, components_1.buttonVariants)({ variant: "text", size: "icon" }))} href={"https://hub.docker.com/search?q=".concat((_c = currentService.image) === null || _c === void 0 ? void 0 : _c.split(":")[0], "&type=image")} target="_blank">
                        <iconoir_react_1.OpenNewWindow className="text-xs"/>
                      </link_1.default>
                    </InputAdornment_1.default>)
                }}/>);
        }}/>

          <Popper_1.default id="test" open={open} placement="bottom-start" anchorEl={anchorEl} disablePortal sx={{ zIndex: 1000, width: "".concat(popperWidth, "px"), boxShadow: muiTheme.shadows[2] }} className="bg-popover" nonce={undefined} onResize={undefined} onResizeCapture={undefined}>
            <ul className="relative m-0 max-h-[40vh] list-none overflow-auto py-2">
              {filteredGpuTemplates.map(function (template, i) { return (<li className="MuiAutocomplete-option flex w-full cursor-pointer items-center justify-between px-4 py-2 text-sm hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800" ref={templateLiRefs.get(template.id)} key={"".concat(template.id, "-").concat(i)} onClick={function () { return _onSelectTemplate(template); }} onMouseOver={function () {
                setHoveredTemplate(template);
                setSelectedTemplate(null);
            }}>
                  {template.name}
                </li>); })}
            </ul>
          </Popper_1.default>
        </div>
      </ClickAwayListener_1.default>

      <components_1.CustomTooltip title={<>
            Docker image of the container.
            <br />
            <br />
            Best practices: avoid using :latest image tags as Akash Providers heavily cache images.
          </>}>
        <iconoir_react_1.InfoCircle className="ml-2 text-xs text-muted-foreground"/>
      </components_1.CustomTooltip>
    </div>);
};
exports.ImageSelect = ImageSelect;
