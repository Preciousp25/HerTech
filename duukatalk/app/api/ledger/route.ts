import { NextRequest, NextResponse } from "next/server";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

const AUTH_COOKIE_NAME = "duukatalk_vendor_id";

export async function GET(request: NextRequest) {
  try {
    // Get the logged-in vendor ID from the authentication cookie.
    const vendorId = request.cookies.get(AUTH_COOKIE_NAME)?.value;

    if (!vendorId) {
      return NextResponse.json(
        {
          error: "Not authenticated",
        },
        { status: 401 }
      );
    }

    // Fetch only transactions belonging to this vendor.
    // Firestore uses "vendor_id" as the field name.
    const transactionsQuery = query(
      collection(db, "transactions"),
      where("vendor_id", "==", vendorId)
    );

    const snapshot = await getDocs(transactionsQuery);

    const transactions = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ transactions });
  } catch (error) {
    console.error("Error fetching ledger:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch transactions",
      },
      { status: 500 }
    );
  }
}