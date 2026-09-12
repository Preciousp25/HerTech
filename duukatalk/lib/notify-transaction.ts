import { doc, setDoc } from "firebase/firestore";
import { dispatchVendorAlertSms, resolveCustomerPhone } from "./dispatch-vendor-alerts";
import { db } from "./firebase";
import { Language, localize } from "./risk-flags";
import { sendSms } from "./sms";
import { normalizeCustomerName } from "./credit";

export async function rememberCustomerPhone(customerName: string, phone: string): Promise<void> {
  await setDoc(
    doc(db, "customers", normalizeCustomerName(customerName)),
    { phone, updated_at: new Date().toISOString() },
    { merge: true },
  );
}

export async function notifyAfterTransaction(input: {
  customerName: string | null;
  paymentType: "cash" | "credit";
  item: string;
  amount: number;
  quantity: number;
  dueDate?: string | null;
  outstandingCredit?: number;
  customerPhone?: string | null;
  language?: Language;
}): Promise<{ debtorSms: boolean; vendorAlerts: number; customerAlerts: number }> {
  let debtorSms = false;
  const language = input.language ?? "EN";

  if (input.paymentType === "credit" && input.customerName) {
    const customerPhone = await resolveCustomerPhone(input.customerName, input.customerPhone);
    if (input.customerPhone?.trim()) {
      try {
        await rememberCustomerPhone(input.customerName, input.customerPhone.trim());
      } catch (error) {
        console.error("Failed to store customer phone:", error);
      }
    }

    const dueEn = input.dueDate && input.dueDate !== "N/A" ? ` Pay by ${input.dueDate}.` : "";
    const dueLug = input.dueDate && input.dueDate !== "N/A" ? ` Sasula nga ${input.dueDate}.` : "";
    const debtorMessage = localize(
      "MIX",
      `DuukaTalk: You owe UGX ${input.amount.toLocaleString()} for ${input.item}.${dueEn} — from your vendor.`,
      `DuukaTalk: Olina omubanja gwa UGX ${input.amount.toLocaleString()} ku ${input.item}.${dueLug} — okuva ku katale ko.`,
    );

    if (customerPhone) {
      const result = await sendSms(customerPhone, debtorMessage);
      debtorSms = result.sent;
    }
  }

  const alerts = await dispatchVendorAlertSms(language);
  return {
    debtorSms,
    vendorAlerts: alerts.vendorAlerts,
    customerAlerts: alerts.customerAlerts,
  };
}
