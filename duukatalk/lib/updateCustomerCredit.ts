import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import { isOutstandingCredit } from "./credit";

const TRANSACTIONS_COLLECTION = "transactions";
const CUSTOMERS_COLLECTION = "customers";

async function getCustomerTransactions(customerName: string) {
  const transactionsRef = collection(db, TRANSACTIONS_COLLECTION);
  const customerQuery = query(
    transactionsRef,
    where("customer_name", "==", customerName),
  );
  return getDocs(customerQuery);
}

/**
 * Recalculates outstanding credit for a customer from open credit
 * transactions and writes it to their customer profile.
 */
export async function updateCustomerCredit(
  customerName: string,
): Promise<number | void> {
  if (!customerName?.trim()) return;

  try {
    const snapshot = await getCustomerTransactions(customerName);

    const totalCredit = snapshot.docs.reduce((sum, docSnap) => {
      const data = docSnap.data();
      if (!isOutstandingCredit(data)) return sum;
      return sum + (Number(data.total_amount) || 0);
    }, 0);

    const customerRef = doc(db, CUSTOMERS_COLLECTION, customerName);
    await setDoc(
      customerRef,
      {
        outstanding_credit: totalCredit,
        updated_at: new Date().toISOString(),
      },
      { merge: true },
    );

    return totalCredit;
  } catch (error) {
    console.error("Failed to update customer credit:", error);
    throw error;
  }
}

/**
 * Marks every open credit transaction for the customer as paid, then
 * refreshes their outstanding balance.
 */
export async function settleCustomerCredit(customerName: string): Promise<{
  paidAmount: number;
  outstandingCredit: number;
}> {
  const snapshot = await getCustomerTransactions(customerName);
  const settledAt = new Date().toISOString();
  const batch = writeBatch(db);
  let paidAmount = 0;
  let updates = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    if (!isOutstandingCredit(data)) continue;
    paidAmount += Number(data.total_amount) || 0;
    batch.update(docSnap.ref, {
      settled: true,
      settled_at: settledAt,
    });
    updates += 1;
  }

  if (updates > 0) {
    await batch.commit();
  }

  const outstandingCredit = (await updateCustomerCredit(customerName)) ?? 0;
  return { paidAmount, outstandingCredit };
}
