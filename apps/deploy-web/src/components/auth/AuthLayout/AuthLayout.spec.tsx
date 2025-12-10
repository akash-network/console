import { ThemeProvider as NextThemeProvider } from "next-themes";

import { CustomThemeProvider } from "@src/context/CustomThemeContext/CustomThemeContext";
import { AuthLayout } from "./AuthLayout";

import { render } from "@testing-library/react";

describe(AuthLayout.name, () => {
  it("renders light theme layout", () => {
    const result = setup({ theme: "light" });
    expect(result.container).toMatchSnapshot();
  });

  it("renders dark theme layout", () => {
    const result = setup({ theme: "dark" });
    expect(result.container).toMatchSnapshot();
  });

  function setup(input?: { theme?: "light" | "dark" }) {
    return render(
      <NextThemeProvider defaultTheme={input?.theme ?? "light"}>
        <CustomThemeProvider>
          <AuthLayout sidebar={<div>Sidebar</div>}>
            <div>Children</div>
          </AuthLayout>
        </CustomThemeProvider>
      </NextThemeProvider>
    );
  }
});
