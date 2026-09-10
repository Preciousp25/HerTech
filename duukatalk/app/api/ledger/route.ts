import { NextResponse } from "next/server";
import { collection, doc, getDocs, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toFirestoreTransaction } from "@/lib/firestore-transaction";
import { notifyAfterTransaction } from "@/lib/notify-transaction";
import { updateCustomerCredit } from "@/lib/updateCustomerCredit";

export async function GET() {
  try {
    const snapshot = await getDocs(collection(db, "transactions"));
    const transactions = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data(),
    }));

    return NextResponse.json({ transactions });
  } catch (error) {
    console.error("Error fetching ledger:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      customer?: string;
      item?: string;
      amount?: number;
      paymentType?: "cash" | "credit";
      dueDate?: string | null;
      phone?: string | null;
    };

    const customer = body.customer?.trim();
    const item = body.item?.trim();
    const amount = Number(body.amount);
    const paymentType = body.paymentType === "credit" ? "credit" : "cash";

    if (!customer || !item || !amount) {
      return NextResponse.json(
        { error: "customer, item, and amount are required" },
        { status: 400 },
      );
    }

    const timestamp = new Date().toISOString();
    const docRef = doc(collection(db, "transactions"));
    const firestoreTransaction = toFirestoreTransaction(
      {
        item,
        quantity: 1,
        unit: null,
        unitPrice: amount,
        customerName: customer,
        paymentType,
        dueDate: paymentType === "credit" ? (body.dueDate ?? null) : null,
        timestamp,
      },
      "manual entry",
      docRef.id,
    );

    await setDoc(docRef, firestoreTransaction);

    let outstandingCredit: number | undefined;
    if (paymentType === "credit") {
      outstandingCredit = (await updateCustomerCredit(customer)) ?? undefined;
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

    return NextResponse.json({
      transaction: firestoreTransaction,
      sms,
    });
  } catch (error) {
    console.error("Error recording ledger entry:", error);
    return NextResponse.json(
      { error: "Failed to record transaction" },
      { status: 500 },
    );
  }
}
