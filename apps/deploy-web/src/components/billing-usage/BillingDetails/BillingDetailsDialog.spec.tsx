import { ApiError } from "@akashnetwork/openapi-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BillingDetails } from "@src/types/billingDetails";
import type { DEPENDENCIES } from "./BillingDetailsDialog";
import { BillingDetailsDialog, INVALID_DETAILS_MESSAGE, INVALID_TAX_ID_MESSAGE } from "./BillingDetailsDialog";

import { render, screen, waitFor } from "@testing-library/react";
import type { UserEvent } from "@testing-library/user-event";
import userEvent from "@testing-library/user-event";

describe("BillingDetailsDialog", () => {
  it("prefills the form with the saved billing details", () => {
    setup({ billingDetails: SAVED });

    expect(screen.getByLabelText("Legal name")).toHaveValue("Acme GmbH");
    expect(screen.getByRole("combobox", { name: "Country" })).toHaveTextContent("Germany");
    expect(screen.getByLabelText("Address")).toHaveValue("Hauptstr. 1");
    expect(screen.getByLabelText("Address line 2 (optional)")).toHaveValue("Hinterhaus");
    expect(screen.getByLabelText("City")).toHaveValue("Berlin");
    expect(screen.getByLabelText("State or region")).toHaveValue("BE");
    expect(screen.getByLabelText("Postal code")).toHaveValue("10115");
    expect(screen.getByRole("combobox", { name: "Tax ID type" })).toHaveTextContent("EU VAT number");
    expect(screen.getByLabelText("Tax ID")).toHaveValue("DE123456789");
  });

  it("prefills only the legal name when the customer has no address or tax ID yet", () => {
    setup({ billingDetails: { legalName: "alice", address: null, taxId: null } });

    expect(screen.getByLabelText("Legal name")).toHaveValue("alice");
    expect(screen.getByLabelText("Address")).toHaveValue("");
    expect(screen.getByLabelText("City")).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "Country" })).toHaveTextContent("Select a country");
    expect(screen.getByRole("combobox", { name: "Tax ID type" })).toHaveTextContent("No tax ID");
  });

  it("starts empty with no tax ID when nothing is saved yet", () => {
    setup({ billingDetails: undefined });

    expect(screen.getByLabelText("Legal name")).toHaveValue("");
    expect(screen.getByRole("combobox", { name: "Country" })).toHaveTextContent("Select a country");
    expect(screen.getByRole("combobox", { name: "Tax ID type" })).toHaveTextContent("No tax ID");
    expect(screen.queryByLabelText("Tax ID")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("saves trimmed details, sends blank optional fields as null and closes", async () => {
    const { user, updateBillingDetails, enqueueSnackbar, onClose } = setup({ billingDetails: undefined });

    await fillIn(user, "Legal name", "  Acme GmbH  ");
    await pickCountry(user, "Germany");
    await fillIn(user, "Address", " Hauptstr. 1 ");
    await user.type(screen.getByLabelText("Address line 2 (optional)"), "   ");
    await fillIn(user, "Postal code", "10115");
    await user.click(screen.getByRole("combobox", { name: "Tax ID type" }));
    await user.click(screen.getByRole("option", { name: "EU VAT number" }));
    expect(screen.getByLabelText("Tax ID")).toHaveAttribute("placeholder", "DE123456789");
    await fillIn(user, "Tax ID", " DE123456789 ");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(updateBillingDetails).toHaveBeenCalledWith({
      data: {
        legalName: "Acme GmbH",
        address: { line1: "Hauptstr. 1", line2: null, city: null, state: null, postalCode: "10115", country: "DE" },
        taxId: { type: "eu_vat", value: "DE123456789" }
      }
    });
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), { variant: "success" });
  });

  it("sends every address field it was given and leaves out a tax ID that did not change", async () => {
    const { user, updateBillingDetails } = setup({ billingDetails: SAVED });

    await user.type(screen.getByLabelText("Tax ID"), " ");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(updateBillingDetails).toHaveBeenCalledWith({
      data: {
        legalName: "Acme GmbH",
        address: { line1: "Hauptstr. 1", line2: "Hinterhaus", city: "Berlin", state: "BE", postalCode: "10115", country: "DE" }
      }
    });
  });

  it("leaves out the tax ID when there was none and none was added", async () => {
    const { user, updateBillingDetails } = setup({ billingDetails: { ...SAVED, taxId: null } });

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(updateBillingDetails.mock.lastCall?.[0].data).not.toHaveProperty("taxId");
  });

  it("sends the tax ID when its value changed", async () => {
    const { user, updateBillingDetails } = setup({ billingDetails: SAVED });

    await user.clear(screen.getByLabelText("Tax ID"));
    await fillIn(user, "Tax ID", "DE999999999");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(updateBillingDetails).toHaveBeenCalledWith({ data: expect.objectContaining({ taxId: { type: "eu_vat", value: "DE999999999" } }) });
  });

  it("sends the tax ID when only its type changed", async () => {
    const { user, updateBillingDetails } = setup({ billingDetails: SAVED });

    await user.click(screen.getByRole("combobox", { name: "Tax ID type" }));
    await user.click(screen.getByRole("option", { name: "UK VAT number" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByLabelText("Tax ID")).toHaveValue("DE123456789");
    expect(updateBillingDetails).toHaveBeenCalledWith({ data: expect.objectContaining({ taxId: { type: "gb_vat", value: "DE123456789" } }) });
  });

  it("shows a tax ID type the form does not offer as read-only and leaves it out when saving", async () => {
    const { user, updateBillingDetails } = setup({ billingDetails: SUPPORT_ADDED_TAX_ID });

    expect(screen.getByRole("combobox", { name: "Tax ID type" })).toHaveTextContent("DE_STN");
    expect(screen.getByLabelText("Tax ID")).toHaveValue("12/345/67890");
    expect(screen.getByLabelText("Tax ID")).toBeDisabled();
    expect(screen.getByLabelText("Tax ID")).toHaveAccessibleDescription(/Contact support to change it/);

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(updateBillingDetails.mock.lastCall?.[0].data).not.toHaveProperty("taxId");
  });

  it("removes a tax ID the form does not offer when no tax ID type is chosen", async () => {
    const { user, updateBillingDetails } = setup({ billingDetails: SUPPORT_ADDED_TAX_ID });

    await user.click(screen.getByRole("combobox", { name: "Tax ID type" }));
    await user.click(screen.getByRole("option", { name: "No tax ID" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(updateBillingDetails).toHaveBeenCalledWith({ data: expect.objectContaining({ taxId: null }) });
  });

  it("replaces a tax ID the form does not offer with one of a type it does offer", async () => {
    const { user, updateBillingDetails } = setup({ billingDetails: SUPPORT_ADDED_TAX_ID });

    await user.click(screen.getByRole("combobox", { name: "Tax ID type" }));
    await user.click(screen.getByRole("option", { name: "EU VAT number" }));

    expect(screen.getByLabelText("Tax ID")).toHaveValue("");
    expect(screen.getByLabelText("Tax ID")).toBeEnabled();
    expect(screen.queryByText(/Contact support to change it/)).not.toBeInTheDocument();

    await fillIn(user, "Tax ID", "DE123456789");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(updateBillingDetails).toHaveBeenCalledWith({ data: expect.objectContaining({ taxId: { type: "eu_vat", value: "DE123456789" } }) });
  });

  it("restores a tax ID the form does not offer when its type is picked again", async () => {
    const { user, updateBillingDetails } = setup({ billingDetails: SUPPORT_ADDED_TAX_ID });

    await user.click(screen.getByRole("combobox", { name: "Tax ID type" }));
    await user.click(screen.getByRole("option", { name: "EU VAT number" }));
    await fillIn(user, "Tax ID", "DE123456789");
    await user.click(screen.getByRole("combobox", { name: "Tax ID type" }));
    await user.click(screen.getByRole("option", { name: "DE_STN" }));

    expect(screen.getByLabelText("Tax ID")).toHaveValue("12/345/67890");
    expect(screen.getByLabelText("Tax ID")).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(updateBillingDetails.mock.lastCall?.[0].data).not.toHaveProperty("taxId");
  });

  it("keeps the value when switching between tax ID types the form offers", async () => {
    const { user } = setup({ billingDetails: SAVED });

    await user.click(screen.getByRole("combobox", { name: "Tax ID type" }));
    await user.click(screen.getByRole("option", { name: "Swiss VAT number" }));

    expect(screen.getByLabelText("Tax ID")).toHaveValue("DE123456789");
    expect(screen.getByLabelText("Tax ID")).toHaveAttribute("placeholder", "CHE-123.456.789 MWST");
  });

  it.each([
    { field: "Legal name", maxLength: "256" },
    { field: "Address", maxLength: "200" },
    { field: "Address line 2 (optional)", maxLength: "200" },
    { field: "City", maxLength: "200" },
    { field: "State or region", maxLength: "200" },
    { field: "Postal code", maxLength: "20" },
    { field: "Tax ID", maxLength: "64" }
  ])("caps the $field at the $maxLength characters the api accepts", ({ field, maxLength }) => {
    setup({ billingDetails: SAVED });

    expect(screen.getByLabelText(field)).toHaveAttribute("maxlength", maxLength);
  });

  it("removes the tax ID when no tax ID type is chosen", async () => {
    const { user, updateBillingDetails } = setup({ billingDetails: SAVED });

    await user.click(screen.getByRole("combobox", { name: "Tax ID type" }));
    await user.click(screen.getByRole("option", { name: "No tax ID" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.queryByLabelText("Tax ID")).not.toBeInTheDocument();
    expect(updateBillingDetails).toHaveBeenCalledWith({ data: expect.objectContaining({ taxId: null }) });
  });

  it.each([{ field: "Legal name" }, { field: "Address" }, { field: "Tax ID" }])("keeps Save disabled while the $field is blank", async ({ field }) => {
    const { user } = setup({ billingDetails: SAVED });

    await user.clear(screen.getByLabelText(field));

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it.each([{ field: "Legal name" }, { field: "Address" }, { field: "Tax ID" }])("keeps Save disabled while the $field holds only spaces", async ({ field }) => {
    const { user } = setup({ billingDetails: SAVED });

    await user.clear(screen.getByLabelText(field));
    await user.type(screen.getByLabelText(field), "   ");

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("keeps Save disabled until a country is chosen", async () => {
    const { user } = setup({ billingDetails: { ...SAVED, address: { ...SAVED.address!, country: null } } });

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    await pickCountry(user, "France");

    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("shows a rejected tax ID under its field and clears the message once it is edited", async () => {
    const { user, updateBillingDetails, onClose } = setup({ billingDetails: SAVED });
    updateBillingDetails.mockRejectedValue(new ApiError(400, { code: "invalid_tax_id", message: "This tax ID is not valid for the selected type" }, "PUT"));

    await user.clear(screen.getByLabelText("Tax ID"));
    await user.type(screen.getByLabelText("Tax ID"), "DE1");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(INVALID_TAX_ID_MESSAGE);
    expect(screen.getByLabelText("Tax ID")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Tax ID")).toHaveAccessibleDescription(INVALID_TAX_ID_MESSAGE);
    expect(onClose).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Tax ID"), "0");

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Tax ID")).toHaveAttribute("aria-invalid", "false");
  });

  it("asks to check the details when the api refuses them for another reason", async () => {
    const { user, updateBillingDetails, onClose } = setup({ billingDetails: SAVED });
    updateBillingDetails.mockRejectedValue(new ApiError(400, { message: "Validation error" }, "PUT"));

    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(INVALID_DETAILS_MESSAGE);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("reports an unexpected failure in a snackbar and keeps the dialog open", async () => {
    const { user, updateBillingDetails, enqueueSnackbar, onClose } = setup({ billingDetails: SAVED });
    updateBillingDetails.mockRejectedValue(new ApiError(500, undefined, "PUT"));

    await user.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => expect(enqueueSnackbar).toHaveBeenCalledWith(expect.anything(), { variant: "error" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes without saving on Cancel", async () => {
    const { user, updateBillingDetails, onClose } = setup({ billingDetails: SAVED });

    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(updateBillingDetails).not.toHaveBeenCalled();
  });

  it("keeps Save disabled while the details are being saved", () => {
    setup({ billingDetails: SAVED, isPending: true });

    expect(screen.getByRole("button", { name: /Save/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });

  async function pickCountry(user: UserEvent, name: string) {
    await user.click(screen.getByRole("combobox", { name: "Country" }));
    await user.click(await screen.findByRole("combobox", { name: "Search countries" }));
    await user.paste(name);
    await user.click(screen.getByRole("option", { name }));
  }

  async function fillIn(user: UserEvent, label: string, text: string) {
    await user.click(screen.getByLabelText(label));
    await user.paste(text);
  }

  function setup(input: { billingDetails: BillingDetails | undefined; isPending?: boolean }) {
    const updateBillingDetails = vi
      .fn<ReturnType<typeof DEPENDENCIES.useUpdateBillingDetailsMutation>["mutateAsync"]>()
      .mockResolvedValue({ data: input.billingDetails ?? SAVED });
    const enqueueSnackbar = vi.fn();
    const onClose = vi.fn();

    const dependencies: typeof DEPENDENCIES = {
      useUpdateBillingDetailsMutation: () =>
        mock<ReturnType<typeof DEPENDENCIES.useUpdateBillingDetailsMutation>>({ mutateAsync: updateBillingDetails, isPending: input.isPending ?? false }),
      useSnackbar: () => mock<ReturnType<typeof DEPENDENCIES.useSnackbar>>({ enqueueSnackbar })
    };

    render(<BillingDetailsDialog billingDetails={input.billingDetails} onClose={onClose} dependencies={dependencies} />);

    return { user: userEvent.setup(), updateBillingDetails, enqueueSnackbar, onClose };
  }
});

const SAVED: BillingDetails = {
  legalName: "Acme GmbH",
  address: { line1: "Hauptstr. 1", line2: "Hinterhaus", city: "Berlin", state: "BE", postalCode: "10115", country: "DE" },
  taxId: { type: "eu_vat", value: "DE123456789", verificationStatus: "verified" }
};

const SUPPORT_ADDED_TAX_ID: BillingDetails = { ...SAVED, taxId: { type: "de_stn", value: "12/345/67890", verificationStatus: null } };
