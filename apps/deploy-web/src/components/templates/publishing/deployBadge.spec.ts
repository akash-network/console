import { describe, expect, it } from "vitest";

import { buildDeployBadge, isDeployBadgeArrival } from "./deployBadge";

const TEMPLATE_ID = "0b0f5f0c-2f0d-4f43-9f43-0d1c1b7f2a11";

describe(buildDeployBadge.name, () => {
  it("links the Console badge image to the template page with the badge source", () => {
    expect(buildDeployBadge("https://console.akash.network", TEMPLATE_ID)).toEqual({
      imageUrl: "https://console.akash.network/images/deploy-with-akash-btn.svg",
      linkUrl: `https://console.akash.network/template/${TEMPLATE_ID}?utm_source=badge`,
      markdown: `[![Deploy on Akash](https://console.akash.network/images/deploy-with-akash-btn.svg)](https://console.akash.network/template/${TEMPLATE_ID}?utm_source=badge)`,
      html: `<a href="https://console.akash.network/template/${TEMPLATE_ID}?utm_source=badge"><img src="https://console.akash.network/images/deploy-with-akash-btn.svg" alt="Deploy on Akash" height="44"></a>`
    });
  });

  it("escapes an id that would otherwise break out of the snippet", () => {
    const badge = buildDeployBadge("https://console.akash.network", 'x"><script>)');

    expect(badge.linkUrl).toBe("https://console.akash.network/template/x%22%3E%3Cscript%3E)?utm_source=badge");
    expect(badge.html).not.toContain("<script>");
  });
});

describe(isDeployBadgeArrival.name, () => {
  it("recognizes the badge source", () => {
    expect(isDeployBadgeArrival("badge")).toBe(true);
  });

  it.each([undefined, "", "newsletter", ["badge"], "Badge"])("ignores %j", source => {
    expect(isDeployBadgeArrival(source)).toBe(false);
  });
});
