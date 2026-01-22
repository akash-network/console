import React from "react";
import type { PaymentMethod, SetupIntentResponse } from "@akashnetwork/http-sdk";

import type { DEPENDENCIES } from "./PaymentMethodsView";
import { PaymentMethodsView } from "./PaymentMethodsView";

import { fireEvent, render, screen } from "@testing-library/react";
import { createMockPaymentMethod } from "@tests/seeders/payment";

// Mock implementations for dependencies
const mockUseTheme = jest.fn(() => ({
  resolvedTheme: "light" as "light" | "dark" | undefined,
  theme: "light",
  setTheme: jest.fn(),
  themes: ["light", "dark", "system"],
  systemTheme: "light" as "light" | "dark" | undefined
}));

const MockPaymentMethodsRow = ({ paymentMethod, onSetPaymentMethodAsDefault, onRemovePaymentMethod, hasOtherPaymentMethods }: any) => (
  <tr data-testid={`payment-method-row-${paymentMethod.id}`}>
    <td>
      <span>{paymentMethod.card?.last4}</span>
      <button onClick={() => onSetPaymentMethodAsDefault(paymentMethod.id)}>Set as Default</button>
      {hasOtherPaymentMethods && <button onClick={() => onRemovePaymentMethod(paymentMethod.id)}>Remove</button>}
    </td>
  </tr>
);

const MockAddPaymentMethodPopup = ({ open, onClose, clientSecret, isDarkMode, onSuccess }: any) =>
  open ? (
    <div data-testid="add-payment-method-popup">
      <button onClick={onClose}>Close</button>
      <button onClick={onSuccess}>Success</button>
      <span data-testid="dark-mode">{isDarkMode ? "dark" : "light"}</span>
      <span data-testid="client-secret">{clientSecret}</span>
    </div>
  ) : null;

const MockCard = ({ children }: any) => <div>{children}</div>;
const MockCardHeader = ({ children }: any) => <div>{children}</div>;
const MockCardContent = ({ children, className }: any) => <div className={className}>{children}</div>;
const MockCardFooter = ({ children, className }: any) => <div className={className}>{children}</div>;
const MockSpinner = () => <div data-testid="spinner">Loading...</div>;
const MockTable = ({ children }: any) => <table>{children}</table>;
const MockTableBody = ({ children }: any) => <tbody>{children}</tbody>;
const MockButton = ({ children, onClick, className }: any) => (
  <button data-testid="button" onClick={onClick} className={className}>
    {children}
  </button>
);

const MockCircularProgress = ({ color }: any) => (
  <div data-testid="circular-progress" data-color={color}>
    Loading...
  </div>
);

const mockDependencies: any = {
  useTheme: mockUseTheme,
  PaymentMethodsRow: MockPaymentMethodsRow,
  AddPaymentMethodPopup: MockAddPaymentMethodPopup,
  Card: MockCard,
  CardHeader: MockCardHeader,
  CardContent: MockCardContent,
  CardFooter: MockCardFooter,
  Spinner: MockSpinner,
  Table: MockTable,
  TableBody: MockTableBody,
  Button: MockButton,
  CircularProgress: MockCircularProgress
};

