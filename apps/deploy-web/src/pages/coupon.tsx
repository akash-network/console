import React, { useEffect, useState } from "react";
import type { Coupon } from "@akashnetwork/http-sdk/src/stripe/stripe.service";
import { Alert, Button, Input } from "@akashnetwork/ui/components";
import { useRouter } from "next/router";

import { useUser } from "@src/hooks/useUser";
import { stripeService } from "@src/services/http/http-browser.service";

const CouponPage: React.FunctionComponent = () => {
  const user = useUser();
  const router = useRouter();
  const [couponId, setCouponId] = useState("");
  const [discount, setDiscount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoApplied, setAutoApplied] = useState(false);

  // Auto-apply coupon if present in URL
  useEffect(() => {
    if (router.isReady) {
      const urlCoupon = router.query.coupon as string | undefined;
      if (urlCoupon && !autoApplied) {
        setCouponId(urlCoupon);
        handleApplyCoupon(urlCoupon, true);
        setAutoApplied(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.query.coupon]);

  const handleApplyCoupon = async (id?: string, silent?: boolean) => {
    const code = id ?? couponId;
    if (!code) {
      setError("Please enter a coupon code");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const hasAccount = !!user?.userId;
      if (!hasAccount) {
        // Save coupon code in state and redirect to signup
        localStorage.setItem("pendingCoupon", code);
        router.push("/signup");
        return;
      }
      const response = await stripeService.applyCoupon(code);
      const coupon: Coupon = response.coupon;
      setDiscount(coupon.percent_off || 0);
      if (!silent) {
        // Redirect to payment page after applying coupon
        router.push("/pay");
      }
    } catch (err: any) {
      setError(err.message || "Failed to apply coupon");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <div className="w-full max-w-md rounded-lg p-8 shadow-md">
        <h1 className="mb-6 text-center text-2xl font-bold">Apply Coupon</h1>
        <div className="mb-4">
          <Input
            type="text"
            value={couponId}
            onChange={e => setCouponId(e.target.value)}
            placeholder="Enter coupon code"
            className="w-full rounded-md border border-gray-300 p-2"
            disabled={!!router.query.coupon}
          />
        </div>
        <Button onClick={() => handleApplyCoupon()} disabled={loading || !!router.query.coupon} className="w-full disabled:opacity-50">
          {loading ? "Applying..." : "Apply Coupon"}
        </Button>
        {error && (
          <Alert className="mt-4" variant="destructive">
            {error}
          </Alert>
        )}
        {discount !== null && (
          <div className="mt-4 text-center text-green-600">
            <p>Discount: {discount}%</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CouponPage;
