"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.helloWorldManifest = void 0;
exports.helloWorldManifest = "\n  ---\n  version: \"2.0\"\n\n  services:\n    web:\n      image: baktun/hello-akash-world:1.0.0\n      expose:\n        - port: 3000\n          as: 80\n          to:\n            - global: true\n\n  profiles:\n    compute:\n      web:\n        resources:\n          cpu:\n            units: 0.5\n          memory:\n            size: 512Mi\n          storage:\n            size: 512Mi\n\n    placement:\n      dcloud:\n        pricing:\n          # The name of the service\n          web:\n            denom: uakt\n            amount: 10000\n\n  deployment:\n    web:\n      dcloud:\n        profile: web\n        count: 1\n\n"
    .trim()
    .replace(/^ {2}/gm, "");
