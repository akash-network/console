"use strict";
"use client";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ImageCredentialsHost = void 0;
var components_1 = require("@akashnetwork/ui/components");
var supportedHosts = [
    { id: "docker.io", label: "Docker Hub" },
    { id: "ghcr.io", label: "GitHub Container Registry" }
];
var ImageCredentialsHost = function (_a) {
    var serviceIndex = _a.serviceIndex, control = _a.control;
    return (<components_1.FormField control={control} name={"services.".concat(serviceIndex, ".credentials.host")} render={function (_a) {
            var field = _a.field;
            return (<components_1.FormItem className="w-full">
          <components_1.FormLabel>Host</components_1.FormLabel>
          <components_1.Select value={field.value} onValueChange={field.onChange}>
            <components_1.SelectTrigger id="credentials-host">
              <components_1.SelectValue placeholder="Select docker image registry"/>
            </components_1.SelectTrigger>
            <components_1.SelectContent>
              <components_1.SelectGroup>
                {supportedHosts.map(function (host) { return (<components_1.SelectItem key={host.id} value={host.id}>
                    {host.label} - {host.id}
                  </components_1.SelectItem>); })}
              </components_1.SelectGroup>
            </components_1.SelectContent>
          </components_1.Select>

          <components_1.FormMessage />
        </components_1.FormItem>);
        }}/>);
};
exports.ImageCredentialsHost = ImageCredentialsHost;
