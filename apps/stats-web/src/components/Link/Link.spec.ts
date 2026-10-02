import NextLink from "next/link";
import { describe, expect, it } from "vitest";

import { Link } from "./Link";

describe(Link.name, () => {
  it("renders a Next link that does not prefetch its route", () => {
    const element = Link({ href: "/blocks", children: "Blocks" });

    expect(element.type).toBe(NextLink);
    expect(element.props).toEqual({ href: "/blocks", children: "Blocks", prefetch: false });
  });

  it("prefetches the route when the caller asks for it", () => {
    const element = Link({ href: "/blocks", prefetch: true });

    expect(element.props).toMatchObject({ prefetch: true });
  });
});
