import { TooltipProvider } from "@akashnetwork/ui/components";
import { describe, expect, it } from "vitest";

import { EndpointLinks, toForwardedPortLinks, toIpLinks, toUriLinks } from "./ServiceEndpoints";

import { render, screen } from "@testing-library/react";

describe("ServiceEndpoints", () => {
  describe("toUriLinks", () => {
    it("builds an http link and copy value for each URI", () => {
      expect(toUriLinks(["app.example.com"])).toEqual([{ text: "app.example.com", href: "http://app.example.com", copyValue: "app.example.com" }]);
    });
  });

  describe("toForwardedPortLinks", () => {
    it("links a forwarded port that has a host", () => {
      expect(toForwardedPortLinks([{ host: "provider.io", externalPort: 30000, port: 80, available: 1 }])).toEqual([
        { text: "80:30000", href: "http://provider.io:30000", disabled: false }
      ]);
    });

    it("omits the href and disables a host-less unavailable port", () => {
      expect(toForwardedPortLinks([{ host: "", externalPort: 30000, port: 80, available: 0 }])).toEqual([{ text: "80:30000", href: undefined, disabled: true }]);
    });
  });

  describe("toIpLinks", () => {
    it("builds an http link and copy value for each IP", () => {
      const [link] = toIpLinks([{ IP: "1.2.3.4", ExternalPort: 8080, Port: 80, Protocol: "TCP" }]);

      expect(link.href).toBe("http://1.2.3.4:8080");
      expect(link.copyValue).toBe("1.2.3.4:8080");
    });
  });

  describe("EndpointLinks", () => {
    it("renders a link per item pointing at its open target", () => {
      render(
        <TooltipProvider>
          <EndpointLinks items={toUriLinks(["a.example.com", "b.example.com"])} />
        </TooltipProvider>
      );

      expect(screen.getByRole("link", { name: /a\.example\.com/ })).toHaveAttribute("href", "http://a.example.com");
      expect(screen.getByRole("link", { name: /b\.example\.com/ })).toHaveAttribute("href", "http://b.example.com");
    });

    it("renders a host-less port as plain text rather than a link", () => {
      render(
        <TooltipProvider>
          <EndpointLinks items={toForwardedPortLinks([{ host: "", externalPort: 30000, port: 80, available: 0 }])} />
        </TooltipProvider>
      );

      expect(screen.queryByRole("link", { name: /80:30000/ })).not.toBeInTheDocument();
      expect(screen.getByText("80:30000")).toBeInTheDocument();
    });
  });
});
