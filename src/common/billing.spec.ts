import Decimal from 'decimal.js';
import { calculateBilling } from './billing';

describe('calculateBilling', () => {
  it('uses elapsed seconds and applies the snapshot discount', () => {
    const start = new Date('2026-08-27T10:00:00.000Z');
    const end = new Date('2026-08-27T11:30:00.000Z');
    const result = calculateBilling(
      start,
      end,
      new Decimal(100),
      new Decimal(20),
    );

    expect(result.durationSeconds).toBe(5400);
    expect(result.baseAmount.toString()).toBe('150');
    expect(result.discountAmount.toString()).toBe('30');
    expect(result.finalAmount.toString()).toBe('120');
  });

  it('never produces a negative duration', () => {
    const start = new Date('2026-08-27T11:00:00.000Z');
    const end = new Date('2026-08-27T10:00:00.000Z');
    const result = calculateBilling(
      start,
      end,
      new Decimal(100),
      new Decimal(0),
    );
    expect(result.durationSeconds).toBe(0);
    expect(result.finalAmount.toString()).toBe('0');
  });
});
