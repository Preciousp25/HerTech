import { Transaction } from "./schema";

export interface FirestoreTransaction {
  id: string;
  transaction_id: string;
  vendor_id: string;
  type: "cash" | "credit";
  item: string;
  quantity: number;
  unit: string | null;
  unit_price: number;
  total_amount: number;
  customer_name: string | null;
  payment_type: "cash" | "credit";
  due_date: string | null;
  timestamp: string;
  raw_transcript: string;
  confidence_flag: boolean;
}

const DEMO_VENDOR_ID = "vendor_001";

export function toFirestoreTransaction(
  transaction: Transaction,
  transcript: string,
  id: string
): FirestoreTransaction {
  return {
    id,
    transaction_id: id,
    vendor_id: DEMO_VENDOR_ID,
    type: transaction.paymentType,
    item: transaction.item,
    quantity: transaction.quantity,
    unit: transaction.unit,
    unit_price: transaction.unitPrice,
    total_amount: transaction.quantity * transaction.unitPrice,
    customer_name: transaction.customerName,
    payment_type: transaction.paymentType,
    due_date: transaction.dueDate,
    timestamp: transaction.timestamp,
    raw_transcript: transcript,
    confidence_flag: transaction.customerName === null || transaction.item.trim() === "",
  };
}