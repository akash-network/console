"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getServerSideProps = void 0;
var OnboardingPage_1 = require("@src/components/onboarding/OnboardingPage");
var defineServerSideProps_1 = require("@src/lib/nextjs/defineServerSideProps/defineServerSideProps");
exports.default = OnboardingPage_1.OnboardingPage;
exports.getServerSideProps = (0, defineServerSideProps_1.defineServerSideProps)({
    route: "/signup"
});
