/**
 * Zemen Bank SMS Gateway utility
 * Sends SMS via the bank's HTTP API gateway.
 * All calls are non-blocking — failures are logged but never thrown.
 */

// Credentials externalized to environment variables (F1). Fallbacks preserve current
// behavior; set these in the environment and rotate the gateway password.
const SMS_GATEWAY = process.env.SMS_GATEWAY_URL || 'https://smsgateway.zemenbank.com/http-api/send';
const SMS_USERNAME = process.env.SMS_USERNAME || 'smartbranch';
const SMS_PASSWORD = process.env.SMS_PASSWORD || 'Y8z6pTB80l6#4siD';
const SMS_FROM = process.env.SMS_FROM || '8011';

/**
 * Format phone number to 251XXXXXXXXX (no +, no leading 0)
 */
function formatPhone(phone: string): string {
  let p = (phone || '').replace(/\+/g, '').replace(/\s/g, '');
  if (p.startsWith('0')) p = '251' + p.substring(1);
  if (!p.startsWith('251')) p = '251' + p;
  return p;
}

/**
 * Send an SMS message via Zemen Bank's gateway.
 * Fire-and-forget safe — never throws, returns true/false.
 */
export async function sendSMS(phone: string, message: string): Promise<boolean> {
  if (!phone) {
    console.warn('[SMS] No phone number provided — skipping');
    return false;
  }

  try {
    const to = formatPhone(phone);
    const encodedContent = encodeURIComponent(message);
    const url = `${SMS_GATEWAY}?username=${SMS_USERNAME}&password=${encodeURIComponent(SMS_PASSWORD)}&to=${to}&from=${SMS_FROM}&coding=8&content=${encodedContent}`;

    console.log(`[SMS] Sending to ${to}...`);
    const res = await fetch(url);

   

    if (res.ok) {
      console.log(`[SMS] Successfully sent to ${to}`);
      return true;
    } else {
      const body = await res.text();
      console.error(`[SMS] Gateway ${res.status} for ${to}:   ${body}`);
      return false;
    }
  } catch (err: any) {
    console.error(`[SMS] Error sending to ${phone}:`, err.message);
    return false;
  }
}
