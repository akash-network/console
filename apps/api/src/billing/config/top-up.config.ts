/** Minimum USD amount accepted by a standard (non-trial) paid top-up, shared by trial validation and one-time top-ups. */
export const STANDARD_TOP_UP_MIN_AMOUNT_USD = 20;

/** Mirrors RunPod's auto-pay floor: the lowest balance a user may set as the auto recharge trigger. */
export const AUTO_RELOAD_THRESHOLD_MIN_USD = 10;

/** Mirrors RunPod's auto-pay floor: the lowest amount a single auto recharge may charge, independent of the one-time top-up minimum. */
export const AUTO_RELOAD_AMOUNT_MIN_USD = 25;
