"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnboardingStepper = void 0;
var react_1 = require("react");
var Stepper_1 = require("@src/components/shared/Stepper");
var OnboardingStepper = function (_a) {
    var steps = _a.steps, currentStep = _a.currentStep, _b = _a.className, className = _b === void 0 ? "" : _b;
    var currentStepData = steps[currentStep];
    var stepperSteps = steps.map(function (step, _index) { return ({
        id: step.id,
        name: step.title,
        description: step.description
    }); });
    return (<div className={"mx-auto max-w-4xl ".concat(className)}>
      <div className="mb-8">
        <Stepper_1.Stepper steps={stepperSteps} activeStep={currentStep} clickable={false} showArrows={false}/>
      </div>

      {(currentStepData === null || currentStepData === void 0 ? void 0 : currentStepData.component) && <div className="mb-8">{currentStepData.component}</div>}
    </div>);
};
exports.OnboardingStepper = OnboardingStepper;
