import { NextRequest, NextResponse } from "next/server";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { isOutstandingCredit, normalizeCustomerName } from "@/lib/credit";

const AUTH_COOKIE_NAME = "duukatalk_vendor_id";
const DEMO_VENDOR_ID = "vendor_001";

interface CreditTransaction {
  id: string;
  payment_type?: string;
  customer_name?: string | null;
  total_amount?: number | string;
  due_date?: string | null;
  vendor_id?: string;
  settled?: boolean;
}

export async function GET(request: NextRequest) {
  try {
    const vendorId = request.cookies.get(AUTH_COOKIE_NAME)?.value || DEMO_VENDOR_ID;
    const snapshot = await getDocs(query(
      collection(db, "transactions"),
      where("vendor_id", "==", vendorId)
    ));

    const transactions: CreditTransaction[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<CreditTransaction, "id">),
    }));

    const balances: Record<string, { customerName: string; owed: number; dueDates: string[] }> = {};

    for (const txn of transactions) {
      if (!isOutstandingCredit(txn)) continue;

      const name = String(txn.customer_name || "Unknown");
      const amount = Number(txn.total_amount) || 0;
      const key = normalizeCustomerName(name);

      if (!balances[key]) {
        balances[key] = {
          customerName: name,
          owed: 0,
          dueDates: [],
        };
      }

      balances[key].owed += amount;

      if (txn.due_date && txn.due_date !== "N/A") {
        balances[key].dueDates.push(String(txn.due_date));
      }
    }

    const customers = Object.values(balances)
      .filter((data) => data.owed > 0)
      .map((data) => ({
        customerName: data.customerName,
        amountOwed: data.owed,
        dueDates: data.dueDates,
      }));

    return NextResponse.json({ customers });
  } catch (error) {
    console.error("Failed to fetch credit balances:", error);
    return NextResponse.json(
      { error: "Failed to fetch credit balances" },
      { status: 500 },
    );
  }
}
