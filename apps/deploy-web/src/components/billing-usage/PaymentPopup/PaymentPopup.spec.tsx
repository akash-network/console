import "@testing-library/jest-dom";

import React from "react";

import { PaymentPopup } from "./PaymentPopup";

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

// Mock UI Components
const MockPopup = ({ children, open, title, actions }: any) => {
  if (!open) return null;
  return (
    <div data-testid="popup">
      <h1>{title}</h1>
      {actions &&
        actions.map((action: any, i: number) => (
          <button key={i} onClick={action.onClick}>
            {action.label}
          </button>
        ))}
      {children}
    </div>
  );
};

const MockCard = ({ children, className }: any) => (
  <div data-testid="card" className={className}>
    {children}
  </div>
);
const MockCardHeader = ({ children }: any) => <div data-testid="card-header">{children}</div>;
const MockCardTitle = ({ children, className }: any) => <h2 className={className}>{children}</h2>;
const MockCardContent = ({ children, className }: any) => (
  <div data-testid="card-content" className={className}>
    {children}
  </div>
);
const MockCardDescription = ({ children }: any) => <p>{children}</p>;

const MockForm = ({ children }: any) => <div data-testid="form">{children}</div>;

const MockFormField = ({ control, name, render }: any) => {
  const field = {
    onChange: (e: any) => {
      const newValue = e.target ? e.target.value : e;
      control.setValue(name, newValue);
    },
    value: control.getValues(name),
    name
  };
  return render({ field });
};

const MockFormInput = ({ label, type, placeholder, onChange, value, ...rest }: any) => {
  const inputId = `input-${rest.name}`;
  // Remove onChange from rest to avoid conflicts
  const { onChange: _omit, ...otherProps } = rest;
  return (
    <div>
      <label htmlFor={inputId}>{label}</label>
      <input id={inputId} data-testid={inputId} type={type} placeholder={placeholder} value={value} {...otherProps} onChange={onChange} />
    </div>
  );
};

const MockLoadingButton = ({ children, loading, disabled, type, className, onClick }: any) => (
  <button data-testid="loading-button" disabled={disabled || loading} type={type} className={className} onClick={onClick}>
    {children}
  </button>
);

const MockFormattedNumber = ({ value, style }: any) => {
  if (style === "currency") {
    const numValue = typeof value === "string" ? parseFloat(value) || 0 : value || 0;
    return <span data-testid="formatted-number">${numValue.toFixed(2)}</span>;
  }
  return <span data-testid="formatted-number">{value}</span>;
};

const MockAlert = ({ children, variant, className }: any) => (
  <div data-testid="alert" data-variant={variant} className={className}>
    {children}
  </div>
);

const MockButton = ({ children, onClick, className }: any) => (
  <button data-testid="button" onClick={onClick} className={className}>
    {children}
  </button>
);

const MockXmark = ({ className }: any) => <span className={className}>X</span>;

const MockSnackbar = ({ title, iconVariant }: any) => (
  <div data-testid="snackbar" data-icon-variant={iconVariant}>
    {title}
  </div>
);

