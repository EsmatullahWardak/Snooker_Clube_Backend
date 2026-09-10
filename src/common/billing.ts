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
  const baseAmount = hours
    .mul(hourlyRate)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  return { durationSeconds, baseAmount };
}

export function calculateSettlement(
  baseAmount: Decimal,
  flatDiscountAmount: Decimal,
  adjustedTotalAmount?: Decimal,
): SettlementResult {
  const discountAmount = flatDiscountAmount.toDecimalPlaces(
    2,
    Decimal.ROUND_HALF_UP,
  );
  if (discountAmount.isNegative() || discountAmount.greaterThan(baseAmount)) {
    throw new RangeError(
      'The flat discount must be between zero and the base amount.',
    );
  }

  const discountedTotal = baseAmount
    .sub(discountAmount)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const finalAmount = (adjustedTotalAmount ?? discountedTotal).toDecimalPlaces(
    2,
    Decimal.ROUND_HALF_UP,
  );
  if (finalAmount.isNegative()) {
    throw new RangeError('The adjusted total cannot be negative.');
  }

  return {
    discountAmount,
    manualAdjustmentAmount: finalAmount
      .sub(discountedTotal)
      .toDecimalPlaces(2, Decimal.ROUND_HALF_UP),
    finalAmount,
  };
}
