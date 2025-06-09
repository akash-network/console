import { faker } from "@faker-js/faker";

import { AccountEmailChannelCreateTrigger } from "@src/components/alerts/AccountEmailChannelCreator/AccountEmailChannelCreator";

import { fireEvent, render, screen } from "@testing-library/react";

describe("AccountEmailChannelCreateTrigger", () => {
  it("renders with the correct button text", () => {
    const { button } = setup();
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent("Use my account email");
  });

  it("calls create function with correct parameters when clicked", () => {
    const { button, props } = setup();

    fireEvent.click(button);

    expect(props.create).toHaveBeenCalledTimes(1);
    expect(props.create).toHaveBeenCalledWith({
      name: "Primary account email",
      emails: [props.email]
    });
  });

  it("passes the correct email to the create function", () => {
    const customEmail = faker.internet.email();
    const { button, props } = setup({ email: customEmail });

    fireEvent.click(button);

    expect(props.create).toHaveBeenCalledWith({
      name: "Primary account email",
      emails: [customEmail]
    });
  });

  it("doesnt call create function when isLoading is true", () => {
    const { button, props } = setup({ isLoading: true });

    fireEvent.click(button);

    expect(props.create).not.toHaveBeenCalled();
  });

  it("properly passes loading state to LoadingButton", () => {
    const { props: propsNotLoading } = setup({ isLoading: false });
    expect(propsNotLoading.isLoading).toBe(false);

    const { props: propsLoading } = setup({ isLoading: true });
    expect(propsLoading.isLoading).toBe(true);
  });

  function setup(props = {}) {
    const defaultProps = {
      isLoading: false,
      create: jest.fn(),
      email: faker.internet.email(),
      ...props
    };
    const testId = faker.string.uuid();

    const utils = render(<AccountEmailChannelCreateTrigger {...defaultProps} testId={testId} />);

    const button = screen.getByTestId(testId);

    return {
      ...utils,
      button,
      props: defaultProps
    };
  }
});
