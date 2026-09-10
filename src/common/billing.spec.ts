import Decimal from 'decimal.js';
import { calculateBilling, calculateSettlement } from './billing';

describe('calculateBilling', () => {
  it('uses exact active seconds and excludes paused time', () => {
    const start = new Date('2026-08-27T10:00:00.000Z');
    const end = new Date('2026-08-27T11:30:00.000Z');
    const result = calculateBilling(start, end, new Decimal(100), 1800);

    expect(result.durationSeconds).toBe(3600);
    expect(result.baseAmount.toString()).toBe('100');
  });

  it('never produces a negative duration', () => {
    const start = new Date('2026-08-27T11:00:00.000Z');
    const end = new Date('2026-08-27T10:00:00.000Z');
    const result = calculateBilling(start, end, new Decimal(100));
    expect(result.durationSeconds).toBe(0);
    expect(result.baseAmount.toString()).toBe('0');
  });

  it('subtracts a flat discount and records a manual total adjustment', () => {
    const result = calculateSettlement(
      new Decimal(150),
      new Decimal(20),
      new Decimal(140),
    );

    expect(result.discountAmount.toString()).toBe('20');
    expect(result.manualAdjustmentAmount.toString()).toBe('10');
    expect(result.finalAmount.toString()).toBe('140');
  });

  it('rejects a flat discount greater than the base amount', () => {
    expect(() =>
      calculateSettlement(new Decimal(100), new Decimal(100.01)),
    ).toThrow('between zero and the base amount');
  });
});
