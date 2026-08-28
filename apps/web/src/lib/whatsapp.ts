/**
 * WhatsApp's click-to-chat links (wa.me) want the phone number as digits
 * only, with the country code and no leading "+"/"00"/spaces/dashes — this
 * normalizes whatever format a supervisor typed into `parentPhone` into
 * that shape. It can't guess a missing country code (the org's mosque could
 * be in any country), so a number typed without one will still fail; the
 * caller should treat a too-short result as invalid rather than opening a
 * broken link.
 */
export function toWhatsAppDigits(rawPhone: string): string {
  const trimmed = rawPhone.trim();
  const withoutPlus = trimmed.startsWith("+") ? trimmed.slice(1) : trimmed;
  const digitsOnly = withoutPlus.replace(/\D/g, "");
  return digitsOnly.startsWith("00") ? digitsOnly.slice(2) : digitsOnly;
}

const MIN_VALID_DIGITS = 8;

export function isLikelyValidWhatsAppPhone(rawPhone: string): boolean {
  return toWhatsAppDigits(rawPhone).length >= MIN_VALID_DIGITS;
}

export function buildWhatsAppLink(rawPhone: string, message: string): string {
  const digits = toWhatsAppDigits(rawPhone);
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}

/**
 * Opens WhatsApp (app on mobile, WhatsApp Web on desktop) with `message`
 * pre-filled in the compose box for `rawPhone` — the supervisor still has to
 * tap Send themselves inside WhatsApp; nothing is sent server-side. Returns
 * false without opening anything if the phone doesn't look valid enough to
 * try, so the caller can show an error instead of a broken WhatsApp tab.
 */
export function openWhatsAppChat(rawPhone: string, message: string): boolean {
  if (!isLikelyValidWhatsAppPhone(rawPhone)) return false;
  window.open(buildWhatsAppLink(rawPhone, message), "_blank", "noopener,noreferrer");
  return true;
}
