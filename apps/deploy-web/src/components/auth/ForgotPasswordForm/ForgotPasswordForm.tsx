import { useForm } from "react-hook-form";
import { Alert, AlertDescription, Button, Form, FormField, FormInput, Spinner } from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import { Mail, Undo2 } from "lucide-react";
import { z } from "zod";

type Props = {
  defaultEmail?: string;
  status?: "success" | "error" | "idle" | "pending";
  onSubmit: (values: ForgotPasswordFormValues) => void;
  onGoBack: () => void;
};

const formSchema = z.object({
  email: z.string().email().min(1, { message: "Email is required" })
});

export type ForgotPasswordFormValues = z.infer<typeof formSchema>;

export const ForgotPasswordForm = (props: Props) => {
  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: props.defaultEmail || ""
    }
  });

  const emitSubmit = form.handleSubmit(values => props.onSubmit(values));

  return (
    <Form {...form}>
      <form noValidate={true} autoComplete="on" onSubmit={emitSubmit} className="flex flex-col items-center justify-start gap-5 self-stretch">
        {(props.status === "success" && (
          <Alert variant="success" className="mb-5">
            <AlertDescription>Check your email for password reset instructions. If you don't see the email, check your spam folder.</AlertDescription>
          </Alert>
        )) || (
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormInput
                className="w-full"
                type="email"
                label="Email"
                placeholder="m@example.com"
                value={field.value}
                onChange={event => field.onChange(event.target.value)}
              />
            )}
          />
        )}
        <div className="flex flex-col-reverse gap-5 self-stretch sm:flex-row">
          <Button type="button" onClick={props.onGoBack} variant="outline" className="h-9 flex-1 border-neutral-200 dark:border-neutral-800">
            <Undo2 className="mr-2 h-4 w-4" />
            Go Back to Log in
          </Button>
          {props.status !== "success" && (
            <Button type="submit" disabled={props.status === "pending"} className="h-9 flex-1" aria-label="Send reset email">
              <Mail className="mr-2 h-4 w-4" />
              {props.status === "pending" ? <Spinner size="small" /> : "Send reset email"}
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
};
