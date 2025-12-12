import "@testing-library/jest-dom";

import type { ComponentProps } from "react";

import { SocialAuth } from "./SocialAuth";

import { fireEvent, render, screen } from "@testing-library/react";

describe(SocialAuth.name, () => {
  it("calls onSocialLogin with the GitHub provider when the GitHub button is clicked", () => {
    const { onSocialLogin } = setup();
    const buttons = screen.getAllByRole("button");

    fireEvent.click(buttons[0]);

    expect(onSocialLogin).toHaveBeenCalledTimes(1);
    expect(onSocialLogin).toHaveBeenCalledWith("github");
  });

  it("calls onSocialLogin with the Google provider when the Google button is clicked", () => {
    const { onSocialLogin } = setup();
    const buttons = screen.getAllByRole("button");

    fireEvent.click(buttons[1]);

    expect(onSocialLogin).toHaveBeenCalledTimes(1);
    expect(onSocialLogin).toHaveBeenCalledWith("google-oauth2");
  });

  it("matches snapshot when rendered without a button prefix", () => {
    const { container } = setup();

    expect(container).toMatchSnapshot();
  });

  it("matches snapshot when rendered with a button prefix", () => {
    const { container } = setup({ buttonPrefix: "Continue with" });

    expect(container).toMatchSnapshot();
  });

  type SocialAuthProps = ComponentProps<typeof SocialAuth>;

  function setup(props: Partial<SocialAuthProps> = {}) {
    const onSocialLogin = props.onSocialLogin ?? jest.fn<void, ["github" | "google-oauth2"]>();
    const renderResult = render(<SocialAuth {...props} onSocialLogin={onSocialLogin} />);

    return {
      ...renderResult,
      onSocialLogin
    };
  }
});
