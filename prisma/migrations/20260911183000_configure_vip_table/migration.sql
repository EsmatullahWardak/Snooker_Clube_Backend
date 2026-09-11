UPDATE "snooker_tables"
SET
  "name" = 'VIP Table 6',
  "hourlyRateOverride" = COALESCE("hourlyRateOverride", 200),
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "number" = 6;
