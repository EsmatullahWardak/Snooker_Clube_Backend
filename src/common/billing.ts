import Decimal from 'decimal.js';

export interface BillingResult {
  durationSeconds: number;
  baseAmount: Decimal;
  discountAmount: Decimal;
  finalAmount: Decimal;
}

export function calculateBilling(
  startTime: Date,
  endTime: Date,
  hourlyRate: Decimal,
  discountPercent: Decimal,
): BillingResult {
  const durationSeconds = Math.max(
    0,
    Math.floor((endTime.getTime() - startTime.getTime()) / 1000),
  );
  const hours = new Decimal(durationSeconds).div(3600);
  const baseAmount = hours
    .mul(hourlyRate)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const discountAmount = baseAmount
    .mul(discountPercent)
    .div(100)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  const finalAmount = baseAmount
    .sub(discountAmount)
    .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  return { durationSeconds, baseAmount, discountAmount, finalAmount };
}
