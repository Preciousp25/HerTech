import { NextRequest, NextResponse } from "next/server";
import { signupVendor } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pin, businessName, ownerName, phone } = body ?? {};

    if (typeof pin !== "string" || typeof businessName !== "string") {
      return NextResponse.json(
        { success: false, error: "pin and businessName are required" },
        { status: 400 }
      );
    }

    // ownerName and phone are optional for now — validate their type
    // only if they were actually provided, since the current UI doesn't
    // collect them yet.
    if (ownerName !== undefined && typeof ownerName !== "string") {
      return NextResponse.json(
        { success: false, error: "ownerName must be a string if provided" },
        { status: 400 }
      );
    }
    if (phone !== undefined && typeof phone !== "string") {
      return NextResponse.json(
        { success: false, error: "phone must be a string if provided" },
        { status: 400 }
      );
    }

    const result = await signupVendor({ pin, businessName, ownerName, phone });

    return NextResponse.json({
      success: true,
      vendorId: result.vendorId,
      businessName,
    }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("signup error:", message);
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}