import { after, NextRequest, NextResponse } from "next/server";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { dispatchVendorAlertSms } from "@/lib/dispatch-vendor-alerts";
import { evaluateRiskFlags, parseLanguage, RiskTransaction } from "@/lib/risk-flags";

export async function GET(request: NextRequest) {
  try {
    const language = parseLanguage(request.nextUrl.searchParams.get("language"));
    const snapshot = await getDocs(collection(db, "transactions"));
    const transactions = snapshot.docs.map((docSnap) => docSnap.data() as RiskTransaction);
    const flags = evaluateRiskFlags(transactions, language);

    after(() => {
      void dispatchVendorAlertSms(language, transactions).catch((error) => {
        console.error("Vendor alert SMS dispatch failed:", error);
      });
    });

    return NextResponse.json({ flags });
  } catch (error) {
    console.error("Error checking risk flags:", error);
    return NextResponse.json({ error: "Failed to check risk flags" }, { status: 500 });
  }
}
