import Decimal from 'decimal.js';

export interface BillingResult {
  durationSeconds: number;
  baseAmount: Decimal;
}

export interface SettlementResult {
  discountAmount: Decimal;
  manualAdjustmentAmount: Decimal;
  finalAmount: Decimal;
}

const BILLING_INCREMENT = new Decimal(10);

export function roundUpToNearestTen(amount: Decimal): Decimal {
  if (!amount.isFinite() || amount.isNegative()) {
    throw new RangeError('The amount to round must be a non-negative number.');
  }

  return amount.div(BILLING_INCREMENT).ceil().mul(BILLING_INCREMENT);
}

export function calculateBilling(
  startTime: Date,
  endTime: Date,
  hourlyRate: Decimal,
  pausedSeconds = 0,
): BillingResult {
  const elapsedSeconds = Math.floor(
    (endTime.getTime() - startTime.getTime()) / 1000,
  );
  const durationSeconds = Math.max(0, elapsedSeconds - pausedSeconds);
  const hours = new Decimal(durationSeconds).div(3600);
  const baseAmount = roundUpToNearestTen(hours.mul(hourlyRate));
  return { durationSeconds, baseAmount };
}

export function calculateSettlement(
  baseAmount: Decimal,
  flatDiscountAmount: Decimal,
  adjustedTotalAmount?: Decimal,
): SettlementResult {
  const adjustedAmount = (adjustedTotalAmount ?? baseAmount).toDecimalPlaces(
    2,
    Decimal.ROUND_HALF_UP,
  );
  if (adjustedAmount.isNegative()) {
    throw new RangeError('The adjusted total cannot be negative.');
  }

  const discountAmount = flatDiscountAmount.toDecimalPlaces(
    2,
    Decimal.ROUND_HALF_UP,
  );
  if (
    discountAmount.isNegative() ||
    discountAmount.greaterThan(adjustedAmount)
  ) {
    throw new RangeError(
      'The flat discount must be between zero and the adjusted total.',
    );
  }

  const finalAmount = roundUpToNearestTen(adjustedAmount.sub(discountAmount));

  return {
    discountAmount,
    manualAdjustmentAmount: adjustedAmount
      .sub(baseAmount)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    finalAmount,
  };
}
