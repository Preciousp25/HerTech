import { NextResponse } from "next/server";
import { isSmsConfigured, sendSms } from "@/lib/sms";

export async function POST(request: Request) {
  try {
    if (!isSmsConfigured()) {
      return NextResponse.json(
        { error: "Africa's Talking is not configured. Set AT_USERNAME and AT_API_KEY in .env.local." },
        { status: 503 },
      );
    }

    const body = (await request.json()) as {
      type?: "debtor" | "vendor";
      to?: string;
      message?: string;
    };

    const type = body.type === "vendor" ? "vendor" : "debtor";
    const to =
      body.to?.trim() ||
      (type === "vendor"
        ? process.env.AT_VENDOR_PHONE?.trim()
        : process.env.AT_DEMO_CUSTOMER_PHONE?.trim());

    if (!to) {
      return NextResponse.json(
        { error: "No phone number. Pass 'to' or set AT_DEMO_CUSTOMER_PHONE / AT_VENDOR_PHONE." },
        { status: 400 },
      );
    }

    const message =
      body.message?.trim() ||
      (type === "vendor"
        ? "DuukaTalk alert: unpaid credit is growing. Check the risk flags in your ledger."
        : "DuukaTalk: please remember to settle your outstanding balance with your vendor.");

    const result = await sendSms(to, message);
    return NextResponse.json({ type, to, ...result });
  } catch (error) {
    console.error("SMS test error:", error);
    return NextResponse.json({ error: "Failed to send SMS" }, { status: 500 });
  }
}
