import { doc, getDoc, setDoc } from "firebase/firestore";
import { CREDIT_LIMIT, LARGE_QUANTITY_THRESHOLD } from "./credit";
import { db } from "./firebase";
import { sendSms } from "./sms";

type Language = "EN" | "LUG" | "MIX";

function localize(language: Language, english: string, luganda: string): string {
  if (language === "EN") return english;
  if (language === "LUG") return luganda;
  return `${english} · ${luganda}`;
}

async function resolveCustomerPhone(
  customerName: string,
  explicitPhone?: string | null,
): Promise<string | null> {
  if (explicitPhone?.trim()) return explicitPhone.trim();

  try {
    const customerSnap = await getDoc(doc(db, "customers", customerName));
    const stored = customerSnap.exists() ? customerSnap.data().phone : undefined;
    if (typeof stored === "string" && stored.trim()) return stored.trim();
  } catch (error) {
    console.error("Failed to look up customer phone:", error);
  }

  return process.env.AT_DEMO_CUSTOMER_PHONE?.trim() || null;
}

export async function rememberCustomerPhone(customerName: string, phone: string): Promise<void> {
  await setDoc(
    doc(db, "customers", customerName),
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
}): Promise<{ debtorSms: boolean; vendorAlerts: number }> {
  let debtorSms = false;
  let vendorAlerts = 0;
  const vendorPhone = process.env.AT_VENDOR_PHONE?.trim();
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

    // Debtor never picked a language, so always show both — MIX regardless of
    // the vendor's own UI setting, so the customer isn't at the mercy of it.
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

    const outstanding = input.outstandingCredit ?? input.amount;
    if (vendorPhone && outstanding > CREDIT_LIMIT) {
      const result = await sendSms(
        vendorPhone,
        localize(
          language,
          `DuukaTalk alert: ${input.customerName} now owes UGX ${outstanding.toLocaleString()}, over the ${CREDIT_LIMIT.toLocaleString()} limit.`,
          `DuukaTalk: ${input.customerName} kati alina omubanja gwa UGX ${outstanding.toLocaleString()}, gusukkiridde ekkomo lya UGX ${CREDIT_LIMIT.toLocaleString()}.`,
        ),
      );
      if (result.sent) vendorAlerts += 1;
    }
  }

  if (vendorPhone && input.quantity > LARGE_QUANTITY_THRESHOLD) {
    const result = await sendSms(
      vendorPhone,
      localize(
        language,
        `DuukaTalk alert: unusually large quantity recorded for ${input.item} (${input.quantity}).`,
        `DuukaTalk: omuwendo omunene ogutali bulijjo gulabiddwa ku ${input.item} (${input.quantity}).`,
      ),
    );
    if (result.sent) vendorAlerts += 1;
  }

  return { debtorSms, vendorAlerts };
}