import "@testing-library/jest-dom";

import React from "react";
import type { PaymentMethod } from "@akashnetwork/http-sdk/src/stripe/stripe.types";

import { PaymentMethodsRow } from "./PaymentMethodsRow";

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMockPaymentMethod } from "@tests/seeders/payment";

// Mock implementations for dependencies
const MockTableRow = ({ children, className }: any) => <tr className={className}>{children}</tr>;
const MockTableCell = ({ children, className }: any) => <td className={className}>{children}</td>;

let isDropdownOpen = false;

const MockDropdownMenu = ({ children, modal: _modal, open }: any) => {
  isDropdownOpen = open;
  return <div data-testid="dropdown-menu">{children}</div>;
};

const MockDropdownMenuTrigger = ({ children, asChild: _asChild }: any) => <div data-testid="dropdown-trigger">{children}</div>;

const MockDropdownMenuContent = ({ children, align: _align, onMouseLeave, onClick }: any) => {
  if (!isDropdownOpen) return null;
  return (
    <div data-testid="dropdown-content" onMouseLeave={onMouseLeave} onClick={onClick}>
      {children}
    </div>
  );
};

const MockButton = ({ children, onClick, size: _size, variant: _variant, className }: any) => (
  <button onClick={onClick} className={className}>
    {children}
  </button>
);

const MockClickAwayListener = ({ children, onClickAway }: any) => {
  React.useEffect(() => {
    const handleClickAway = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-testid="click-away-listener"]')) {
        onClickAway();
      }
    };

    document.addEventListener("click", handleClickAway);
    return () => document.removeEventListener("click", handleClickAway);
  }, [onClickAway]);

  return <div data-testid="click-away-listener">{children}</div>;
};

const MockCustomDropdownLinkItem = React.forwardRef(({ children, onClick, icon, className, ...rest }: any, ref: any) => (
  <button data-testid="dropdown-item" onClick={onClick} className={className} ref={ref} {...rest}>
    {icon && <span>{icon}</span>}
    {children}
  </button>
));

const mockDependencies: any = {
  TableRow: MockTableRow,
  TableCell: MockTableCell,
  DropdownMenu: MockDropdownMenu,
  DropdownMenuTrigger: MockDropdownMenuTrigger,
  Button: MockButton,
  DropdownMenuContent: MockDropdownMenuContent,
  ClickAwayListener: MockClickAwayListener,
  CustomDropdownLinkItem: MockCustomDropdownLinkItem
};

