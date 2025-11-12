"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiKeyDocsBanner = ApiKeyDocsBanner;
var components_1 = require("@akashnetwork/ui/components");
var iconoir_react_1 = require("iconoir-react");
var ExternalLink_1 = require("@src/components/shared/ExternalLink");
function ApiKeyDocsBanner() {
    return (<components_1.Alert variant="default" className="border-primary/30 bg-primary/5">
      <iconoir_react_1.Book className="h-5 w-5 text-primary"/>
      <components_1.AlertTitle className="text-base font-semibold text-primary">Learn How to Use Your API Keys</components_1.AlertTitle>
      <components_1.AlertDescription>
        <p className="mb-2 text-muted-foreground">
          Discover how to integrate the Akash API into your applications. Our comprehensive documentation covers authentication, creating deployments, managing
          resources, and more.
        </p>
        <ExternalLink_1.ExternalLink href="https://github.com/akash-network/console/wiki/Managed-wallet-API" text="View API Documentation"/>
      </components_1.AlertDescription>
    </components_1.Alert>);
}
