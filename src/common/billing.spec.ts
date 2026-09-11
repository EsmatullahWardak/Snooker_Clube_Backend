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

  it.each([
    ['10.2', '20'],
    ['11', '20'],
    ['19', '20'],
    ['20', '20'],
    ['23', '30'],
    ['1746.89', '1750'],
  ])('rounds a timed charge of %s up to %s', (hourlyRate, expected) => {
    const start = new Date('2026-08-27T10:00:00.000Z');
    const end = new Date('2026-08-27T11:00:00.000Z');
    const result = calculateBilling(start, end, new Decimal(hourlyRate));

    expect(result.baseAmount.toString()).toBe(expected);
  });

  it('rounds an arbitrary playing duration up to the next multiple of ten', () => {
    const start = new Date('2026-08-27T10:00:00.000Z');
    const end = new Date('2026-08-27T11:20:45.000Z');
    const result = calculateBilling(start, end, new Decimal(200));

    expect(result.durationSeconds).toBe(4845);
    expect(result.baseAmount.toString()).toBe('270');
  });

  it('subtracts the flat discount from the cashier override', () => {
    const result = calculateSettlement(
      new Decimal(150),
      new Decimal(20),
      new Decimal(140),
    );

    expect(result.discountAmount.toString()).toBe('20');
    expect(result.manualAdjustmentAmount.toString()).toBe('-10');
    expect(result.finalAmount.toString()).toBe('120');
  });

  it('rounds the override-minus-discount result up for the final slip', () => {
    const result = calculateSettlement(
      new Decimal(8.83),
      new Decimal(4),
      new Decimal(9),
    );

    expect(result.manualAdjustmentAmount.toString()).toBe('0.17');
    expect(result.finalAmount.toString()).toBe('10');
  });

  it('keeps a large flat discount exact when the result is a multiple of ten', () => {
    const result = calculateSettlement(new Decimal(1750), new Decimal(1000));

    expect(result.finalAmount.toString()).toBe('750');
  });

  it('subtracts the flat discount from the base when no override is supplied', () => {
    const result = calculateSettlement(new Decimal(150), new Decimal(20));

    expect(result.manualAdjustmentAmount.toString()).toBe('0');
    expect(result.finalAmount.toString()).toBe('130');
  });

  it('rejects a flat discount greater than the adjusted total', () => {
    expect(() =>
      calculateSettlement(
        new Decimal(100),
        new Decimal(90.01),
        new Decimal(90),
      ),
    ).toThrow('between zero and the adjusted total');
  });
});
