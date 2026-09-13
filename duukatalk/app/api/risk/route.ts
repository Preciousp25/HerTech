import { after, NextRequest, NextResponse } from "next/server";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { dispatchVendorAlertSms } from "@/lib/dispatch-vendor-alerts";
import { evaluateRiskFlags, parseLanguage, RiskTransaction } from "@/lib/risk-flags";

const AUTH_COOKIE_NAME = "duukatalk_vendor_id";

export async function GET(request: NextRequest) {
  try {
    const language = parseLanguage(request.nextUrl.searchParams.get("language"));
    const vendorId = request.cookies.get(AUTH_COOKIE_NAME)?.value;

    if (!vendorId) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const transactionsQuery = query(
      collection(db, "transactions"),
      where("vendor_id", "==", vendorId)
    );

    const snapshot = await getDocs(transactionsQuery);
    const transactions = snapshot.docs.map((docSnap) => docSnap.data() as RiskTransaction);
    const flags = evaluateRiskFlags(transactions, language);

    after(() => {
      void dispatchVendorAlertSms(language, transactions, vendorId).catch((error) => {
        console.error("Vendor alert SMS dispatch failed:", error);
      });
    });

    return NextResponse.json({ flags });
  } catch (error) {
    console.error("Error checking risk flags:", error);
    return NextResponse.json({ error: "Failed to check risk flags" }, { status: 500 });
  }
}
