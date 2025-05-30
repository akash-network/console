import React, { useEffect, useState } from "react";
import type { Coupon } from "@akashnetwork/http-sdk/src/stripe/stripe.service";
import { Alert, Button, Input } from "@akashnetwork/ui/components";
import { useRouter } from "next/router";

import { AkashLogo } from "@src/components/layout/AkashLogo";
import { useCustomUser } from "@src/hooks/useCustomUser";
import { useUser } from "@src/hooks/useUser";
import { stripeService } from "@src/services/http/http-browser.service";

interface AvailableCoupon {
  id: string;
  percent_off?: number | null;
  amount_off?: number | null;
  valid: boolean;
  name?: string;
  description?: string;
}

const CouponPage: React.FunctionComponent = () => {
  const user = useUser();
  const { isLoading: isLoadingUser } = useCustomUser();
  const router = useRouter();
  const [couponId, setCouponId] = useState("");
  const [discount, setDiscount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoApplied, setAutoApplied] = useState(false);
  const [availableCoupons, setAvailableCoupons] = useState<AvailableCoupon[]>([]);
  const [loadingCoupons, setLoadingCoupons] = useState(false);

  useEffect(() => {
    const fetchCoupons = async () => {
      setLoadingCoupons(true);
      try {
        const response = await stripeService.listCoupons();
        setAvailableCoupons(response.coupons);
      } catch (err) {
        console.error("Failed to fetch coupons:", err);
      } finally {
        setLoadingCoupons(false);
      }
    };

    fetchCoupons();
  }, []);

  // Auto-apply coupon if present in URL
  useEffect(() => {
    if (router.isReady && !!user?.userId && !isLoadingUser) {
      const urlCoupon = router.query.code as string | undefined;
      if (urlCoupon && !autoApplied) {
        setCouponId(urlCoupon);
        handleApplyCoupon(urlCoupon, true);
        setAutoApplied(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.isReady, router.query.code, isLoadingUser, user?.userId]);

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
        console.log("REDIRECTING TO SIGNUP");
        // router.push("/signup");
        return;
      }
      const response = await stripeService.applyCoupon(code);
      const coupon: Coupon = response.coupon;
      setDiscount(coupon.percent_off || 0);
      if (!silent) {
        // Redirect to payment page after applying coupon
        console.log("REDIRECTING TO PAYMENT");
        // router.push("/pay");
      }
    } catch (err: any) {
      setError(err.message || "Failed to apply coupon");
    } finally {
      setLoading(false);
    }
  };

  const handleCouponSelect = (coupon: AvailableCoupon) => {
    setCouponId(coupon.id);
    handleApplyCoupon(coupon.id);
  };

  const formatDiscount = (coupon: AvailableCoupon) => {
    if (coupon.percent_off) {
      return `${coupon.percent_off}% OFF`;
    }
    if (coupon.amount_off) {
      return `$${(coupon.amount_off / 100).toFixed(2)} OFF`;
    }
    return "Special Offer";
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <div className="w-full max-w-md rounded-lg p-8 shadow-lg transition-all duration-300 hover:shadow-xl">
        <div className="mb-6 flex justify-center">
          <AkashLogo size={{ width: 400, height: 38 }} className="mb-8 w-full" />
        </div>
        <h1 className="mb-6 text-center text-2xl font-bold">Apply Coupon</h1>
        <div className="mb-4">
          <Input
            type="text"
            value={couponId}
            onChange={e => setCouponId(e.target.value)}
            placeholder="Enter coupon code"
            className="w-full rounded-md border p-2 transition-all duration-300 focus:outline-none"
            disabled={!!router.query.code}
          />
        </div>
        <Button
          onClick={() => handleApplyCoupon()}
          disabled={loading || !!router.query.code}
          className="w-full transition-all duration-300 disabled:opacity-50"
        >
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

        {/* Available Coupons Section */}
        <div className="mt-8">
          <h2 className="mb-4 text-xl font-semibold">Available Coupons</h2>
          {loadingCoupons ? (
            <div className="flex items-center justify-center py-4">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent"></div>
            </div>
          ) : availableCoupons.length > 0 ? (
            <div className="space-y-4">
              {availableCoupons.map(coupon => (
                <div
                  key={coupon.id}
                  className="cursor-pointer rounded-lg border p-4 transition-all duration-300 hover:border-blue-500"
                  onClick={() => handleCouponSelect(coupon)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">{coupon.name || coupon.id}</h3>
                      {coupon.description && <p className="text-sm opacity-75">{coupon.description}</p>}
                    </div>
                    <div className="text-right">
                      <span className="font-bold">{formatDiscount(coupon)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center opacity-75">No coupons available at the moment.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CouponPage;
