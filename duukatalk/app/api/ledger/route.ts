import { NextRequest, NextResponse } from "next/server";
import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toFirestoreTransaction } from "@/lib/firestore-transaction";
import { notifyAfterTransaction } from "@/lib/notify-transaction";
import { updateCustomerCredit } from "@/lib/updateCustomerCredit";
import { getNextTransactionId } from "@/lib/transaction-id";

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

    // Always use the actual Firestore document ID as "id".
    const transactions = snapshot.docs.map((docSnap) => ({
      ...docSnap.data(),
      id: docSnap.id,
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

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      customer?: string;
      customer_name?: string;
      item?: string;
      amount?: number;
      total_amount?: number;
      paymentType?: "cash" | "credit";
      payment_type?: "cash" | "credit";
      dueDate?: string | null;
      phone?: string | null;
    };

    const customer = (body.customer ?? body.customer_name)?.trim();
    const item = body.item?.trim();
    const amount = Number(body.amount ?? body.total_amount);

    const paymentType =
      (body.paymentType ?? body.payment_type) === "credit"
        ? "credit"
        : "cash";

    if (!customer || !item || !Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        {
          error: "customer, item, and a positive amount are required",
        },
        { status: 400 }
      );
    }

    const transactionId = await getNextTransactionId();
    const timestamp = new Date().toISOString();
    const transactionRef = doc(db, "transactions", transactionId);

    const firestoreTransaction = toFirestoreTransaction(
      {
        item,
        quantity: 1,
        unit: null,
        unitPrice: amount,
        customerName: customer,
        paymentType,
        dueDate:
          paymentType === "credit"
            ? (body.dueDate ?? null)
            : null,
        timestamp,
      },
      "manual entry",
      transactionId
    );

    await setDoc(transactionRef, firestoreTransaction);

    let outstandingCredit: number | undefined;

    if (paymentType === "credit") {
      outstandingCredit =
        (await updateCustomerCredit(customer)) ?? undefined;
    }

    const sms = await notifyAfterTransaction({
      customerName: customer,
      paymentType,
      item,
      amount,
      quantity: 1,
      dueDate: firestoreTransaction.due_date,
      outstandingCredit,
      customerPhone: body.phone,
    });

    return NextResponse.json(
      {
        id: transactionId,
        transaction: firestoreTransaction,
        sms,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error recording ledger entry:", error);

    return NextResponse.json(
      {
        error: "Failed to record transaction",
      },
      { status: 500 }
    );
  }
}