import { NextRequest, NextResponse } from "next/server";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { isOutstandingCredit } from "@/lib/credit";

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
    const transactionsQuery = query(
      collection(db, "transactions"),
      where("vendor_id", "==", vendorId)
    );

    const snapshot = await getDocs(transactionsQuery);
    const transactions = snapshot.docs.map((doc) => doc.data());

    let totalSales = 0;
    let totalCreditOutstanding = 0;
    const perCustomerCredit: Record<string, number> = {};

    for (const txn of transactions) {
      const amount = Number(txn.total_amount) || 0;

      // Cash transactions and settled credit transactions
      // count toward total sales.
      if (txn.payment_type === "cash" || txn.settled === true) {
        totalSales += amount;
      }

      // Only genuinely outstanding credit transactions
      // should count as money still owed.
      if (isOutstandingCredit(txn)) {
        totalCreditOutstanding += amount;

        const name = txn.customer_name || "Unknown";

        perCustomerCredit[name] =
          (perCustomerCredit[name] || 0) + amount;
      }
    }

    return NextResponse.json({
      totalSales,
      totalCreditOutstanding,
      perCustomerCredit,
    });
  } catch (error) {
    console.error("Failed to fetch transaction summary:", error);

    return NextResponse.json(
      {
        error: "Failed to fetch transaction summary",
      },
      { status: 500 }
    );
  }
}