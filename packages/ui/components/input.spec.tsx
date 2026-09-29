import type { ReactNode } from "react";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import { Form, FormControl, FormField, FormItem, FormLabel } from "./form";
import { FormInput, Input, Textarea } from "./input";
import { Label } from "./label";

import { render, screen } from "@testing-library/react";

describe(Input.name, () => {
  it("is named by an outside label that points at the id it is given", () => {
    render(
      <>
        <Label htmlFor="deployment-name">Deployment name</Label>
        <Input id="deployment-name" />
      </>
    );

    expect(screen.getByRole("textbox", { name: "Deployment name" })).toHaveAttribute("id", "deployment-name");
  });

  it("is named by its own label when it is given an id", () => {
    render(<Input id="deployment-name" label="Deployment name" />);

    expect(screen.getByRole("textbox", { name: "Deployment name" })).toHaveAttribute("id", "deployment-name");
  });

  it("is named by its own label when it has no id", () => {
    render(<Input label="Deployment name" />);

    expect(screen.getByRole("textbox", { name: "Deployment name" })).toBeInTheDocument();
  });

  it("is named by the form label of the form control it sits in", () => {
    renderInForm(field => (
      <FormItem>
        <FormLabel>Deployment name</FormLabel>
        <FormControl>
          <Input {...field} />
        </FormControl>
      </FormItem>
    ));

    expect(screen.getByRole("textbox", { name: "Deployment name" })).toBeInTheDocument();
  });
});

describe(FormInput.name, () => {
  it("is named by its own label", () => {
    renderInForm(field => <FormInput label="Deployment name" {...field} />);

    expect(screen.getByRole("textbox", { name: "Deployment name" })).toBeInTheDocument();
  });
});

describe(Textarea.name, () => {
  it("is named by an outside label that points at the id it is given", () => {
    render(
      <>
        <Label htmlFor="deployment-notes">Notes</Label>
        <Textarea id="deployment-notes" />
      </>
    );

    expect(screen.getByRole("textbox", { name: "Notes" })).toHaveAttribute("id", "deployment-notes");
  });

  it("is named by its own label when it has no id", () => {
    render(<Textarea label="Notes" />);

    expect(screen.getByRole("textbox", { name: "Notes" })).toBeInTheDocument();
  });
});

function renderInForm(renderField: (field: { name: "name"; value: string; onChange: () => void; onBlur: () => void }) => ReactNode) {
  function Harness() {
    const form = useForm<{ name: string }>({ defaultValues: { name: "" } });
    return (
      <Form {...form}>
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => <>{renderField({ name: field.name, value: field.value, onChange: field.onChange, onBlur: field.onBlur })}</>}
        />
      </Form>
    );
  }

  render(<Harness />);
}