describe(PaymentMethodsRow.name, () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders payment method with card details", () => {
      setup({
        paymentMethod: createMockPaymentMethod({
          card: {
            brand: "visa",
            last4: "4242",
            funding: "credit",
            exp_month: 12,
            exp_year: 2025
          }
        })
      });

      expect(screen.getByText(/Visa credit \*\*\*\* 4242/)).toBeInTheDocument();
      expect(screen.getByText(/Valid until/)).toBeInTheDocument();
      expect(screen.getByText(/12\/2025/)).toBeInTheDocument();
    });

    it("capitalizes card brand", () => {
      setup({
        paymentMethod: createMockPaymentMethod({
          card: {
            brand: "mastercard",
            last4: "1234",
            funding: "debit",
            exp_month: 6,
            exp_year: 2026
          }
        })
      });

      expect(screen.getByText(/Mastercard debit \*\*\*\* 1234/)).toBeInTheDocument();
    });

    it("pads single-digit month with zero", () => {
      setup({
        paymentMethod: createMockPaymentMethod({
          card: {
            brand: "visa",
            last4: "4242",
            funding: "credit",
            exp_month: 3,
            exp_year: 2027
          }
        })
      });

      expect(screen.getByText(/03\/2027/)).toBeInTheDocument();
    });

    it("displays default badge when payment method is default", () => {
      setup({
        paymentMethod: createMockPaymentMethod({
          isDefault: true
        })
      });

      expect(screen.getByText("Default")).toBeInTheDocument();
    });

    it("does not display default badge when payment method is not default", () => {
      setup({
        paymentMethod: createMockPaymentMethod({
          isDefault: false
        })
      });

      expect(screen.queryByText("Default")).not.toBeInTheDocument();
    });

    it("renders dropdown menu button when hasOtherPaymentMethods is true and payment method is not default", () => {
      setup({
        paymentMethod: createMockPaymentMethod({
          isDefault: false
        })
      });

      const button = screen.getByRole("button");
      expect(button).toBeInTheDocument();
    });

    it("does not render dropdown menu button when hasOtherPaymentMethods is false", () => {
      setup({
        hasOtherPaymentMethods: false
      });

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });

    it("does not render dropdown menu button when payment method is default", () => {
      setup({
        paymentMethod: createMockPaymentMethod({
          isDefault: true
        })
      });

      expect(screen.queryByRole("button")).not.toBeInTheDocument();
    });
  });

  describe("Dropdown Menu Interactions", () => {
    it("opens dropdown menu when button is clicked", async () => {
      const user = userEvent.setup();
      setup({
        paymentMethod: createMockPaymentMethod({
          isDefault: false
        })
      });

      const button = screen.getByRole("button");
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText("Set as default")).toBeInTheDocument();
        expect(screen.getByText("Remove")).toBeInTheDocument();
      });
    });

    it("shows both 'Set as default' and 'Remove' options when payment method is not default", async () => {
      const user = userEvent.setup();
      setup({
        paymentMethod: createMockPaymentMethod({
          isDefault: false
        })
      });

      const button = screen.getByRole("button");
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText("Set as default")).toBeInTheDocument();
        expect(screen.getByText("Remove")).toBeInTheDocument();
      });
    });
  });

  describe("Callback Functions", () => {
    it("calls onSetPaymentMethodAsDefault with correct id when 'Set as default' is clicked", async () => {
      const user = userEvent.setup();
      const { mockOnSetPaymentMethodAsDefault } = setup({
        paymentMethod: createMockPaymentMethod({
          id: "pm_test123",
          isDefault: false
        })
      });

      const button = screen.getByRole("button");
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText("Set as default")).toBeInTheDocument();
      });

      const setDefaultButton = screen.getByText("Set as default");
      await user.click(setDefaultButton);

      expect(mockOnSetPaymentMethodAsDefault).toHaveBeenCalledWith("pm_test123");
      expect(mockOnSetPaymentMethodAsDefault).toHaveBeenCalledTimes(1);
    });

    it("calls onRemovePaymentMethod with correct id when 'Remove' is clicked", async () => {
      const user = userEvent.setup();
      const { mockOnRemovePaymentMethod } = setup({
        paymentMethod: createMockPaymentMethod({
          id: "pm_test456",
          isDefault: false
        })
      });

      const button = screen.getByRole("button");
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText("Remove")).toBeInTheDocument();
      });

      const removeButton = screen.getByText("Remove");
      await user.click(removeButton);

      expect(mockOnRemovePaymentMethod).toHaveBeenCalledWith("pm_test456");
      expect(mockOnRemovePaymentMethod).toHaveBeenCalledTimes(1);
    });

    it("closes menu after clicking 'Set as default'", async () => {
      const user = userEvent.setup();
      const { mockOnSetPaymentMethodAsDefault } = setup({
        paymentMethod: createMockPaymentMethod({
          isDefault: false
        })
      });

      const button = screen.getByRole("button");
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText("Set as default")).toBeInTheDocument();
      });

      const setDefaultButton = screen.getByText("Set as default");
      await user.click(setDefaultButton);

      expect(mockOnSetPaymentMethodAsDefault).toHaveBeenCalled();
    });

    it("closes menu after clicking 'Remove'", async () => {
      const user = userEvent.setup();
      const { mockOnRemovePaymentMethod } = setup({
        paymentMethod: createMockPaymentMethod({
          isDefault: false
        })
      });

      const button = screen.getByRole("button");
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText("Remove")).toBeInTheDocument();
      });

      const removeButton = screen.getByText("Remove");
      await user.click(removeButton);

      expect(mockOnRemovePaymentMethod).toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    it("handles missing card brand gracefully", () => {
      setup({
        paymentMethod: createMockPaymentMethod({
          card: {
            brand: undefined,
            last4: "4242",
            funding: "credit",
            exp_month: 12,
            exp_year: 2025
          }
        })
      });

      expect(screen.getByText(/credit \*\*\*\* 4242/)).toBeInTheDocument();
    });

    it("handles payment method without card object", () => {
      const paymentMethod: PaymentMethod = {
        id: "pm_test",
        type: "card",
        created: Date.now(),
        validated: true,
        isDefault: false
      };

      setup({ paymentMethod });

      // Component should still render without crashing
      expect(screen.getByText(/Valid until/)).toBeInTheDocument();
    });

    it("handles two-digit month without padding", () => {
      setup({
        paymentMethod: createMockPaymentMethod({
          card: {
            brand: "visa",
            last4: "4242",
            funding: "credit",
            exp_month: 12,
            exp_year: 2025
          }
        })
      });

      expect(screen.getByText(/12\/2025/)).toBeInTheDocument();
    });
  });

  describe("Menu State Management", () => {
    it("menu starts closed by default", () => {
      setup({
        paymentMethod: createMockPaymentMethod({
          isDefault: false
        })
      });

      expect(screen.queryByText("Set as default")).not.toBeInTheDocument();
      expect(screen.queryByText("Remove")).not.toBeInTheDocument();
    });

    it("closes menu when clicking away", async () => {
      const user = userEvent.setup();

      render(
        <div>
          <table>
            <tbody>
              <PaymentMethodsRow
                paymentMethod={createMockPaymentMethod({
                  isDefault: false
                })}
                onSetPaymentMethodAsDefault={jest.fn()}
                onRemovePaymentMethod={jest.fn()}
                hasOtherPaymentMethods={true}
                dependencies={mockDependencies}
              />
            </tbody>
          </table>
          <div data-testid="outside">Outside element</div>
        </div>
      );

      const button = screen.getByRole("button");
      await user.click(button);

      await waitFor(() => {
        expect(screen.getByText("Set as default")).toBeInTheDocument();
      });

      const outsideElement = screen.getByTestId("outside");
      fireEvent.click(outsideElement);

      await waitFor(() => {
        expect(screen.queryByText("Set as default")).not.toBeInTheDocument();
      });
    });
  });
});

function setup(
  input: {
    paymentMethod?: PaymentMethod;
    onSetPaymentMethodAsDefault?: jest.Mock;
    onRemovePaymentMethod?: jest.Mock;
    hasOtherPaymentMethods?: boolean;
    dependencies?: typeof mockDependencies;
  } = {}
) {
  const defaultProps = {
    paymentMethod: createMockPaymentMethod(),
    onSetPaymentMethodAsDefault: jest.fn(),
    onRemovePaymentMethod: jest.fn(),
    hasOtherPaymentMethods: true,
    dependencies: mockDependencies
  };

  const mockOnSetPaymentMethodAsDefault = input.onSetPaymentMethodAsDefault || jest.fn();
  const mockOnRemovePaymentMethod = input.onRemovePaymentMethod || jest.fn();

  const props = {
    ...defaultProps,
    ...input,
    onSetPaymentMethodAsDefault: mockOnSetPaymentMethodAsDefault,
    onRemovePaymentMethod: mockOnRemovePaymentMethod
  };

  const renderResult = render(<table><tbody><PaymentMethodsRow {...props} /></tbody></table>);

  return {
    ...renderResult,
    mockOnSetPaymentMethodAsDefault,
    mockOnRemovePaymentMethod
  };
}
