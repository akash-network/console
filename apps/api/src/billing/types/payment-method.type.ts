export interface PaymentMethod {
  type: string;
  id: string;
  card?: {
    brand: string | null;
    last4: string | null;
    exp_month: number;
    exp_year: number;
    funding?: string | null;
    country?: string | null;
    network?: string | null;
    fingerprint?: string | null;
    three_d_secure_usage?: {
      supported?: boolean | null;
    } | null;
  } | null;
  billing_details?: {
    address?: {
      city: string | null;
      country: string | null;
      line1: string | null;
      line2: string | null;
      postal_code: string | null;
      state: string | null;
    } | null;
    email?: string | null;
    name?: string | null;
    phone?: string | null;
  };
}
