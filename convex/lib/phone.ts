/**
 * Normalises Kenyan phone numbers to the 2547XXXXXXXX / 2541XXXXXXXX format
 * that Daraja's STK push requires. Returns null when the input can't be a
 * valid Safaricom-style MSISDN so callers can reject it server-side.
 */
export function normalizeMsisdn(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  let msisdn: string | null = null;

  if (/^0[17]\d{8}$/.test(digits)) msisdn = "254" + digits.slice(1);
  else if (/^254[17]\d{8}$/.test(digits)) msisdn = digits;
  else if (/^[17]\d{8}$/.test(digits)) msisdn = "254" + digits;

  return msisdn;
}
