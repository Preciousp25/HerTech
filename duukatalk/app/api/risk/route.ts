import { NextResponse } from "next/server";
import { collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { isOutstandingCredit, CREDIT_LIMIT, LARGE_QUANTITY_THRESHOLD } from "@/lib/credit";

type Transaction = {
  transaction_id?: string;
  payment_type?: string;
  customer_name?: string;
  total_amount?: number | string;
  quantity?: number | string;
  item?: string;
  due_date?: string;
  timestamp?: string;
  settled?: boolean;
};

type Flag = {
  id: string;
  type: "credit_risk" | "stock_movement" | "due_date" | "cash_vs_credit";
  severity: "warning" | "critical";
  message: string;
  details: Record<string, unknown>;
};

export async function GET() {
  try {
    const snapshot = await getDocs(collection(db, "transactions"));
    const transactions = snapshot.docs.map((doc) => doc.data() as Transaction);

    const flags: Flag[] = [];
    const today = new Date().toISOString().split("T")[0]; // "YYYY-MM-DD"

    // Rule 1: customer over credit limit (a new loan pushing them over)
    const creditTotals: Record<string, number> = {};
    for (const txn of transactions) {
      if (isOutstandingCredit(txn)) {
        const name = txn.customer_name || "Unknown";
        const amount = Number(txn.total_amount) || 0;
        creditTotals[name] = (creditTotals[name] || 0) + amount;
      }
    }
    for (const [name, total] of Object.entries(creditTotals)) {
      if (total > CREDIT_LIMIT) {
        flags.push({
          id: `credit_${name}`,
          type: "credit_risk",
          severity: total > CREDIT_LIMIT * 1.5 ? "critical" : "warning",
          message: `${name} now owes UGX ${total.toLocaleString()}, over the ${CREDIT_LIMIT.toLocaleString()} limit`,
          details: { customerName: name, amountOwed: total, limit: CREDIT_LIMIT },
        });
      }
    }

    // Rule 2: unusually large single transaction quantity
    for (const txn of transactions) {
      const quantity = Number(txn.quantity) || 0;
      if (quantity > LARGE_QUANTITY_THRESHOLD) {
        flags.push({
          id: `stock_${txn.transaction_id}`,
          type: "stock_movement",
          severity: "warning",
          message: `Unusually large quantity recorded for ${txn.item} (${quantity})`,
          details: { item: txn.item, quantity, threshold: LARGE_QUANTITY_THRESHOLD, transactionId: txn.transaction_id },
        });
      }
    }

    // Rule 3: due date has arrived or passed, still on credit
    for (const txn of transactions) {
      if (!isOutstandingCredit(txn)) continue;
      if (!txn.due_date || txn.due_date === "N/A") continue;

      const dueDay = txn.due_date.slice(0, 10);
      if (dueDay <= today) {
        flags.push({
          id: `due_${txn.transaction_id}`,
          type: "due_date",
          severity: dueDay < today ? "critical" : "warning",
          message: `${txn.customer_name}'s payment for ${txn.item} was due ${txn.due_date}`,
          details: {
            customerName: txn.customer_name,
            item: txn.item,
            dueDate: txn.due_date,
            amount: Number(txn.total_amount) || 0,
          },
        });
      }
    }

    // Rule 4: shop-wide cash at hand vs total credit outstanding
    let totalCash = 0;
    let totalCredit = 0;
    for (const txn of transactions) {
      const amount = Number(txn.total_amount) || 0;
      if ((txn.payment_type || "").toLowerCase() === "cash" || txn.settled === true) {
        totalCash += amount;
      }
      if (isOutstandingCredit(txn)) totalCredit += amount;
    }
    if (totalCredit > totalCash) {
      flags.push({
        id: "shop_cash_vs_credit",
        type: "cash_vs_credit",
        severity: "critical",
        message: `Outstanding credit (UGX ${totalCredit.toLocaleString()}) exceeds cash at hand (UGX ${totalCash.toLocaleString()})`,
        details: { totalCash, totalCredit },
      });
    }

    return NextResponse.json({ flags });
  } catch (error) {
    console.error("Error checking risk flags:", error);
    return NextResponse.json({ error: "Failed to check risk flags" }, { status: 500 });
  }
}
