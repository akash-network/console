import { describe, expect, it } from "vitest";

import type { EndpointLink, PortChip } from "./ServiceEndpoints";
import { PortChips, ServiceUriLinks, toPortChips, toUriLinks } from "./ServiceEndpoints";

import { render, screen } from "@testing-library/react";

describe("ServiceEndpoints", () => {
  describe("toUriLinks", () => {
    it("builds an http link for each URI", () => {
      expect(toUriLinks(["app.example.com"])).toEqual([{ text: "app.example.com", href: "http://app.example.com" }]);
    });

    it("yields no links when the provider reports no URIs", () => {
      expect(toUriLinks(null)).toEqual([]);
      expect(toUriLinks(undefined)).toEqual([]);
    });
  });

  describe("toPortChips", () => {
    it("builds a chip from a live forwarded port", () => {
      expect(toPortChips({ forwardedPorts: [{ host: "provider.io", externalPort: 30151, port: 5432, available: 1 }] })).toEqual([
        { port: 5432, as: 30151, href: "http://provider.io:30151", available: true }
      ]);
    });

    it("omits the href on a host-less forwarded port", () => {
      expect(toPortChips({ forwardedPorts: [{ host: "", externalPort: 30000, port: 80, available: 0 }] })).toEqual([
        { port: 80, as: 30000, href: undefined, available: false }
      ]);
    });

    it("omits the href on an unavailable forwarded port even when a host is assigned", () => {
      expect(toPortChips({ forwardedPorts: [{ host: "provider.io", externalPort: 30000, port: 80, available: 0 }] })).toEqual([
        { port: 80, as: 30000, href: undefined, available: false }
      ]);
    });

    it("yields no chips when the lease is closed", () => {
      expect(toPortChips({ forwardedPorts: [{ host: "provider.io", externalPort: 30000, port: 80, available: 1 }], closed: true })).toEqual([]);
    });

    it("builds a chip from a leased IP", () => {
      expect(toPortChips({ ips: [{ IP: "1.2.3.4", ExternalPort: 8080, Port: 80, Protocol: "TCP" }] })).toEqual([
        { port: 80, as: 8080, proto: "tcp", href: "http://1.2.3.4:8080", available: true }
      ]);
    });
  });

  describe("ServiceUriLinks", () => {
    it("renders a link per URI pointing at its open target", () => {
      setup({ items: toUriLinks(["a.example.com", "b.example.com"]) });

      expect(screen.getByRole("link", { name: /a\.example\.com/ })).toHaveAttribute("href", "http://a.example.com");
      expect(screen.getByRole("link", { name: /b\.example\.com/ })).toHaveAttribute("href", "http://b.example.com");
    });

    function setup(input: { items: EndpointLink[] }) {
      return render(<ServiceUriLinks items={input.items} />);
    }
  });

  describe("PortChips", () => {
    it("renders a clickable chip for a forwarded port", () => {
      setup({ items: toPortChips({ forwardedPorts: [{ host: "provider.io", externalPort: 30000, port: 3000, available: 1 }] }) });

      expect(screen.getByRole("link", { name: /3000/ })).toHaveAttribute("href", "http://provider.io:30000");
      expect(screen.getByText(":30000")).toBeInTheDocument();
    });

    it("renders a host-less port as plain text rather than a link", () => {
      setup({ items: toPortChips({ forwardedPorts: [{ host: "", externalPort: 30000, port: 80, available: 0 }] }) });

      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      expect(screen.getByText("80")).toBeInTheDocument();
    });

    it("keeps an unavailable hosted port out of the tab order", () => {
      setup({ items: toPortChips({ forwardedPorts: [{ host: "provider.io", externalPort: 30000, port: 80, available: 0 }] }) });

      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      expect(screen.getByText("80")).toBeInTheDocument();
    });

    it("exposes availability to assistive technology", () => {
      setup({ items: toPortChips({ forwardedPorts: [{ host: "provider.io", externalPort: 30000, port: 3000, available: 1 }] }) });

      expect(screen.getByText("Available")).toBeInTheDocument();
    });

    it("marks an unavailable port as unavailable to assistive technology", () => {
      setup({ items: toPortChips({ forwardedPorts: [{ host: "provider.io", externalPort: 30000, port: 80, available: 0 }] }) });

      expect(screen.getByText("Unavailable")).toBeInTheDocument();
    });

    function setup(input: { items: PortChip[] }) {
      return render(<PortChips items={input.items} />);
    }
  });
});