describe(PaymentMethodsView.name, () => {
  describe("Loading State", () => {
    it("renders loading spinner when isLoadingPaymentMethods is true", () => {
      setup({ isLoadingPaymentMethods: true });

      expect(screen.getByTestId("spinner")).toBeInTheDocument();
    });

    it("does not render payment methods content when loading", () => {
      setup({ isLoadingPaymentMethods: true });

      expect(screen.queryByText("Payment Methods")).not.toBeInTheDocument();
    });
  });

  describe("Empty State", () => {
    it("renders empty state message when no payment methods exist", () => {
      setup({ data: [] });

      expect(screen.getByText("No payment methods added yet.")).toBeInTheDocument();
    });

    it("renders card header and footer when no payment methods exist", () => {
      setup({ data: [] });

      expect(screen.getByText("Payment Methods")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Add Payment Method" })).toBeInTheDocument();
    });

    it("renders add payment method button when no payment methods exist", () => {
      setup({ data: [] });

      expect(screen.getByRole("button", { name: "Add Payment Method" })).toBeInTheDocument();
    });
  });

  describe("Payment Methods Display", () => {
    it("renders payment methods header and description", () => {
      setup();

      expect(screen.getByText("Payment Methods")).toBeInTheDocument();
      expect(screen.getByText("All payments to add credits will be made using your default card.")).toBeInTheDocument();
    });

    it("renders all payment methods", () => {
      const paymentMethods = createMockPaymentMethods();
      setup({ data: paymentMethods });

      expect(screen.getByTestId("payment-method-row-pm_123")).toBeInTheDocument();
      expect(screen.getByTestId("payment-method-row-pm_456")).toBeInTheDocument();
      expect(screen.getByText("4242")).toBeInTheDocument();
      expect(screen.getByText("5555")).toBeInTheDocument();
    });

    it("renders add payment method button", () => {
      setup();

      expect(screen.getByRole("button", { name: "Add Payment Method" })).toBeInTheDocument();
    });

    it("passes correct canBeRemoved prop when multiple payment methods exist", () => {
      const paymentMethods = createMockPaymentMethods();
      setup({ data: paymentMethods });

      // When there are 2 payment methods, both should be removable
      const row1 = screen.getByTestId("payment-method-row-pm_123");
      const row2 = screen.getByTestId("payment-method-row-pm_456");

      // Both rows should have Remove buttons when there are multiple payment methods
      expect(row1.textContent).toContain("Remove");
      expect(row2.textContent).toContain("Remove");
    });

    it("passes correct canBeRemoved prop when only one payment method exists", () => {
      const paymentMethods = [createMockPaymentMethods()[0]];
      setup({ data: paymentMethods });

      // When there's only 1 payment method, it should not be removable
      const row = screen.getByTestId("payment-method-row-pm_123");
      expect(row.textContent).not.toContain("Remove");
    });
  });

  describe("Payment Method Interactions", () => {
    it("calls onAddPaymentMethod when add button is clicked", () => {
      const { mockOnAddPaymentMethod } = setup();

      const addButton = screen.getByRole("button", { name: "Add Payment Method" });
      fireEvent.click(addButton);

      expect(mockOnAddPaymentMethod).toHaveBeenCalledTimes(1);
    });

    it("calls onSetPaymentMethodAsDefault with correct id", () => {
      const { mockOnSetPaymentMethodAsDefault } = setup();

      const setDefaultButtons = screen.getAllByText("Set as Default");
      fireEvent.click(setDefaultButtons[0]);

      expect(mockOnSetPaymentMethodAsDefault).toHaveBeenCalledWith("pm_123");
    });

    it("calls onRemovePaymentMethod with correct id", () => {
      const { mockOnRemovePaymentMethod } = setup();

      const removeButtons = screen.getAllByText("Remove");
      fireEvent.click(removeButtons[0]);

      expect(mockOnRemovePaymentMethod).toHaveBeenCalledWith("pm_123");
    });
  });

  describe("AddPaymentMethodPopup Integration", () => {
    it("does not show popup when showAddPaymentMethod is false", () => {
      setup({ showAddPaymentMethod: false });

      expect(screen.queryByTestId("add-payment-method-popup")).not.toBeInTheDocument();
    });

    it("shows popup when showAddPaymentMethod is true", () => {
      setup({ showAddPaymentMethod: true });

      expect(screen.getByTestId("add-payment-method-popup")).toBeInTheDocument();
    });

    it("passes correct clientSecret to popup", () => {
      const setupIntent: SetupIntentResponse = {
        clientSecret: "test_secret_123"
      };
      setup({ showAddPaymentMethod: true, setupIntent });

      expect(screen.getByTestId("client-secret")).toHaveTextContent("test_secret_123");
    });

    it("passes undefined clientSecret when setupIntent is not provided", () => {
      setup({ showAddPaymentMethod: true, setupIntent: undefined });

      expect(screen.getByTestId("client-secret")).toBeEmptyDOMElement();
    });

    it("calls setShowAddPaymentMethod(false) when popup is closed", () => {
      const { mockSetShowAddPaymentMethod } = setup({ showAddPaymentMethod: true });

      const closeButton = screen.getByText("Close");
      fireEvent.click(closeButton);

      expect(mockSetShowAddPaymentMethod).toHaveBeenCalledWith(false);
    });

    it("calls onAddCardSuccess when popup success is triggered", () => {
      const { mockOnAddCardSuccess } = setup({ showAddPaymentMethod: true });

      const successButton = screen.getByText("Success");
      fireEvent.click(successButton);

      expect(mockOnAddCardSuccess).toHaveBeenCalledTimes(1);
    });

    it("passes isDarkMode as false when theme is light", () => {
      const lightThemeDeps: any = {
        ...mockDependencies,
        useTheme: jest.fn(() => ({
          resolvedTheme: "light" as "light" | "dark" | undefined,
          theme: "light",
          setTheme: jest.fn(),
          themes: ["light", "dark", "system"],
          systemTheme: "light" as "light" | "dark" | undefined
        }))
      };

      setup({ showAddPaymentMethod: true, dependencies: lightThemeDeps });

      expect(screen.getByTestId("dark-mode")).toHaveTextContent("light");
    });

    it("passes isDarkMode as true when theme is dark", () => {
      const darkThemeDeps: any = {
        ...mockDependencies,
        useTheme: jest.fn(() => ({
          resolvedTheme: "dark" as "light" | "dark" | undefined,
          theme: "dark",
          setTheme: jest.fn(),
          themes: ["light", "dark", "system"],
          systemTheme: "dark" as "light" | "dark" | undefined
        }))
      };

      setup({ showAddPaymentMethod: true, dependencies: darkThemeDeps });

      expect(screen.getByTestId("dark-mode")).toHaveTextContent("dark");
    });
  });

  describe("Progress Overlay", () => {
    it("does not show progress overlay when isInProgress is false", () => {
      setup({ isInProgress: false });

      expect(screen.queryByTestId("circular-progress")).not.toBeInTheDocument();
    });

    it("shows progress overlay when isInProgress is true", () => {
      setup({ isInProgress: true });

      expect(screen.queryByTestId("circular-progress")).toBeInTheDocument();
    });
  });

  describe("Edge Cases", () => {
    it("handles empty payment methods array", () => {
      setup({ data: [] });

      expect(screen.getByText("No payment methods added yet.")).toBeInTheDocument();
      expect(screen.queryByTestId(/payment-method-row-/)).not.toBeInTheDocument();
    });

    it("handles single payment method", () => {
      const singlePaymentMethod = [createMockPaymentMethods()[0]];
      setup({ data: singlePaymentMethod });

      expect(screen.getByTestId("payment-method-row-pm_123")).toBeInTheDocument();
      expect(screen.queryByTestId("payment-method-row-pm_456")).not.toBeInTheDocument();
    });

    it("handles three payment methods (maximum)", () => {
      const threePaymentMethods = [
        ...createMockPaymentMethods(),
        createMockPaymentMethod({
          id: "pm_789",
          card: {
            last4: "6789",
            brand: "amex",
            exp_month: 6,
            exp_year: 2027,
            funding: "credit"
          },
          isDefault: false
        })
      ];
      setup({ data: threePaymentMethods });

      expect(screen.getByTestId("payment-method-row-pm_123")).toBeInTheDocument();
      expect(screen.getByTestId("payment-method-row-pm_456")).toBeInTheDocument();
      expect(screen.getByTestId("payment-method-row-pm_789")).toBeInTheDocument();
    });

    it("handles payment method without card details", () => {
      const paymentMethodsWithoutCard = [
        {
          id: "pm_999",
          isDefault: true
        } as PaymentMethod
      ];
      setup({ data: paymentMethodsWithoutCard });

      expect(screen.getByTestId("payment-method-row-pm_999")).toBeInTheDocument();
    });

    it("handles mixed theme values", () => {
      const undefinedThemeDeps: any = {
        ...mockDependencies,
        useTheme: jest.fn(() => ({
          resolvedTheme: undefined,
          theme: undefined,
          setTheme: jest.fn(),
          themes: ["light", "dark", "system"],
          systemTheme: undefined
        }))
      };

      setup({ showAddPaymentMethod: true, dependencies: undefinedThemeDeps });

      // When theme is undefined, it should default to light (not dark)
      expect(screen.getByTestId("dark-mode")).toHaveTextContent("light");
    });
  });

  describe("Component Structure", () => {
    it("renders main container with correct spacing", () => {
      const { container } = setup();

      const mainDiv = container.querySelector(".space-y-2");
      expect(mainDiv).toBeInTheDocument();
    });

    it("renders Card components correctly", () => {
      setup();

      // Card should contain header, content, and footer
      expect(screen.getByText("Payment Methods")).toBeInTheDocument();
      expect(screen.getByText("All payments to add credits will be made using your default card.")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Add Payment Method" })).toBeInTheDocument();
    });
  });
});

function createMockPaymentMethods(): PaymentMethod[] {
  return [
    createMockPaymentMethod({
      id: "pm_123",
      card: {
        last4: "4242",
        brand: "visa",
        exp_month: 12,
        exp_year: 2025,
        funding: "credit"
      },
      isDefault: true
    }),
    createMockPaymentMethod({
      id: "pm_456",
      card: {
        last4: "5555",
        brand: "mastercard",
        exp_month: 3,
        exp_year: 2026,
        funding: "debit"
      },
      isDefault: false
    })
  ];
}

function setup(
  input: {
    data?: PaymentMethod[];
    onSetPaymentMethodAsDefault?: jest.Mock;
    onRemovePaymentMethod?: jest.Mock;
    onAddPaymentMethod?: jest.Mock;
    isLoadingPaymentMethods?: boolean;
    showAddPaymentMethod?: boolean;
    setShowAddPaymentMethod?: jest.Mock;
    setupIntent?: SetupIntentResponse;
    onAddCardSuccess?: jest.Mock;
    isInProgress?: boolean;
    dependencies?: typeof DEPENDENCIES;
  } = {}
) {
  const defaultProps = {
    data: createMockPaymentMethods(),
    onSetPaymentMethodAsDefault: jest.fn(),
    onRemovePaymentMethod: jest.fn(),
    onAddPaymentMethod: jest.fn(),
    isLoadingPaymentMethods: false,
    showAddPaymentMethod: false,
    setShowAddPaymentMethod: jest.fn(),
    setupIntent: undefined,
    onAddCardSuccess: jest.fn(),
    isInProgress: false,
    dependencies: mockDependencies
  };

  const mockOnSetPaymentMethodAsDefault = input.onSetPaymentMethodAsDefault || jest.fn();
  const mockOnRemovePaymentMethod = input.onRemovePaymentMethod || jest.fn();
  const mockOnAddPaymentMethod = input.onAddPaymentMethod || jest.fn();
  const mockSetShowAddPaymentMethod = input.setShowAddPaymentMethod || jest.fn();
  const mockOnAddCardSuccess = input.onAddCardSuccess || jest.fn();

  const props = {
    ...defaultProps,
    ...input,
    onSetPaymentMethodAsDefault: mockOnSetPaymentMethodAsDefault,
    onRemovePaymentMethod: mockOnRemovePaymentMethod,
    onAddPaymentMethod: mockOnAddPaymentMethod,
    setShowAddPaymentMethod: mockSetShowAddPaymentMethod,
    onAddCardSuccess: mockOnAddCardSuccess
  };

  const renderResult = render(<PaymentMethodsView {...props} />);

  return {
    ...renderResult,
    mockOnSetPaymentMethodAsDefault,
    mockOnRemovePaymentMethod,
    mockOnAddPaymentMethod,
    mockSetShowAddPaymentMethod,
    mockOnAddCardSuccess
  };
}
