import { NextRequest, NextResponse } from "next/server";
import {
  collection,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  isOutstandingCredit,
  normalizeCustomerName,
} from "@/lib/credit";
import { settleCustomerCredit } from "@/lib/updateCustomerCredit";

const AUTH_COOKIE_NAME = "duukatalk_vendor_id";

interface CreditTransaction {
  id: string;
  payment_type?: string;
  customer_name?: string | null;
  total_amount?: number | string;
  due_date?: string | null;
  vendor_id?: string;
  settled?: boolean;
}

interface CustomerBalance {
  customerName: string;
  owed: number;
  dueDates: string[];
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

    const balances: Record<string, CustomerBalance> = {};

    for (const txn of transactions) {
      // Only include genuinely outstanding credit transactions
      if (!isOutstandingCredit(txn)) {
        continue;
      }

      const name = String(txn.customer_name || "Unknown");
      const amount = Number(txn.total_amount) || 0;

      // Normalize names so variations such as "John Doe" and
      // " john doe " are treated as the same customer.
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

    // Return the array directly so the frontend can call .map()
    // on the response without unwrapping a wrapper object.
    return NextResponse.json(customers);
  } catch (error) {
    console.error("Failed to fetch credit balances:", error);

    return NextResponse.json(
      { error: "Failed to fetch credit balances" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const vendorId = request.cookies.get(AUTH_COOKIE_NAME)?.value;

    if (!vendorId) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    const body = (await request.json()) as {
      customerName?: string;
    };

    const customerName = body.customerName?.trim();

    if (!customerName) {
      return NextResponse.json(
        { error: "customerName is required" },
        { status: 400 }
      );
    }

    const result = await settleCustomerCredit(vendorId, customerName);

    return NextResponse.json({
      customerName,
      ...result,
    });
  } catch (error) {
    console.error("Failed to settle customer credit:", error);

    return NextResponse.json(
      { error: "Failed to record payment" },
      { status: 500 }
    );
  }
}