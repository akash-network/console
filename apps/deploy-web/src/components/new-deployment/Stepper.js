"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomizedSteppers = void 0;
var react_1 = require("react");
var navigation_1 = require("next/navigation");
var Stepper_1 = require("@src/components/shared/Stepper");
var route_steps_type_1 = require("@src/types/route-steps.type");
var urlUtils_1 = require("@src/utils/urlUtils");
var steps = [
    { id: 0, name: "Choose Template" },
    { id: 1, name: "Create Deployment" },
    { id: 2, name: "Choose providers" }
];
var CustomizedSteppers = function (_a) {
    var activeStep = _a.activeStep;
    var router = (0, navigation_1.useRouter)();
    var handleStepClick = function (step, _index) {
        if (step.id === 0) {
            router.replace(urlUtils_1.UrlService.newDeployment({ step: route_steps_type_1.RouteStep.chooseTemplate }));
        }
    };
    return <Stepper_1.Stepper steps={steps} activeStep={activeStep} onStepClick={handleStepClick} clickable={true}/>;
};
exports.CustomizedSteppers = CustomizedSteppers;
