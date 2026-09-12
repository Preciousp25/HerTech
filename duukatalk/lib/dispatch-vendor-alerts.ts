import { collection, doc, getDoc, getDocs, setDoc } from "firebase/firestore";
import { CREDIT_LIMIT, normalizeCustomerName } from "./credit";
import { db } from "./firebase";
import {
  Language,
  RiskFlag,
  RiskTransaction,
  alertFingerprint,
  evaluateRiskFlags,
  localize,
} from "./risk-flags";
import { sendSms } from "./sms";

const SMS_ALERTS_COLLECTION = "sms_alerts";

function vendorPhone(): string | null {
  return process.env.AT_VENDOR_PHONE?.trim() || null;
}

function firestoreAlertId(flagId: string, channel: "vendor" | "customer"): string {
  return `${channel}_${flagId}`.replace(/[/#[\]]/g, "_").slice(0, 700);
}

export async function resolveCustomerPhone(
  customerName: string,
  explicitPhone?: string | null,
): Promise<string | null> {
  if (explicitPhone?.trim()) return explicitPhone.trim();

  try {
    const customerSnap = await getDoc(doc(db, "customers", normalizeCustomerName(customerName)));
    const stored = customerSnap.exists() ? customerSnap.data().phone : undefined;
    if (typeof stored === "string" && stored.trim()) return stored.trim();
  } catch (error) {
    console.error("Failed to look up customer phone:", error);
  }

  return process.env.AT_DEMO_CUSTOMER_PHONE?.trim() || null;
}

async function alreadySent(docId: string, fingerprint: string): Promise<boolean> {
  const snap = await getDoc(doc(db, SMS_ALERTS_COLLECTION, docId));
  if (!snap.exists()) return false;
  return snap.data().fingerprint === fingerprint;
}

async function markSent(docId: string, fingerprint: string, extra: Record<string, unknown>): Promise<void> {
  await setDoc(
    doc(db, SMS_ALERTS_COLLECTION, docId),
    {
      fingerprint,
      sent_at: new Date().toISOString(),
      ...extra,
    },
    { merge: true },
  );
}

function customerAlertMessage(flag: RiskFlag): string | null {
  if (flag.type === "credit_risk") {
    const owed = Number(flag.details.amountOwed) || 0;
    return localize(
      "MIX",
      `DuukaTalk: You are over your vendor's UGX ${CREDIT_LIMIT.toLocaleString()} credit limit. You now owe UGX ${owed.toLocaleString()}. Please pay.`,
      `DuukaTalk: Osukkiridde ekkomo ly'omubanja lya UGX ${CREDIT_LIMIT.toLocaleString()} okuva ku katale ko. Kati olina UGX ${owed.toLocaleString()}. Nsaba osasule.`,
    );
  }

  if (flag.type === "due_date") {
    const item = String(flag.details.item ?? "your purchase");
    const dueDate = String(flag.details.dueDate ?? "");
    return localize(
      "MIX",
      `DuukaTalk: Your payment for ${item} was due ${dueDate}. Please settle with your vendor.`,
      `DuukaTalk: Okusasula kwo ku ${item} kwali kutuuse ${dueDate}. Nsaba osasule katale ko.`,
    );
  }

  return null;
}

async function sendOnce(options: {
  docId: string;
  fingerprint: string;
  phone: string;
  message: string;
  extra: Record<string, unknown>;
}): Promise<boolean> {
  if (await alreadySent(options.docId, options.fingerprint)) return false;
  const result = await sendSms(options.phone, options.message);
  if (!result.sent) return false;
  await markSent(options.docId, options.fingerprint, options.extra);
  return true;
}

export async function getAlertSummary(): Promise<{ vendorAlerts: number; customerAlerts: number; flags: number }> {
  const snapshot = await getDocs(collection(db, SMS_ALERTS_COLLECTION));
  let vendorAlerts = 0;
  let customerAlerts = 0;
  const flagIds = new Set<string>();

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data() as { channel?: string; flag_id?: string };
    if (data.channel === 'vendor') vendorAlerts += 1;
    if (data.channel === 'customer') customerAlerts += 1;
    if (data.flag_id) flagIds.add(String(data.flag_id));
  }

  return { vendorAlerts, customerAlerts, flags: flagIds.size };
}

export async function dispatchVendorAlertSms(
  language: Language,
  transactions?: RiskTransaction[],
): Promise<{ vendorAlerts: number; customerAlerts: number; flags: number }> {
  let rows = transactions;
  if (!rows) {
    const snapshot = await getDocs(collection(db, "transactions"));
    rows = snapshot.docs.map((docSnap) => docSnap.data() as RiskTransaction);
  }

  const flags = evaluateRiskFlags(rows, language);
  const shopPhone = vendorPhone();
  let vendorAlerts = 0;
  let customerAlerts = 0;

  for (const flag of flags) {
    const fingerprint = alertFingerprint(flag);

    if (shopPhone) {
      const sent = await sendOnce({
        docId: firestoreAlertId(flag.id, "vendor"),
        fingerprint,
        phone: shopPhone,
        message: `DuukaTalk alert: ${flag.message}`,
        extra: { channel: "vendor", flag_id: flag.id, type: flag.type },
      });
      if (sent) vendorAlerts += 1;
    }

    const customerMessage = customerAlertMessage(flag);
    const customerName = flag.details.customerName;
    if (customerMessage && typeof customerName === "string" && customerName.trim()) {
      const phone = await resolveCustomerPhone(customerName);
      if (phone) {
        const sent = await sendOnce({
          docId: firestoreAlertId(flag.id, "customer"),
          fingerprint,
          phone,
          message: customerMessage,
          extra: { channel: "customer", flag_id: flag.id, type: flag.type, customer: customerName },
        });
        if (sent) customerAlerts += 1;
      }
    }
  }

  return { vendorAlerts, customerAlerts, flags: flags.length };
}
