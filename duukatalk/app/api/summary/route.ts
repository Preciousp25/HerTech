import { NextRequest, NextResponse } from "next/server";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  buildLoanGuidance,
  isOutstandingCredit,
  normalizeCustomerName,
  parseGuidanceLanguage,
} from "@/lib/credit";

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

    const language = parseGuidanceLanguage(
      request.nextUrl.searchParams.get("language")
    );

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

    // Load customer profiles so existing outstanding balances
    // are also available in the summary.
    const customerSnapshot = await getDocs(
      collection(db, "customers")
    );

    for (const customerDoc of customerSnapshot.docs) {
      const customer = customerDoc.data();

      const profileName = String(
        customer.customer_name ||
          customerDoc.id ||
          "Unknown"
      );

      const profileKey = normalizeCustomerName(profileName);
      const profileBalance = Number(
        customer.outstanding_credit || 0
      );

      if (profileBalance > 0) {
        perCustomerCredit[profileKey] = profileBalance;
      }
    }

    for (const txn of transactions) {
      const amount = Number(txn.total_amount) || 0;

      // Cash transactions and settled credit transactions
      // count toward total sales.
      if (
        txn.payment_type === "cash" ||
        txn.settled === true
      ) {
        totalSales += amount;
      }

      // Only genuinely outstanding credit transactions
      // should count as money still owed.
      if (isOutstandingCredit(txn)) {
        totalCreditOutstanding += amount;

        const name = String(
          txn.customer_name || "Unknown"
        );

        const key = normalizeCustomerName(name);

        perCustomerCredit[key] =
          (perCustomerCredit[key] || 0) + amount;
      }
    }

    // Build the loan and savings guidance using the vendor's
    // sales and outstanding credit figures.
    const guidance = buildLoanGuidance(
      totalSales,
      totalCreditOutstanding,
      language
    );

    return NextResponse.json({
      totalSales,
      totalCreditOutstanding,
      perCustomerCredit,

      recommendedSavings: guidance.recommendedSavings,
      savingsPercent: guidance.savingsPercent,
      loanReadinessScore: guidance.loanReadinessScore,
      loanAdvice: guidance.loanAdvice,
      creditToSalesRatio: guidance.creditToSalesRatio,
      creditSharePercent: guidance.creditSharePercent,
      shouldStopLending: guidance.shouldStopLending,
    });
  } catch (error) {
    console.error(
      "Failed to fetch transaction summary:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to fetch transaction summary",
      },
      { status: 500 }
    );
  }
}