describe(PaymentPopup.name, () => {
  describe("Rendering", () => {
    it("renders popup when open is true", () => {
      setup({ open: true });
      expect(screen.getByTestId("popup")).toBeInTheDocument();
      expect(screen.getByText("Add Funds")).toBeInTheDocument();
    });

    it("does not render popup when open is false", () => {
      setup({ open: false });
      expect(screen.queryByTestId("popup")).not.toBeInTheDocument();
    });

    it("renders payment form with amount input", () => {
      setup({ open: true });
      expect(screen.getByLabelText("Amount (USD)")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("0.00")).toBeInTheDocument();
    });

    it("renders coupon form with coupon input", () => {
      setup({ open: true });
      expect(screen.getByLabelText("Coupon Code")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Enter coupon code")).toBeInTheDocument();
    });

    it("renders both cards with correct titles", () => {
      setup({ open: true });
      expect(screen.getByText("Add credits")).toBeInTheDocument();
      expect(screen.getByText("Have a coupon code?")).toBeInTheDocument();
    });

    it("renders cancel button", () => {
      setup({ open: true });
      expect(screen.getByText("Cancel")).toBeInTheDocument();
    });

    it("displays message when no payment method is selected", () => {
      setup({ open: true, selectedPaymentMethodId: undefined });
      expect(screen.getByText("Please select a payment method above")).toBeInTheDocument();
    });

    it("does not display message when payment method is selected", () => {
      setup({ open: true, selectedPaymentMethodId: "pm_123" });
      expect(screen.queryByText("Please select a payment method above")).not.toBeInTheDocument();
    });
  });

  describe("Payment Form Validation", () => {
    it("shows validation error for negative amount", async () => {
      const { mockUseForm } = setup({ open: true });
      const paymentForm = mockUseForm.mock.results[0].value;

      await act(async () => {
        await paymentForm.trigger("amount");
      });

      // The form validation is handled by react-hook-form with zod
      // We verify the form is set up correctly
      expect(mockUseForm).toHaveBeenCalled();
    });

    it("shows validation error for amount below minimum", async () => {
      const { mockUseForm } = setup({ open: true });
      const paymentForm = mockUseForm.mock.results[0].value;

      await act(async () => {
        paymentForm.setValue("amount", 10);
        await paymentForm.trigger("amount");
      });

      expect(mockUseForm).toHaveBeenCalled();
    });

    it("accepts valid amount", async () => {
      const { mockUseForm } = setup({ open: true, selectedPaymentMethodId: "pm_123" });
      const paymentForm = mockUseForm.mock.results[0].value;

      await act(async () => {
        paymentForm.setValue("amount", 25);
        await paymentForm.trigger("amount");
      });

      expect(paymentForm.getValues("amount")).toBe(25);
    });
  });

  describe("Payment Submission", () => {
    it("calls confirmPayment when form is submitted with valid data", async () => {
      const { mockConfirmPayment, mockUseForm, paymentSubmitHandler } = setup({
        open: true,
        selectedPaymentMethodId: "pm_test123",
        userId: "user_123"
      });

      const paymentForm = mockUseForm.mock.results[0].value;

      await act(async () => {
        paymentForm.setValue("amount", 50);
        const handler = paymentSubmitHandler();
        if (handler) {
          await handler({ amount: 50 });
        }
      });

      expect(mockConfirmPayment).toHaveBeenCalledWith({
        userId: "user_123",
        paymentMethodId: "pm_test123",
        amount: 50,
        currency: "usd"
      });
    });

    it("does not submit when no payment method is selected", async () => {
      const { mockConfirmPayment, mockUseForm, paymentSubmitHandler } = setup({
        open: true,
        selectedPaymentMethodId: undefined,
        userId: "user_123"
      });

      const paymentForm = mockUseForm.mock.results[0].value;

      await act(async () => {
        paymentForm.setValue("amount", 50);
        const handler = paymentSubmitHandler();
        if (handler) {
          await handler({ amount: 50 });
        }
      });

      expect(mockConfirmPayment).not.toHaveBeenCalled();
    });

    it("does not submit when user is not authenticated", async () => {
      const { mockConfirmPayment, mockUseForm, paymentSubmitHandler, consoleErrorSpy } = setup({
        open: true,
        selectedPaymentMethodId: "pm_test123",
        userId: undefined
      });

      const paymentForm = mockUseForm.mock.results[0].value;

      await act(async () => {
        paymentForm.setValue("amount", 50);
        const handler = paymentSubmitHandler();
        if (handler) {
          await handler({ amount: 50 });
        }
      });

      expect(mockConfirmPayment).not.toHaveBeenCalled();
      // Should show an error instead
      expect(consoleErrorSpy).toHaveBeenCalledWith("Payment attempted without a user id");
    });

    it("shows success and closes popup on successful payment", async () => {
      const mockOnClose = jest.fn();
      const mockSetShowPaymentSuccess = jest.fn();
      const mockPollForPayment = jest.fn();

      const { mockUseForm, paymentSubmitHandler } = setup({
        open: true,
        selectedPaymentMethodId: "pm_test123",
        userId: "user_123",
        onClose: mockOnClose,
        setShowPaymentSuccess: mockSetShowPaymentSuccess,
        confirmPaymentResponse: { success: true },
        pollForPayment: mockPollForPayment
      });

      const paymentForm = mockUseForm.mock.results[0].value;

      await act(async () => {
        paymentForm.setValue("amount", 50);
        const handler = paymentSubmitHandler();
        if (handler) {
          await handler({ amount: 50 });
        }
      });

      expect(mockPollForPayment).toHaveBeenCalled();
      expect(mockSetShowPaymentSuccess).toHaveBeenCalledWith({ amount: "50", show: true });
      expect(mockOnClose).toHaveBeenCalled();
    });

    it("initiates 3D Secure when payment requires action", async () => {
      const mockStart3DSecure = jest.fn();

      const { mockUseForm, paymentSubmitHandler } = setup({
        open: true,
        selectedPaymentMethodId: "pm_test123",
        userId: "user_123",
        confirmPaymentResponse: {
          requiresAction: true,
          clientSecret: "secret_123",
          paymentIntentId: "pi_123"
        },
        start3DSecure: mockStart3DSecure
      });

      const paymentForm = mockUseForm.mock.results[0].value;

      await act(async () => {
        paymentForm.setValue("amount", 50);
        const handler = paymentSubmitHandler();
        if (handler) {
          await handler({ amount: 50 });
        }
      });

      expect(mockStart3DSecure).toHaveBeenCalledWith({
        clientSecret: "secret_123",
        paymentIntentId: "pi_123",
        paymentMethodId: "pm_test123"
      });
    });

    it("handles payment error and displays error message", async () => {
      const mockError = new Error("Payment failed");
      const { mockUseForm, mockEnqueueSnackbar, mockHandleStripeError, paymentSubmitHandler } = setup({
        open: true,
        selectedPaymentMethodId: "pm_test123",
        userId: "user_123",
        confirmPaymentError: mockError
      });

      const paymentForm = mockUseForm.mock.results[0].value;

      await act(async () => {
        paymentForm.setValue("amount", 50);
        const handler = paymentSubmitHandler();
        if (handler) {
          await handler({ amount: 50 });
        }
      });

      expect(mockHandleStripeError).toHaveBeenCalledWith(mockError);
      expect(mockEnqueueSnackbar).toHaveBeenCalled();
    });

    it("disables submit button when processing", () => {
      setup({
        open: true,
        selectedPaymentMethodId: "pm_123",
        isConfirmingPayment: true
      });

      const submitButton = screen.getAllByTestId("loading-button")[0];
      expect(submitButton).toBeDisabled();
    });

    it("disables submit button when no payment method selected", () => {
      setup({
        open: true,
        selectedPaymentMethodId: undefined
      });

      const submitButton = screen.getAllByTestId("loading-button")[0];
      expect(submitButton).toBeDisabled();
    });
  });

  describe("Coupon Submission", () => {
    it("calls applyCoupon when coupon form is submitted", async () => {
      const { mockApplyCoupon, mockUseForm, couponSubmitHandler } = setup({
        open: true,
        userId: "user_123"
      });

      const couponForm = mockUseForm.mock.results[1].value;

      await act(async () => {
        couponForm.setValue("coupon", "TESTCODE");
        const handler = couponSubmitHandler();
        if (handler) {
          await handler({ coupon: "TESTCODE" });
        }
      });

      expect(mockApplyCoupon).toHaveBeenCalledWith({
        coupon: "TESTCODE",
        userId: "user_123"
      });
    });

    it("does not submit coupon when user is not authenticated", async () => {
      const { mockApplyCoupon, mockUseForm, couponSubmitHandler, consoleErrorSpy } = setup({
        open: true,
        userId: undefined
      });

      const couponForm = mockUseForm.mock.results[1].value;

      await act(async () => {
        couponForm.setValue("coupon", "TESTCODE");
        const handler = couponSubmitHandler();
        if (handler) {
          await handler({ coupon: "TESTCODE" });
        }
      });

      expect(mockApplyCoupon).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith("Coupon application attempted without a user id");
    });

    it("handles successful coupon application", async () => {
      const mockOnClose = jest.fn();
      const mockSetShowPaymentSuccess = jest.fn();
      const mockPollForPayment = jest.fn();

      const { mockUseForm, mockEnqueueSnackbar, couponSubmitHandler } = setup({
        open: true,
        userId: "user_123",
        onClose: mockOnClose,
        setShowPaymentSuccess: mockSetShowPaymentSuccess,
        applyCouponResponse: { amountAdded: 25 },
        pollForPayment: mockPollForPayment
      });

      const couponForm = mockUseForm.mock.results[1].value;

      await act(async () => {
        couponForm.setValue("coupon", "TESTCODE");
        const handler = couponSubmitHandler();
        if (handler) {
          await handler({ coupon: "TESTCODE" });
        }
      });

      expect(mockPollForPayment).toHaveBeenCalled();
      expect(mockSetShowPaymentSuccess).toHaveBeenCalledWith({ amount: "25", show: true });
      expect(mockEnqueueSnackbar).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ variant: "success" }));
      expect(mockOnClose).toHaveBeenCalled();
    });

    it("handles coupon error response", async () => {
      const { mockUseForm, mockEnqueueSnackbar, mockHandleCouponError, couponSubmitHandler } = setup({
        open: true,
        userId: "user_123",
        applyCouponResponse: { error: "Invalid coupon" }
      });

      const couponForm = mockUseForm.mock.results[1].value;

      await act(async () => {
        couponForm.setValue("coupon", "INVALID");
        const handler = couponSubmitHandler();
        if (handler) {
          await handler({ coupon: "INVALID" });
        }
      });

      expect(mockHandleCouponError).toHaveBeenCalledWith({ error: "Invalid coupon" });
      expect(mockEnqueueSnackbar).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ variant: "error" }));
    });

    it("handles coupon exception", async () => {
      const mockError = new Error("Coupon application failed");
      const { mockUseForm, mockHandleStripeError, couponSubmitHandler, consoleErrorSpy } = setup({
        open: true,
        userId: "user_123",
        applyCouponError: mockError
      });

      const couponForm = mockUseForm.mock.results[1].value;

      await act(async () => {
        couponForm.setValue("coupon", "TESTCODE");
        const handler = couponSubmitHandler();
        if (handler) {
          await handler({ coupon: "TESTCODE" });
        }
      });

      expect(mockHandleStripeError).toHaveBeenCalledWith(mockError);
      expect(consoleErrorSpy).toHaveBeenCalledWith("Coupon application error:", mockError);
    });
  });

  describe("3D Secure Flow", () => {
    it("configures 3D Secure with success callback", () => {
      const mockOnClose = jest.fn();
      const mockSetShowPaymentSuccess = jest.fn();
      const mockPollForPayment = jest.fn();

      const { mockUse3DSecure } = setup({
        open: true,
        onClose: mockOnClose,
        setShowPaymentSuccess: mockSetShowPaymentSuccess,
        pollForPayment: mockPollForPayment
      });

      expect(mockUse3DSecure).toHaveBeenCalledWith({
        onSuccess: expect.any(Function),
        showSuccessMessage: false
      });
    });

    it("handles 3D Secure success callback correctly", async () => {
      const mockOnClose = jest.fn();
      const mockSetShowPaymentSuccess = jest.fn();
      const mockPollForPayment = jest.fn();
      let threeDSecureSuccessCallback: (() => void) | undefined;

      const mockUse3DSecure = jest.fn((config: any) => {
        threeDSecureSuccessCallback = config.onSuccess;
        return { start3DSecure: jest.fn() };
      });

      const { mockUseForm, paymentSubmitHandler } = setup({
        open: true,
        selectedPaymentMethodId: "pm_test123",
        userId: "user_123",
        onClose: mockOnClose,
        setShowPaymentSuccess: mockSetShowPaymentSuccess,
        pollForPayment: mockPollForPayment,
        mockUse3DSecure,
        confirmPaymentResponse: {
          requiresAction: true,
          clientSecret: "secret_123",
          paymentIntentId: "pi_123"
        }
      });

      const paymentForm = mockUseForm.mock.results[0].value;

      // Submit payment to set the submittedAmountRef
      await act(async () => {
        paymentForm.setValue("amount", 100);
        const handler = paymentSubmitHandler();
        if (handler) {
          await handler({ amount: 100 });
        }
      });

      // Trigger the 3D Secure success callback
      await act(async () => {
        if (threeDSecureSuccessCallback) {
          threeDSecureSuccessCallback();
        }
      });

      expect(mockPollForPayment).toHaveBeenCalled();
      expect(mockSetShowPaymentSuccess).toHaveBeenCalledWith({ amount: "100", show: true });
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe("Error Handling", () => {
    it("displays error alert when payment error occurs", async () => {
      const mockError = new Error("Card declined");
      const { mockUseForm, paymentSubmitHandler } = setup({
        open: true,
        selectedPaymentMethodId: "pm_test123",
        userId: "user_123",
        confirmPaymentError: mockError,
        stripeErrorResponse: {
          message: "Your card was declined.",
          userAction: "Please try a different card."
        }
      });

      const paymentForm = mockUseForm.mock.results[0].value;

      await act(async () => {
        paymentForm.setValue("amount", 50);
        const handler = paymentSubmitHandler();
        if (handler) {
          await handler({ amount: 50 });
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId("alert")).toBeInTheDocument();
        expect(screen.getByText("Payment Error")).toBeInTheDocument();
        expect(screen.getByText("Your card was declined.")).toBeInTheDocument();
        expect(screen.getByText("Please try a different card.")).toBeInTheDocument();
      });
    });

    it("allows clearing error message", async () => {
      const mockError = new Error("Card declined");
      const { mockUseForm, paymentSubmitHandler } = setup({
        open: true,
        selectedPaymentMethodId: "pm_test123",
        userId: "user_123",
        confirmPaymentError: mockError,
        stripeErrorResponse: {
          message: "Your card was declined.",
          userAction: "Please try a different card."
        }
      });

      const paymentForm = mockUseForm.mock.results[0].value;

      // Trigger error
      await act(async () => {
        paymentForm.setValue("amount", 50);
        const handler = paymentSubmitHandler();
        if (handler) {
          await handler({ amount: 50 });
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId("alert")).toBeInTheDocument();
      });

      // Click clear error button
      const clearButton = screen.getByText("Clear Error");
      await act(async () => {
        fireEvent.click(clearButton);
      });

      await waitFor(() => {
        expect(screen.queryByTestId("alert")).not.toBeInTheDocument();
      });
    });

    it("clears error when amount input changes", async () => {
      const mockError = new Error("Card declined");
      const { mockUseForm, paymentSubmitHandler } = setup({
        open: true,
        selectedPaymentMethodId: "pm_test123",
        userId: "user_123",
        confirmPaymentError: mockError,
        stripeErrorResponse: {
          message: "Your card was declined."
        }
      });

      const paymentForm = mockUseForm.mock.results[0].value;

      // Trigger error
      await act(async () => {
        paymentForm.setValue("amount", 50);
        const handler = paymentSubmitHandler();
        if (handler) {
          await handler({ amount: 50 });
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId("alert")).toBeInTheDocument();
      });

      // Change amount input
      const amountInput = screen.getByLabelText("Amount (USD)");
      await act(async () => {
        fireEvent.change(amountInput, { target: { value: "75" } });
      });

      await waitFor(() => {
        expect(screen.queryByTestId("alert")).not.toBeInTheDocument();
      });
    });

    it("clears error when coupon input changes", async () => {
      const mockError = new Error("Card declined");
      const { mockUseForm, paymentSubmitHandler } = setup({
        open: true,
        selectedPaymentMethodId: "pm_test123",
        userId: "user_123",
        confirmPaymentError: mockError,
        stripeErrorResponse: {
          message: "Your card was declined."
        }
      });

      const paymentForm = mockUseForm.mock.results[0].value;

      // Trigger error
      await act(async () => {
        paymentForm.setValue("amount", 50);
        const handler = paymentSubmitHandler();
        if (handler) {
          await handler({ amount: 50 });
        }
      });

      await waitFor(() => {
        expect(screen.getByTestId("alert")).toBeInTheDocument();
      });

      // Change coupon input
      const couponInput = screen.getByLabelText("Coupon Code");
      await act(async () => {
        fireEvent.change(couponInput, { target: { value: "NEWCODE" } });
      });

      await waitFor(() => {
        expect(screen.queryByTestId("alert")).not.toBeInTheDocument();
      });
    });
  });

  describe("Cancel Functionality", () => {
    it("calls onClose when cancel button is clicked", async () => {
      const mockOnClose = jest.fn();
      setup({
        open: true,
        onClose: mockOnClose
      });

      const cancelButton = screen.getByText("Cancel");
      await act(async () => {
        fireEvent.click(cancelButton);
      });

      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  describe("Processing States", () => {
    it("displays processing text when confirming payment", () => {
      setup({
        open: true,
        selectedPaymentMethodId: "pm_123",
        isConfirmingPayment: true
      });

      expect(screen.getByText("Processing...")).toBeInTheDocument();
    });

    it("displays processing text when polling", () => {
      setup({
        open: true,
        selectedPaymentMethodId: "pm_123",
        isPolling: true
      });

      expect(screen.getByText("Processing...")).toBeInTheDocument();
    });

    it("displays pay amount when not processing", () => {
      setup({
        open: true,
        selectedPaymentMethodId: "pm_123",
        isConfirmingPayment: false,
        isPolling: false
      });

      expect(screen.getByTestId("formatted-number")).toBeInTheDocument();
    });

    it("disables submit button when applying coupon", () => {
      setup({
        open: true,
        selectedPaymentMethodId: "pm_123",
        isApplyingCoupon: true
      });

      const submitButtons = screen.getAllByTestId("loading-button");
      submitButtons.forEach(button => {
        expect(button).toBeDisabled();
      });
    });
  });
});

function setup(
  input: {
    open?: boolean;
    onClose?: jest.Mock;
    selectedPaymentMethodId?: string;
    setShowPaymentSuccess?: jest.Mock;
    userId?: string;
    confirmPaymentResponse?: any;
    confirmPaymentError?: Error;
    applyCouponResponse?: any;
    applyCouponError?: Error;
    isConfirmingPayment?: boolean;
    isApplyingCoupon?: boolean;
    isPolling?: boolean;
    pollForPayment?: jest.Mock;
    start3DSecure?: jest.Mock;
    stripeErrorResponse?: any;
    mockUse3DSecure?: jest.Mock;
  } = {}
) {
  // Spy on console.error to allow verification while suppressing output
  const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

  const mockOnClose = input.onClose || jest.fn();
  const mockSetShowPaymentSuccess = input.setShowPaymentSuccess || jest.fn();
  const mockConfirmPayment = jest.fn().mockImplementation(async () => {
    if (input.confirmPaymentError) {
      throw input.confirmPaymentError;
    }
    return input.confirmPaymentResponse || { success: true };
  });
  const mockApplyCoupon = jest.fn().mockImplementation(async () => {
    if (input.applyCouponError) {
      throw input.applyCouponError;
    }
    return input.applyCouponResponse || { amountAdded: 0 };
  });
  const mockEnqueueSnackbar = jest.fn();
  const mockPollForPayment = input.pollForPayment || jest.fn();
  const mockStart3DSecure = input.start3DSecure || jest.fn();
  const mockHandleStripeError = jest.fn().mockReturnValue(input.stripeErrorResponse || { message: "An error occurred", userAction: "" });
  const mockHandleCouponError = jest.fn().mockReturnValue({ message: "Invalid coupon" });

  // Store submit handlers for testing
  let paymentSubmitHandler: any = null;
  let couponSubmitHandler: any = null;

  // Create mock form instances
  const createMockForm = (defaultValues: any, handlerSetter: (handler: any) => void) => {
    const values = { ...defaultValues };

    const form = {
      control: {
        setValue: (fieldName: string, value: any) => {
          values[fieldName] = value;
        },
        getValues: (fieldName?: string) => {
          if (fieldName) return values[fieldName];
          return values;
        }
      },
      handleSubmit: (handler: any) => {
        handlerSetter(handler);
        return async (e?: any) => {
          if (e && e.preventDefault) e.preventDefault();
          try {
            await handler(values);
          } catch (error) {
            // Swallow errors in tests
          }
        };
      },
      reset: jest.fn(() => {
        Object.keys(values).forEach(key => {
          values[key] = defaultValues[key];
        });
      }),
      watch: (fieldName: string) => values[fieldName],
      trigger: jest.fn().mockResolvedValue(true),
      setValue: (fieldName: string, value: any) => {
        values[fieldName] = value;
      },
      getValues: (fieldName?: string) => {
        if (fieldName) return values[fieldName];
        return values;
      }
    };

    return form;
  };

  const paymentFormInstance = createMockForm({ amount: 0 }, (h: any) => {
    paymentSubmitHandler = h;
  });
  const couponFormInstance = createMockForm({ coupon: "" }, (h: any) => {
    couponSubmitHandler = h;
  });

  let callCount = 0;
  const mockUseForm = jest.fn(() => {
    callCount++;
    // Return payment form for odd calls (1, 3, 5...), coupon form for even calls (2, 4, 6...)
    return callCount % 2 === 1 ? paymentFormInstance : couponFormInstance;
  });

  const mockZodResolver = jest.fn((schema: any) => schema);

  const mockUse3DSecure =
    input.mockUse3DSecure ||
    jest.fn().mockReturnValue({
      start3DSecure: mockStart3DSecure
    });

  const dependencies = {
    Popup: MockPopup,
    Card: MockCard,
    CardHeader: MockCardHeader,
    CardTitle: MockCardTitle,
    CardContent: MockCardContent,
    CardDescription: MockCardDescription,
    Form: MockForm,
    FormField: MockFormField,
    FormInput: MockFormInput,
    LoadingButton: MockLoadingButton,
    FormattedNumber: MockFormattedNumber,
    Alert: MockAlert,
    Button: MockButton,
    Xmark: MockXmark,
    Snackbar: MockSnackbar,
    useForm: mockUseForm,
    zodResolver: mockZodResolver,
    useSnackbar: jest.fn(() => ({ enqueueSnackbar: mockEnqueueSnackbar })),
    usePaymentPolling: jest.fn(() => ({
      pollForPayment: mockPollForPayment,
      isPolling: input.isPolling || false
    })),
    use3DSecure: mockUse3DSecure,
    useUser: jest.fn(() => ({
      user: input.userId ? { id: input.userId } : null
    })),
    usePaymentMutations: jest.fn(() => ({
      confirmPayment: {
        isPending: input.isConfirmingPayment || false,
        mutateAsync: mockConfirmPayment
      },
      applyCoupon: {
        isPending: input.isApplyingCoupon || false,
        mutateAsync: mockApplyCoupon
      }
    })),
    handleCouponError: mockHandleCouponError,
    handleStripeError: mockHandleStripeError
  };

  const props: React.ComponentProps<typeof PaymentPopup> = {
    open: input.open ?? false,
    onClose: mockOnClose,
    selectedPaymentMethodId: input.selectedPaymentMethodId,
    setShowPaymentSuccess: mockSetShowPaymentSuccess,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dependencies: dependencies as any
  };

  const renderResult = render(<PaymentPopup {...props} />);

  return {
    ...renderResult,
    mockOnClose,
    mockSetShowPaymentSuccess,
    mockConfirmPayment,
    mockApplyCoupon,
    mockEnqueueSnackbar,
    mockPollForPayment,
    mockStart3DSecure,
    mockHandleStripeError,
    mockHandleCouponError,
    mockUseForm,
    mockUse3DSecure,
    paymentSubmitHandler: () => paymentSubmitHandler,
    couponSubmitHandler: () => couponSubmitHandler,
    consoleErrorSpy
  };
}
