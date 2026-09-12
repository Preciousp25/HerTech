import { NextRequest, NextResponse } from "next/server";
import { signupVendor } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      pin,
      businessName,
      ownerName,
      phone,
      country,
      currency,
    } = body ?? {};

    if (
      typeof pin !== "string" ||
      typeof businessName !== "string"
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "pin and businessName are required",
        },
        { status: 400 }
      );
    }

    // ownerName and phone are optional for now.
    if (
      ownerName !== undefined &&
      typeof ownerName !== "string"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "ownerName must be a string if provided",
        },
        { status: 400 }
      );
    }

    if (
      phone !== undefined &&
      typeof phone !== "string"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "phone must be a string if provided",
        },
        { status: 400 }
      );
    }

    // Country and currency are optional until the signup
    // form is updated to collect them.
    if (
      country !== undefined &&
      typeof country !== "string"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "country must be a string if provided",
        },
        { status: 400 }
      );
    }

    if (
      currency !== undefined &&
      typeof currency !== "string"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "currency must be a string if provided",
        },
        { status: 400 }
      );
    }

    await signupVendor({
      pin,
      businessName,
      ownerName,
      phone,
      country,
      currency,
    });

    return NextResponse.json(
      { success: true },
      { status: 200 }
    );
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : "Unknown error";

    console.error("signup error:", message);

    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 400 }
    );
  }
}
