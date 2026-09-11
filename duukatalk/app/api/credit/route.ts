import { NextRequest, NextResponse } from "next/server";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

const AUTH_COOKIE_NAME = "duukatalk_vendor_id";

interface CreditTransaction {
  id: string;
  payment_type?: string;
  customer_name?: string | null;
  total_amount?: number | string;
  due_date?: string | null;
  vendor_id?: string;
}

export async function GET(request: NextRequest) {
  try {
    // Get the currently logged-in vendor
    const vendorId = request.cookies.get(AUTH_COOKIE_NAME)?.value;

    if (!vendorId) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    if (!db) {
      return NextResponse.json(
        { error: "Database is not configured" },
        { status: 503 }
      );
    }

    // Only fetch transactions belonging to this vendor
    const transactionsQuery = query(
      collection(db, "transactions"),
      where("vendor_id", "==", vendorId)
    );

    const snapshot = await getDocs(transactionsQuery);

    const transactions: CreditTransaction[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...(doc.data() as Omit<CreditTransaction, "id">),
    }));

    const balances: Record<
      string,
      {
        owed: number;
        dueDates: string[];
      }
    > = {};

    for (const txn of transactions) {
      // Only credit transactions are debts
      if (txn.payment_type?.toLowerCase() !== "credit") {
        continue;
      }

      const name = txn.customer_name || "Unknown";
      const amount = Number(txn.total_amount) || 0;

      if (!balances[name]) {
        balances[name] = {
          owed: 0,
          dueDates: [],
        };
      }

      balances[name].owed += amount;

      if (txn.due_date && txn.due_date !== "N/A") {
        balances[name].dueDates.push(String(txn.due_date));
      }
    }

    const customers = Object.entries(balances).map(([name, data]) => ({
      customerName: name,
      amountOwed: data.owed,
      dueDates: data.dueDates,
    }));

    return NextResponse.json(customers);
  } catch (error) {
    console.error("Failed to fetch credit balances:", error);

    return NextResponse.json(
      { error: "Failed to fetch credit balances" },
      { status: 500 }
    );
  }
}