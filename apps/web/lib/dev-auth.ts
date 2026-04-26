export function isDevAuthBypass(): boolean {
  return (
    process.env.NODE_ENV === "development" &&
    process.env.MERGESIGNAL_DEV_AUTH_BYPASS === "1"
  );
}
