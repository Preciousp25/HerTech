export interface Transaction {
  item: string;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  customerName: string | null;
  paymentType: "cash" | "credit";
  dueDate: string | null;
  timestamp: string;
}

export interface VoiceToJsonSuccess {
  success: true;
  transcript: string;
  transaction: Transaction;
}

export interface VoiceToJsonError {
  success: false;
  error: string;
}

export type VoiceToJsonResponse = VoiceToJsonSuccess | VoiceToJsonError;

export function validateTransaction(value: unknown): Transaction {
  if (typeof value !== "object" || value === null) {
    throw new Error("Model response is not an object");
  }

  const obj = value as Record<string, unknown>;

  if (typeof obj.item !== "string" || obj.item.trim() === "") {
    throw new Error("Missing or invalid 'item'");
  }

  if (typeof obj.quantity !== "number" || Number.isNaN(obj.quantity)) {
    throw new Error("Missing or invalid 'quantity'");
  }

  if (obj.unit !== null && typeof obj.unit !== "string") {
    throw new Error("Invalid 'unit'");
  }

  if (typeof obj.unitPrice !== "number" || Number.isNaN(obj.unitPrice)) {
    throw new Error("Missing or invalid 'unitPrice'");
  }

  if (obj.customerName !== null && typeof obj.customerName !== "string") {
    throw new Error("Invalid 'customerName'");
  }

  if (obj.paymentType !== "cash" && obj.paymentType !== "credit") {
    throw new Error("Invalid 'paymentType', must be 'cash' or 'credit'");
  }

  if (obj.dueDate !== null && typeof obj.dueDate !== "string") {
    throw new Error("Invalid 'dueDate'");
  }

  if (typeof obj.timestamp !== "string") {
    throw new Error("Missing or invalid 'timestamp'");
  }

  return {
    item: obj.item,
    quantity: obj.quantity,
    unit: obj.unit as string | null,
    unitPrice: obj.unitPrice,
    customerName: obj.customerName as string | null,
    paymentType: obj.paymentType,
    dueDate: obj.dueDate as string | null,
    timestamp: obj.timestamp,
  };
}