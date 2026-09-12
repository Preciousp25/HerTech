import AfricasTalking from "africastalking";

export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, "");
  if (!digits) return null;

  if (digits.startsWith("+")) return digits;
  // Uganda-specific fallbacks below. If #4's language expansion (Acholi,
  // Ateso, Kiswahili) ever brings in customers outside Uganda, this will
  // mis-normalize their numbers silently — revisit before broadening scope.
  if (digits.startsWith("256") && digits.length >= 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length >= 10) return `+256${digits.slice(1)}`;
  if (digits.length === 9) return `+256${digits}`;
  return `+${digits}`;
}

export function isSmsConfigured(): boolean {
  return Boolean(process.env.AT_USERNAME?.trim() && process.env.AT_API_KEY?.trim());
}

export async function sendSms(to: string, message: string): Promise<{ sent: boolean; skipped?: string; error?: string }> {
  const phone = normalizePhone(to);
  if (!phone) {
    console.warn(`Africa's Talking SMS skipped: could not normalize phone "${to}".`);
    return { sent: false, skipped: "invalid_phone" };
  }

  const username = process.env.AT_USERNAME?.trim();
  const apiKey = process.env.AT_API_KEY?.trim();
  if (!username || !apiKey) {
    console.warn("Africa's Talking is not configured; SMS skipped.");
    return { sent: false, skipped: "missing_credentials" };
  }

  try {
    const client = AfricasTalking({ apiKey, username });
    const senderId = process.env.AT_SENDER_ID?.trim();
    await client.SMS.send({
      to: [phone],
      message,
      ...(senderId ? { from: senderId, senderId } : {}),
    });
    return { sent: true };
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "SMS send failed";
    console.error("Africa's Talking SMS error:", messageText);
    return { sent: false, error: messageText };
  }
}