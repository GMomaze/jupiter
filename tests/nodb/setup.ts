const NO_DATABASE_BOUNDARY_VALUE = 'YES';

if (
  process.env.JUPITER_DENY_LIVE_DB !== undefined &&
  process.env.JUPITER_DENY_LIVE_DB !== NO_DATABASE_BOUNDARY_VALUE
) {
  throw new Error(
    'NO_DATABASE_TEST_BOUNDARY: JUPITER_DENY_LIVE_DB must be exactly YES'
  );
}

process.env.JUPITER_DENY_LIVE_DB = NO_DATABASE_BOUNDARY_VALUE;
