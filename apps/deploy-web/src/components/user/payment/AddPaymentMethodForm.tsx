import React from "react";

import { PaymentMethodForm } from "@src/components/shared";

interface AddPaymentMethodFormProps {
  onSuccess: () => void;
}

export const AddPaymentMethodForm: React.FC<AddPaymentMethodFormProps> = ({ onSuccess }) => {
  return <PaymentMethodForm onSuccess={onSuccess} buttonText="Add Card" processingText="Processing..." />;
};
