export const CREDIT_LIMIT = 15000;
export const LARGE_QUANTITY_THRESHOLD = 20;

export function isOutstandingCredit(txn: {
  payment_type?: string;
  settled?: boolean;
}): boolean {
  return (txn.payment_type || "").toLowerCase() === "credit" && txn.settled !== true;
}
