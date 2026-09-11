'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Mic,
  Moon,
  Sun,
  Store,
  User,
  Package,
  DollarSign,
  CheckCircle,
  BookOpen,
  CreditCard,
  BarChart3,
  Edit3,
  Search,
  ChevronLeft,
  ChevronRight,
  Download,
  AlertCircle,
  TrendingUp,
  Phone,
  Plus,
  Loader2,
  X,
  WifiOff
} from 'lucide-react';
import {
  enqueueOfflineTransaction,
  enqueueOfflineVoiceNote,
  listOfflineTransactions,
  listOfflineVoiceNotes,
  syncOfflineTransactions,
  syncOfflineVoiceNotes,
  type QueuedTransaction,
} from '@/lib/offline-queue';

type TabType = 'record' | 'ledgers' | 'debts' | 'reports';

interface Transaction {
  id: string;
  customer: string;
  initials: string;
  item: string;
  amount: number;
  type: 'cash' | 'credit';
  dueDate?: string;
  date: string;
  queued?: boolean;
}

interface Debt {
  id: string;
  customer: string;
  initials: string;
  item: string;
  amount: number;
  dueDate: string;
}

interface ApiTransaction {
  id?: string;
  transaction_id?: string;
  type?: string;
  item?: string;
  quantity?: number;
  unit?: string;
  total_amount?: number;
  customer_name?: string;
  payment_type?: string;
  due_date?: string;
  timestamp?: string;
  settled?: boolean;
}

interface ApiSummary {
  totalSales?: number;
  totalCreditOutstanding?: number;
  recommendedSavings?: number;
  savingsPercent?: number;
  loanReadinessScore?: number;
  loanAdvice?: string;
  creditToSalesRatio?: number;
  creditSharePercent?: number;
  shouldStopLending?: boolean;
  perCustomerCredit?: Record<string, number>;
}

interface ApiCreditCustomer {
  customerName?: string;
  amountOwed?: number;
  dueDates?: string[];
}

type RiskFlagType = 'credit_risk' | 'stock_movement' | 'due_date' | 'cash_vs_credit';

interface ApiRiskFlag {
  id?: string;
  type: RiskFlagType;
  severity?: 'warning' | 'critical';
  message: string;
}



interface VoiceTransaction {
  item?: string | null;
  quantity?: number | null;
  unit?: string | null;
  unitPrice?: number | null;
  customerName?: string | null;
  paymentType?: string | null;
  dueDate?: string | null;
  timestamp?: string | null;
}

interface VoiceToJsonResponse {
  success: boolean;
  transcript?: string;
  transaction?: VoiceTransaction;
  error?: string;
}

const MOCK_TRANSACTIONS: Transaction[] = [
  { id: '1', customer: 'Ssekandi Patrick', initials: 'SP', item: 'Maize flour 10kg', amount: 22000, type: 'cash', date: 'Today, 2:30 PM' },
  { id: '2', customer: 'Auma Christine', initials: 'AC', item: 'Beans 2kg, Sugar', amount: 18000, type: 'credit', dueDate: 'Due Monday', date: 'Today, 11:15 AM' },
  { id: '3', customer: 'Musa Sserunjogi', initials: 'MS', item: '1 Crate Soda', amount: 35000, type: 'cash', date: 'Today, 9:40 AM' },
  { id: '4', customer: 'Nakato Grace', initials: 'NG', item: '2kg Super Rice', amount: 10000, type: 'credit', dueDate: 'Due Friday', date: 'Yesterday' },
];

const INITIAL_DEBTS: Debt[] = [
  { id: '1', customer: 'Auma Christine', initials: 'AC', item: 'Beans 2kg, Sugar', amount: 18000, dueDate: 'Due Monday' },
  { id: '2', customer: 'Nakato Grace', initials: 'NG', item: '2kg Super Rice', amount: 10000, dueDate: 'Due Friday' },
];

function deriveInitials(name: string): string {
  const initials = name.split(/\s+/).filter(Boolean).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  return initials || '??';
}

function queuedToTransaction(entry: QueuedTransaction): Transaction {
  return {
    id: entry.id,
    customer: entry.customer,
    initials: deriveInitials(entry.customer),
    item: entry.item,
    amount: entry.amount,
    type: entry.paymentType,
    dueDate: entry.paymentType === 'credit' ? 'Due soon' : undefined,
    date: 'Queued',
    queued: true,
  };
}

function safeFormatDate(value?: string | null): string | undefined {
  if (!value) return undefined;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toLocaleDateString();
}

function safeFormatDateTime(value?: string | null): string {
  if (!value) return 'Just now';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Just now';
  return parsed.toLocaleString();
}

const CREDIT_LIMIT = 15000;

type AppLanguage = 'EN' | 'LUG' | 'MIX';

function localizeText(language: AppLanguage, english: string, luganda: string): string {
  return language === 'EN' ? english : language === 'LUG' ? luganda : `${english} \u00b7 ${luganda}`;
}

function getRiskTitle(type: RiskFlagType, language: AppLanguage): string {
  const titles: Record<RiskFlagType, [string, string]> = {
    credit_risk: ['Credit risk', "Akabi k'omubanja"],
    stock_movement: ['Stock alert', "Akabi k'ebiragalidde"],
    due_date: ['Payment due', 'Okusasula kutuuse'],
    cash_vs_credit: ['Cash vs credit', 'Ssente ku mubanja'],
  };
  const [en, lug] = titles[type];
  return localizeText(language, en, lug);
}

function buildRiskFlagsFromTransactions(transactions: Transaction[], language: AppLanguage): ApiRiskFlag[] {
  const flags: ApiRiskFlag[] = [];
  const creditTotals: Record<string, number> = {};
  let totalCash = 0;
  let totalCredit = 0;

  for (const txn of transactions) {
    if (txn.type === 'credit') {
      creditTotals[txn.customer] = (creditTotals[txn.customer] || 0) + txn.amount;
      totalCredit += txn.amount;
    } else {
      totalCash += txn.amount;
    }
  }

  for (const [name, total] of Object.entries(creditTotals)) {
    if (total > CREDIT_LIMIT) {
      flags.push({
        id: `credit_${name}`,
        type: 'credit_risk',
        severity: total > CREDIT_LIMIT * 1.5 ? 'critical' : 'warning',
        message: localizeText(
          language,
          `${name} now owes UGX ${total.toLocaleString()}, over the ${CREDIT_LIMIT.toLocaleString()} limit`,
          `${name} kati alina omubanja gwa UGX ${total.toLocaleString()}, gusukkiridde ekkomo lya UGX ${CREDIT_LIMIT.toLocaleString()}`,
        ),
      });
    }
  }

  for (const txn of transactions) {
    if (txn.type !== 'credit' || !txn.dueDate) continue;
    flags.push({
      id: `due_${txn.id}`,
      type: 'due_date',
      severity: 'warning',
      message: localizeText(
        language,
        `${txn.customer}'s payment for ${txn.item} is ${txn.dueDate.toLowerCase()}`,
        `Okusasula kwa ${txn.customer} ku ${txn.item} ${txn.dueDate.toLowerCase()}`,
      ),
    });
  }

  if (totalCredit > totalCash) {
    flags.push({
      id: 'shop_cash_vs_credit',
      type: 'cash_vs_credit',
      severity: 'critical',
      message: localizeText(
        language,
        `Outstanding credit (UGX ${totalCredit.toLocaleString()}) exceeds cash at hand (UGX ${totalCash.toLocaleString()})`,
        `Amabanja agasigadde (UGX ${totalCredit.toLocaleString()}) gasukkiridde ssente eziriwo (UGX ${totalCash.toLocaleString()})`,
      ),
    });
  }

  return flags;
}

export default function DuukaTalkApp() {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [language, setLanguage] = useState<'EN' | 'LUG' | 'MIX'>('MIX');
  const [activeTab, setActiveTab] = useState<TabType>('record');
  const [transactions, setTransactions] = useState<Transaction[]>(MOCK_TRANSACTIONS);
  const [debts, setDebts] = useState<Debt[]>(INITIAL_DEBTS);
  const [formMessage, setFormMessage] = useState('');
  const [summary, setSummary] = useState<ApiSummary | null>(null);
  const [riskFlags, setRiskFlags] = useState<ApiRiskFlag[]>([]);
  const [hasLiveRisk, setHasLiveRisk] = useState(false);
  const [dismissedRiskIds, setDismissedRiskIds] = useState<string[]>([]);
  const [apiError, setApiError] = useState('');
  const [settlingDebtId, setSettlingDebtId] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [queuedCount, setQueuedCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncingRef = useRef(false);

  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [micError, setMicError] = useState<string>('');
  const [transcript, setTranscript] = useState<string>('');
  const [formData, setFormData] = useState<{ customer: string; item: string; amount: string; paymentType: Transaction['type'] }>({ customer: '', item: '', amount: '', paymentType: 'cash' });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const activeStreamRef = useRef<MediaStream | null>(null);

  const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [searchQuery, setSearchQuery] = useState('');

  const loadApiData = useCallback(async () => {
    const responses = await Promise.allSettled([
      fetch('/api/ledger'),
      fetch(`/api/summary?language=${language}`),
      fetch('/api/credit'),
      fetch(`/api/risk?language=${language}`),
    ]);
    let failedRoutes = 0;

    const readJson = async <T,>(result: PromiseSettledResult<Response>) => {
      if (result.status !== 'fulfilled' || !result.value.ok) {
        failedRoutes += 1;
        return null;
      }
      return result.value.json() as Promise<T>;
    };

    const [ledgerData, summaryData, creditData, riskData] = await Promise.all([
      readJson<{ transactions?: ApiTransaction[] }>(responses[0]),
      readJson<ApiSummary>(responses[1]),
      readJson<ApiCreditCustomer[] | { customers?: ApiCreditCustomer[] }>(responses[2]),
      readJson<{ flags?: ApiRiskFlag[] }>(responses[3]),
    ]);

    const [queued, queuedVoice] = await Promise.all([
      listOfflineTransactions(),
      listOfflineVoiceNotes(),
    ]);
    setQueuedCount(queued.length + queuedVoice.length);
    const queuedUi = queued.map(queuedToTransaction);

    if (ledgerData?.transactions) {
      const live = ledgerData.transactions.map((transaction, index) => {
        const customer = transaction.customer_name || 'Unknown customer';
        const itemParts = [transaction.quantity, transaction.unit, transaction.item].filter(Boolean);
        const isCredit = transaction.settled !== true && (transaction.payment_type || transaction.type || 'cash') === 'credit';
        return {
          id: transaction.id || transaction.transaction_id || `api-${index}`,
          customer,
          initials: deriveInitials(customer),
          item: itemParts.join(' ') || 'Recorded transaction',
          amount: transaction.total_amount || 0,
          type: (isCredit ? 'credit' : 'cash') as Transaction['type'],
          dueDate: isCredit && transaction.due_date ? `Due ${new Date(transaction.due_date).toLocaleDateString()}` : undefined,
          date: transaction.timestamp ? new Date(transaction.timestamp).toLocaleString() : 'Recently',
        };
      });
      setTransactions([...queuedUi, ...live]);
    } else if (queuedUi.length) {
      setTransactions((current) => {
        const withoutQueued = current.filter((t) => !t.queued);
        return [...queuedUi, ...withoutQueued];
      });
    }

    if (summaryData) setSummary(summaryData);

    const creditCustomers = Array.isArray(creditData) ? creditData : creditData?.customers;
    if (creditCustomers) {
      setDebts(creditCustomers.map((customer, index) => ({
        id: `credit-${index}-${customer.customerName || 'customer'}`,
        customer: customer.customerName || 'Unknown customer',
        initials: deriveInitials(customer.customerName || 'UC'),
        item: 'Outstanding balance',
        amount: customer.amountOwed || 0,
        dueDate: customer.dueDates?.[0] ? `Due ${new Date(customer.dueDates[0]).toLocaleDateString()}` : 'No due date',
      })));
    }

    // ✅ FIX: replace flags with a matching id so language changes actually
    // take effect, while keeping any old flags no longer returned.
    if (riskData?.flags) {
      setRiskFlags((prev) => {
        const incoming = riskData.flags as ApiRiskFlag[];
        const incomingIds = new Set(incoming.map((f) => f.id));
        const stale = prev.filter((f) => f.id && !incomingIds.has(f.id));
        return [...stale, ...incoming];
      });
      setHasLiveRisk(true);
    }

    if (failedRoutes > 0) setApiError('Live data is unavailable for some screens. Showing local data.');
    else setApiError('');
  }, [language]);

  useEffect(() => { void loadApiData(); }, [loadApiData]);

  useEffect(() => {
    navigator.serviceWorker?.register('/sw.js').catch(() => undefined);
    const updateOnline = () => setIsOnline(navigator.onLine);
    updateOnline();
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);

  const flushOfflineQueue = useCallback(async () => {
    if (!navigator.onLine || syncingRef.current) return;
    const [pendingTx, pendingVoice] = await Promise.all([
      listOfflineTransactions(),
      listOfflineVoiceNotes(),
    ]);
    if (pendingTx.length === 0 && pendingVoice.length === 0) { setQueuedCount(0); return; }
    syncingRef.current = true;
    setIsSyncing(true);
    try {
      await syncOfflineTransactions();
      await syncOfflineVoiceNotes();
      await loadApiData();
    } catch (error) {
      console.error('Failed to sync offline queue:', error);
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [loadApiData]);

  useEffect(() => {
    if (isOnline) void flushOfflineQueue();
  }, [isOnline, flushOfflineQueue]);

  useEffect(() => {
    return () => { activeStreamRef.current?.getTracks().forEach((track) => track.stop()); };
  }, []);

  const filteredTransactions = transactions.filter((transaction) => {
    const query = searchQuery.trim().toLowerCase();
    return !query || [transaction.customer, transaction.item, transaction.type].some((value) => value.toLowerCase().includes(query));
  });

  const text = (english: string, luganda: string) => language === 'EN' ? english : language === 'LUG' ? luganda : `${english} · ${luganda}`;
  const riskFlagKey = (flag: ApiRiskFlag, index: number) => flag.id || `${flag.type}-${index}`;
  const displayRiskFlags = hasLiveRisk ? riskFlags : buildRiskFlagsFromTransactions(transactions, language);
  const visibleRiskFlags = displayRiskFlags.map((flag, index) => ({ flag, index })).filter(({ flag, index }) => !dismissedRiskIds.includes(riskFlagKey(flag, index)));
  const dismissRiskFlag = (flagId: string) => { setDismissedRiskIds((current) => (current.includes(flagId) ? current : [...current, flagId])); };
  const toggleTheme = () => setIsDarkMode(prev => !prev);

  const handleSaveEntry = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(formData.amount);
    if (!formData.customer.trim() || !formData.item.trim() || !amount) {
      setFormMessage(text('Add a customer, item, and amount first.', "Sooka omuguzi, ekyaguddwa, n'omuwendo nga tonnaba kusiba."));
      return;
    }
    const customerName = formData.customer.trim();
    if (formData.paymentType === 'credit' && (summary?.perCustomerCredit?.[customerName] ?? 0) >= CREDIT_LIMIT) {
      const warn = text(
        `Warning: ${customerName} already has UGX ${(summary?.perCustomerCredit?.[customerName] ?? 0).toLocaleString()} in outstanding credit, above the UGX ${CREDIT_LIMIT.toLocaleString()} limit. Pause new lending and recover cash first.`,
        `Okulabula: ${customerName} alina amabanja agasigadde UGX ${(summary?.perCustomerCredit?.[customerName] ?? 0).toLocaleString()}, okusukka ku kkomo lya UGX ${CREDIT_LIMIT.toLocaleString()}. Lekeka okukuza obulava obupya era funya ssente.`,
      );
      setFormMessage(warn);
      return;
    }
    const newTransaction: Transaction = {
      id: crypto.randomUUID(),
      customer: customerName,
      initials: deriveInitials(customerName),
      item: formData.item.trim(),
      amount,
      type: formData.paymentType,
      dueDate: formData.paymentType === 'credit' ? 'Due soon' : undefined,
      date: 'Just now',
    };

    const saveLocally = (queued: boolean) => {
      const localTransaction = { ...newTransaction, queued, date: queued ? 'Queued' : 'Just now' };
      setTransactions((t) => [localTransaction, ...t.filter((x) => x.id !== localTransaction.id)]);
      if (localTransaction.type === 'credit') {
        setDebts((d) => [{ ...localTransaction, dueDate: 'Due soon' }, ...d.filter((x) => x.id !== localTransaction.id)]);
      }
      setFormData({ customer: '', item: '', amount: '', paymentType: 'cash' });
      setActiveTab('ledgers');
    };

    const shouldQueue = typeof navigator !== 'undefined' && !navigator.onLine;
    if (shouldQueue) {
      await enqueueOfflineTransaction({ id: newTransaction.id, customer: customerName, item: newTransaction.item, amount, paymentType: newTransaction.type });
      setQueuedCount((c) => c + 1);
      saveLocally(true);
      setFormMessage(text('Saved on this phone. It will sync when you are back online.', 'Kiteekeddwa ku ssimu. Kijja kugenda ku mukutu nga interenti ezzudde.'));
      return;
    }

    try {
      const response = await fetch('/api/ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: customerName,
          item: newTransaction.item,
          amount,
          paymentType: newTransaction.type,
          language,
        }),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => null) as { error?: string } | null;
        setFormMessage(result?.error || text('Could not save to the live ledger. Check your connection.', 'Ekitabo tekisobodde kuteekebwako. Kebera network yo.'));
        return;
      }
    } catch {
      await enqueueOfflineTransaction({ id: newTransaction.id, customer: customerName, item: newTransaction.item, amount, paymentType: newTransaction.type });
      setQueuedCount((c) => c + 1);
      saveLocally(true);
      setFormMessage(text('Saved on this phone. It will sync when you are back online.', 'Kiteekeddwa ku ssimu. Kijja kugenda ku mukutu nga interenti ezzudde.'));
      return;
    }

    saveLocally(false);
    setFormMessage(
      newTransaction.type === 'credit'
        ? text("Entry saved. The customer and vendor will get an SMS if Africa's Talking is configured — including credit-limit and other vendor alerts.", "Ekiwandiiko kiteekeddwa. Omuguzi n'akatale bajja kufuna SMS singa Africa's Talking etegekeddwa, nga mwotadde n'ekkomo ly'omubanja n'obulabirizi.")
        : text('Entry saved to your ledger.', 'Ekiwandiiko kiteekeddwa mu bitabo byo.')
    );
  };

  const applyLocalDebtPayment = (debt: Debt) => {
    setDebts((d) => d.filter((x) => x.id !== debt.id));
    setTransactions((t) => t.map((x) => x.type === 'credit' && x.customer === debt.customer ? { ...x, type: 'cash', dueDate: undefined } : x));
    setSummary((s) => s ? { ...s, totalCreditOutstanding: Math.max(0, (s.totalCreditOutstanding || 0) - debt.amount), totalSales: (s.totalSales || 0) + debt.amount } : s);
    setRiskFlags((f) => f.filter((x) => !x.message.toLowerCase().includes(debt.customer.toLowerCase())));
  };

  const handleMarkPaid = async (debt: Debt) => {
    setSettlingDebtId(debt.id);
    try {
      const response = await fetch('/api/credit', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ customerName: debt.customer }) });
      applyLocalDebtPayment(debt);
      if (response.ok) { await loadApiData(); }
      else { setApiError(text('Payment saved on this device only. Live ledger could not be updated.', 'Essente ziteekeddwa ku kyuuma kino kyokka. Ekitabo tekikyusiddwa.')); }
    } catch {
      applyLocalDebtPayment(debt);
      setApiError(text('Payment saved on this device only. Live ledger could not be updated.', 'Essente ziteekeddwa ku kyuuma kino kyokka. Ekitabo tekikyusiddwa.'));
    } finally { setSettlingDebtId(null); }
  };

  const handleExport = () => {
    const csvRows = [['Customer', 'Item', 'Amount (UGX)', 'Type', 'Date'], ...filteredTransactions.map((t) => [t.customer, t.item, String(t.amount), t.type, t.date])];
    const csv = csvRows.map((row) => row.map((v) => `"${v.replaceAll('"', '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = 'duukatalk-ledger.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const stopMicrophoneTracks = () => { activeStreamRef.current?.getTracks().forEach((t) => t.stop()); activeStreamRef.current = null; };

  const queueVoiceNoteOffline = async (audioBlob: Blob) => {
    await enqueueOfflineVoiceNote(audioBlob, audioBlob.type || 'audio/webm');
    setQueuedCount((c) => c + 1);
    setFormMessage(text('Voice note saved on this phone. It will process when you are back online.', "Eddoboozi liteekeddwa ku ssimu. Lijja kukolebwa nga interenti ezzudde."));
  };

  const uploadRecording = async (audioBlob: Blob) => {
    setIsProcessing(true); setMicError('');
    try {
      const fd = new FormData();
      fd.append('audio', audioBlob, 'recording.webm');
      const response = await fetch('/api/voice-to-json', { method: 'POST', body: fd });
      if (!response.ok) {
        const err = await response.json().catch(() => null) as { error?: string } | null;
        setMicError(err?.error || text('The voice service did not respond. Please try again.', "Sevesi y'okuwandiika teziddemu. Ddamu ogezeeko.")); return;
      }
      let data: VoiceToJsonResponse;
      try { data = await response.json() as VoiceToJsonResponse; }
      catch { setMicError(text('Received an unexpected response. Please try again.', "Twafunye eky'okuddamu ekitategeerekeka. Ddamu ogezeeko.")); return; }
      if (!data?.success || !data.transaction) { setMicError(data?.error || text('Could not understand the recording. Please try again.', "Tetusobodde kutegeera ky'owogedde. Ddamu ogezeeko.")); return; }
      const voiceTx = data.transaction;
      const customerName = voiceTx.customerName?.trim() || 'Unknown customer';
      const quantity = typeof voiceTx.quantity === 'number' && !Number.isNaN(voiceTx.quantity) ? voiceTx.quantity : null;
      const unitPrice = typeof voiceTx.unitPrice === 'number' && !Number.isNaN(voiceTx.unitPrice) ? voiceTx.unitPrice : null;
      const amount = quantity !== null && unitPrice !== null ? quantity * unitPrice : 0;
      const itemParts = [quantity, voiceTx.unit, voiceTx.item].filter((p): p is string | number => p !== null && p !== undefined && p !== '');
      const itemLabel = itemParts.length > 0 ? itemParts.join(' ') : text('Recorded item', 'Ekintu ekiwandiikiddwa');
      const paymentType: Transaction['type'] = voiceTx.paymentType === 'credit' ? 'credit' : 'cash';
      if (paymentType === 'credit' && (summary?.perCustomerCredit?.[customerName] ?? 0) >= CREDIT_LIMIT) {
        setMicError(text(
          `Warning: ${customerName} already has UGX ${(summary?.perCustomerCredit?.[customerName] ?? 0).toLocaleString()} in outstanding credit, above the UGX ${CREDIT_LIMIT.toLocaleString()} limit. Pause new lending and recover cash first.`,
          `Okulabula: ${customerName} alina amabanja agasigadde UGX ${(summary?.perCustomerCredit?.[customerName] ?? 0).toLocaleString()}, okusukka ku kkomo lya UGX ${CREDIT_LIMIT.toLocaleString()}. Lekeka okukuza obulava obupya era funya ssente.`,
        ));
        setIsProcessing(false);
        return;
      }
      const dueDateLabel = safeFormatDate(voiceTx.dueDate);
      const newTransaction: Transaction = {
        id: crypto.randomUUID(), customer: customerName, initials: deriveInitials(customerName),
        item: itemLabel, amount, type: paymentType,
        dueDate: paymentType === 'credit' ? (dueDateLabel ? `Due ${dueDateLabel}` : 'Due soon') : (dueDateLabel ? `Due ${dueDateLabel}` : undefined),
        date: safeFormatDateTime(voiceTx.timestamp),
      };
      setTranscript(data.transcript || '');
      setTransactions((t) => [newTransaction, ...t]);
      if (newTransaction.type === 'credit') {
        setDebts((d) => [{ id: newTransaction.id, customer: newTransaction.customer, initials: newTransaction.initials, item: newTransaction.item, amount: newTransaction.amount, dueDate: newTransaction.dueDate || 'Due soon' }, ...d]);
      }
      setFormMessage(text('Entry saved from your voice recording.', "Ekiwandiiko kiteekeddwa okuva mu ky'owogedde."));
      setActiveTab('ledgers');
    } catch { setMicError(text('Something went wrong uploading your recording. Please check your connection and try again.', "Wabaddewo ekizibu nga tuwaayo ky'owogedde. Kebera network yo oyongere ogezeeko.")); }
    finally { setIsProcessing(false); }
  };

  const startRecording = async () => {
    setMicError(''); setTranscript('');
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) { setMicError(text('Microphone access is not supported in this browser.', 'Ekyuma kino tekiyinza kukozesa mikirofoni.')); return; }
    if (typeof MediaRecorder === 'undefined') { setMicError(text('Voice recording is not supported in this browser.', 'Okuwandiika mu ddoboozi tekukoleddwa ku ekyuma kino.')); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      activeStreamRef.current = stream;
      const preferredMimeType = 'audio/webm';
      const recorder = MediaRecorder.isTypeSupported(preferredMimeType) ? new MediaRecorder(stream, { mimeType: preferredMimeType }) : new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e: BlobEvent) => { if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data); };
      recorder.onstop = () => {
        stopMicrophoneTracks();
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || preferredMimeType });
        audioChunksRef.current = [];
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          void queueVoiceNoteOffline(blob);
        } else {
          void uploadRecording(blob);
        }
      };
      recorder.onerror = () => { stopMicrophoneTracks(); setIsRecording(false); setMicError(text('Recording failed. Please try again.', 'Okuwandiika kugaanye. Ddamu ogezeeko.')); };
      mediaRecorderRef.current = recorder; recorder.start(); setIsRecording(true);
    } catch { stopMicrophoneTracks(); setMicError(text('Microphone access was denied or unavailable.', 'Tetuyinzizza kukozesa mikirofoni.')); }
  };

  const stopRecording = () => { const r = mediaRecorderRef.current; if (r && r.state !== 'inactive') { r.stop(); } else { stopMicrophoneTracks(); } setIsRecording(false); };
  const handleMicClick = () => { if (isProcessing) return; if (isRecording) { stopRecording(); } else { void startRecording(); } };

  const micStatusText = isProcessing ? text('Processing...', 'Nkola...') : isRecording ? text('Listening...', 'Mpuliriza...') : text('Tap to Speak', 'Nyiga Owogerere');
  const micAriaLabel = isProcessing ? text('Processing recording', "Nkola ku ky'owogedde") : isRecording ? text('Stop recording', 'Koma okuwandiika') : text('Start recording', 'Tandika okuwandiika');
  const micStatusMessage = isProcessing ? text('Processing your recording…', "Tukola ku ky'owogedde…") : micError ? micError : transcript ? `${text('Heard', 'Kye mpulidde')}: "${transcript}"` : '';

  const renderRecordScreen = () => (
    <div className="space-y-4">
      <div className={`p-3.5 rounded-xl border flex items-center justify-between ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex items-center gap-3">
          <div className="bg-amber-100 dark:bg-amber-900/40 p-2.5 rounded-full text-amber-600"><Store size={20} /></div>
          <div>
            <div className="flex items-center gap-1.5"><span className="font-bold text-sm">Mama Kintu</span><span className="text-sm">👋</span></div>
            <p className="text-xs text-slate-500 dark:text-slate-400">🏬 Stall #42 · Kalerwe Market</p>
          </div>
        </div>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${isOnline ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300' : 'bg-amber-100 text-amber-900 dark:bg-amber-900/60 dark:text-amber-200'}`}>
          {isOnline ? text('Online', 'Ku mukutu') : text('Offline', 'Teri ku mukutu')}
        </span>
      </div>

      <div className="bg-blue-900 rounded-2xl p-6 text-center text-white flex flex-col items-center justify-center shadow-inner">
        <button type="button" onClick={handleMicClick} disabled={isProcessing} aria-pressed={isRecording} aria-label={micAriaLabel}
          className={`w-20 h-20 rounded-full flex items-center justify-center transition-all transform active:scale-95 shadow-lg ${isProcessing ? 'bg-blue-200/60 text-blue-900 cursor-not-allowed' : isRecording ? 'bg-red-500 ring-8 ring-red-400/30 animate-pulse' : 'bg-white text-blue-900 hover:bg-blue-50'}`}>
          {isProcessing ? <Loader2 size={36} className="text-blue-900 animate-spin" /> : <Mic size={36} className={isRecording ? 'text-white' : 'text-blue-900'} />}
        </button>
        <h2 className="mt-4 font-bold text-lg">{micStatusText}</h2>
        <p className="text-xs text-blue-200 mt-1 max-w-xs leading-relaxed">{text('Record a sale or debt in English or Luganda', 'Wandiika amagoba oba amabanja mu Lungereza oba Luganda')}</p>
        <p className="mt-2 min-h-[1rem] text-xs font-medium text-amber-200" role="status">{micStatusMessage}</p>
      </div>

      {apiError && <p className="rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-800" role="status">{text('Live data is unavailable for some screens. Showing local data.', "Data y'okukola tebiriwo ku screen ezimu. Tulaga data ey'omu kitundu.")}</p>}

      <div className="relative flex items-center justify-center py-1">
        <div className="border-t border-slate-200 dark:border-slate-800 w-full"></div>
        <span className="bg-white dark:bg-slate-900 px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider absolute">{text('OR WRITE', 'OBA WANDIIKA')}</span>
      </div>

      <form onSubmit={handleSaveEntry} className="space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400"><Edit3 size={14} /><span>{text('Type manually', "Wandiika n'Engalo")}</span></div>
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">{text('Customer (Name or Phone)', 'Omuguzi (Erinnya oba Ssimu)')}</label>
          <div className="relative"><User size={16} className="absolute left-3 top-2.5 text-slate-400" />
            <input type="text" placeholder="e.g. Nakato Grace or 0772…" value={formData.customer} onChange={(e) => setFormData({ ...formData, customer: e.target.value })} className={`w-full pl-9 pr-3 py-2 text-sm rounded-lg border outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300'}`} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">{text('Item & Quantity', 'Ebyaguddwa')}</label>
          <div className="relative"><Package size={16} className="absolute left-3 top-2.5 text-slate-400" />
            <input type="text" placeholder="e.g. Kasooli 2kg, Amafuta 1L" value={formData.item} onChange={(e) => setFormData({ ...formData, item: e.target.value })} className={`w-full pl-9 pr-3 py-2 text-sm rounded-lg border outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300'}`} />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">{text('Total Amount (UGX)', 'Omuwendo (UGX)')}</label>
          <div className="relative"><span className="absolute left-3 top-2 text-xs font-bold text-slate-400">UGX</span>
            <input type="number" placeholder="0" value={formData.amount} onChange={(e) => setFormData({ ...formData, amount: e.target.value })} className={`w-full pl-12 pr-3 py-2 text-sm font-semibold rounded-lg border outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300'}`} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 pt-1">
          <button type="button" onClick={() => setFormData({ ...formData, paymentType: 'cash' })} className={`py-2 px-3 rounded-lg border flex items-center justify-center gap-2 text-xs font-medium transition ${formData.paymentType === 'cash' ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'}`}><DollarSign size={16} /> 💵 {text('Cash', 'Ensimbi')}</button>
          <button type="button" onClick={() => setFormData({ ...formData, paymentType: 'credit' })} className={`py-2 px-3 rounded-lg border flex items-center justify-center gap-2 text-xs font-medium transition ${formData.paymentType === 'credit' ? 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'}`}><CreditCard size={16} /> 📒 {text('Credit', 'Omubanja')}</button>
        </div>
        <button type="submit" className="w-full py-2.5 mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2 shadow-sm transition"><CheckCircle size={16} /> {text('Save Entry', 'Kola')} ✓</button>
        {formMessage && <p className="text-center text-xs font-medium text-emerald-600 dark:text-emerald-400" role="status">{formMessage}</p>}
      </form>
    </div>
  );

  const renderLedgersScreen = () => (
    <div className="space-y-4 relative min-h-[36.25rem]">
      <div className="flex items-center justify-between gap-2">
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <ChevronLeft size={16} className="cursor-pointer text-slate-400 hover:text-slate-600" /><span>Saturday, 5 Sept</span><ChevronRight size={16} className="cursor-pointer text-slate-400 hover:text-slate-600" />
        </div>
        <button onClick={handleExport} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-blue-800"><Download size={14} /> PDF</button>
      </div>

      <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-medium">
        {(['daily', 'weekly', 'monthly'] as const).map((t) => (
          <button key={t} onClick={() => setTimeframe(t)} className={`py-1.5 rounded-lg transition ${timeframe === t ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-900 dark:text-white font-bold' : 'text-slate-500'}`}>
            {t === 'daily' ? text('Daily', 'Leero') : t === 'weekly' ? text('Weekly', 'Sabiti') : text('Monthly', "Ogw'e")}
          </button>
        ))}
      </div>

      <div className="bg-blue-900 rounded-2xl p-4 text-white shadow-md">
        <div className="flex justify-between items-start">
          <div><span className="text-[11px] text-blue-200 uppercase font-semibold tracking-wider">{text('Total inflows', 'Ebyakolwa')}</span>
            <div className="text-2xl font-extrabold mt-0.5">UGX {(summary?.totalSales || transactions.filter((t) => t.type === 'cash').reduce((s, t) => s + t.amount, 0)).toLocaleString()}</div>
          </div>
          <span className="inline-flex items-center text-xs font-semibold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30"><TrendingUp size={12} className="mr-1" /> +14%</span>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-blue-800/60 text-xs">
          <div><span className="text-blue-300 text-[11px]">{text('Cash in Hand', 'Ssente eziri mu ngalo')}</span><p className="font-bold text-sm">UGX {(summary?.totalSales || transactions.filter((t) => t.type === 'cash').reduce((s, t) => s + t.amount, 0)).toLocaleString()}</p></div>
          <div><span className="text-blue-300 text-[11px]">{text('Credit Given', 'Amabanja agawereddwa')}</span><p className="font-bold text-sm text-amber-300">UGX {(summary?.totalCreditOutstanding || debts.reduce((s, d) => s + d.amount, 0)).toLocaleString()}</p></div>
        </div>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-3 text-slate-400" />
        <input type="text" placeholder={text('Search customer or item…', 'Noonya omuguzi oba ekyaguddwa…')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className={`w-full pl-9 pr-9 py-2.5 text-xs rounded-xl border outline-none ${isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 placeholder-slate-400'}`} />
        <Mic size={16} className="absolute right-3 top-3 text-amber-500 cursor-pointer" />
      </div>

      <div>
        <div className="flex justify-between items-center mb-2 px-1">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{text('Transactions', 'Ebintu Ebyakozesebwa')}</span>
          <span className="text-[11px] text-slate-400">{text('Sorted by recent', 'Bisengekeddwa okusinziira ku bipya')}</span>
        </div>
        <div className="space-y-2">
          {filteredTransactions.map((tx) => (
            <div key={tx.id} className={`p-3 rounded-xl border flex items-center justify-between ${isDarkMode ? 'bg-slate-800/60 border-slate-700/60' : 'bg-white border-slate-100 shadow-sm'}`}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 flex items-center justify-center font-bold text-xs">{tx.initials}</div>
                <div><h4 className="text-xs font-bold">{tx.customer}</h4><p className="text-[11px] text-slate-500 dark:text-slate-400">{tx.item}</p></div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold">UGX {tx.amount.toLocaleString()}</div>
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold mt-0.5 ${tx.queued ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300' : tx.type === 'cash' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'}`}>
                  {tx.queued ? text('Queued', 'Kirinda') : tx.type === 'cash' ? 'Cash' : tx.dueDate}
                </span>
              </div>
            </div>
          ))}
          {filteredTransactions.length === 0 && <p className="py-6 text-center text-xs text-slate-500">{text('No matching transactions.', 'Tewali bizuuliddwa.')}</p>}
        </div>
      </div>
      <button className="absolute bottom-2 right-2 w-12 h-12 bg-amber-500 text-slate-950 rounded-full flex items-center justify-center shadow-lg hover:bg-amber-400 transition"><Mic size={22} /></button>
    </div>
  );

  const renderDebtsScreen = () => (
    <div className="space-y-4">
      <div className="bg-amber-500 rounded-2xl p-4 text-slate-950 shadow-md">
        <div className="flex justify-between items-start">
          <div><span className="text-[11px] font-bold uppercase tracking-wider text-slate-800">{text('Total outstanding debts', 'Amabanja gonna agakyaliwo')}</span><div className="text-2xl font-extrabold mt-0.5">UGX {debts.reduce((s, d) => s + d.amount, 0).toLocaleString()}</div></div>
          <AlertCircle size={22} className="text-slate-900" />
        </div>
        <p className="text-xs mt-2 font-medium text-slate-800">{debts.length} customer{debts.length === 1 ? '' : 's'} with pending balances</p>
      </div>
      <div className="flex justify-between items-center pt-2">
        <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">{text('Active Debts', 'Amabanja agakyaliwo')}</h3>
        <button onClick={() => { setFormData((f) => ({ ...f, paymentType: 'credit' })); setActiveTab('record'); }} className="text-xs text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1"><Plus size={14} /> {text('Add Debt', 'Yongera ibanja')}</button>
      </div>
      <div className="space-y-2.5">
        {debts.map((debt) => (
          <div key={debt.id} className={`p-3.5 rounded-xl border ${isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'}`}>
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">{debt.initials}</div>
                <div><h4 className="text-xs font-bold">{debt.customer}</h4><p className="text-[11px] text-slate-500">{debt.item}</p></div>
              </div>
              <div className="text-right"><span className="text-xs font-bold text-amber-600 dark:text-amber-400">UGX {debt.amount.toLocaleString()}</span><p className="text-[10px] text-red-500 font-semibold">{debt.dueDate}</p></div>
            </div>
            <div className="flex gap-2 mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/50">
              <button onClick={() => void handleMarkPaid(debt)} disabled={settlingDebtId === debt.id} className="flex-1 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1 disabled:opacity-60">
                {settlingDebtId === debt.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}{text('Mark Paid', 'Kiteekeddwaako ssente')}
              </button>
              <button className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium flex items-center justify-center gap-1 text-slate-600 dark:text-slate-300"><Phone size={12} /> {text('Call', 'Kuba essimu')}</button>
            </div>
          </div>
        ))}
        {debts.length === 0 && <p className="py-6 text-center text-xs text-slate-500">{text('All debts are settled.', 'Amabanja gonna gasasuddwa.')}</p>}
      </div>
    </div>
  );

  const renderReportsScreen = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">{text('Business Insights', 'Ebikwata ku Dduuka')}</h3>
        <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold">{text('This Month', 'Omwezi guno')}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className={`p-3.5 rounded-xl border ${isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'}`}>
          <span className="text-[11px] text-slate-500">{text('Total Sales', 'Amagoba gonna')}</span>
          <div className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">UGX {(summary?.totalSales || transactions.filter((t) => t.type === 'cash').reduce((s, t) => s + t.amount, 0)).toLocaleString()}</div>
          <span className="text-[10px] text-emerald-600 font-semibold">{text('↑ 12% vs last month', '↑ 12% okusinga omwezi oguwedde')}</span>
        </div>
        <div className={`p-3.5 rounded-xl border ${isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'}`}>
          <span className="text-[11px] text-slate-500">{text('Total Debt Collected', 'Amabanja agakunganyiziddwa')}</span>
          <div className="text-base font-extrabold text-blue-600 dark:text-blue-400 mt-1">UGX {(summary?.totalCreditOutstanding || debts.reduce((s, d) => s + d.amount, 0)).toLocaleString()}</div>
          <span className="text-[10px] text-blue-600 font-semibold">{text('8 customers paid', 'Abaguzi 8 basasudde')}</span>
        </div>
      </div>

      <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'}`}>
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold mb-3">{text('Savings & loan readiness', 'Okuterekera n\'okufuna olwanji')}</h4>
          <span className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold">{summary?.loanReadinessScore ?? 60}%</span>
        </div>
        <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden mb-2">
          <div className="bg-emerald-600 h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, summary?.loanReadinessScore ?? 60))}%` }}></div>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">{text('Recommended savings target:', 'Ekigendererwa eky\'okuterekera:')}</p>
        <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300 mt-1">UGX {(summary?.recommendedSavings || Math.round(((summary?.totalSales || 0) * (summary?.savingsPercent || 10)) / 100)).toLocaleString()}</p>
        <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-2 leading-snug">{summary?.loanAdvice || text('Save 10% of sales to improve your ability to qualify for a bank loan.', 'Tereka 10% ku magoba okuzimba omutindo gw\'okuyamba okufuna olwanji lwa bank.')}</p>
      </div>

      <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'}`}>
        <h4 className="text-xs font-bold mb-3">{text('Top Selling Items', 'Ebisinga okutundibwa')}</h4>
        <div className="space-y-3">
          {[{ name: 'Super Rice (kg)', value: '142 kg', pct: '85%' }, { name: 'Maize Flour (kg)', value: '98 kg', pct: '65%' }, { name: 'Cooking Oil (L)', value: '45 L', pct: '40%' }].map((item) => (
            <div key={item.name}>
              <div className="flex justify-between text-xs font-medium mb-1"><span>{item.name}</span><span className="font-bold">{item.value}</span></div>
              <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden"><div className="bg-blue-600 h-full rounded-full" style={{ width: item.pct }}></div></div>
            </div>
          ))}
        </div>
      </div>

      {/* ✅ SMS Test Button */}
      <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'}`}>
        <h4 className="text-xs font-bold mb-3">📱 {text('Test SMS', 'Gezaako SMS')}</h4>
        <button
          onClick={async () => {
            try {
              const res = await fetch('/api/sms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  type: 'debtor',
                  message: text(
                    'DuukaTalk: You owe UGX 18,000 for sugar. Pay by Friday. — Your Vendor',
                    'DuukaTalk: Olina omubanja gwa UGX 18,000 ku sukaali. Sasula nga Ffulayidde. — Katale ko'
                  ),
                }),
              });
              const data = await res.json() as { sent?: boolean; error?: string; skipped?: string };
              alert(data.sent ? '✅ SMS sent! Check your phone or AT sandbox.' : `❌ SMS failed: ${data.error ?? data.skipped ?? 'unknown'}`);
            } catch {
              alert('❌ Could not reach SMS route. Is the server running?');
            }
          }}
          className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2 transition"
        >
          📤 {text('Send Test SMS', "Weereza SMS ey'okugezesa")}
        </button>
        <p className="text-[11px] text-slate-400 mt-2 text-center">{text('Sends to AT_DEMO_CUSTOMER_PHONE in .env.local', 'Weereeza ku AT_DEMO_CUSTOMER_PHONE mu .env.local')}</p>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen flex justify-center items-center ${isDarkMode ? 'bg-gray-950 text-white' : 'bg-slate-100 text-slate-800'}`}>
      <div className={`w-full max-w-md min-h-screen sm:min-h-0 sm:h-[52.5rem] sm:rounded-3xl shadow-2xl flex flex-col justify-between overflow-hidden relative ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
        <header className="bg-blue-900 text-white px-5 py-4 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <div className="bg-amber-500 p-2 rounded-lg text-slate-900 font-bold"><Mic size={18} /></div>
            <div>
              <h1 className="font-bold text-base leading-tight">Speak Your Ledger</h1>
              <p className="text-xs text-blue-200">
                {activeTab === 'record' && text('Record', 'Wandiika')}
                {activeTab === 'ledgers' && text('Ledgers', 'Ebitabo')}
                {activeTab === 'debts' && text('Debts & Dues', 'Amabanja')}
                {activeTab === 'reports' && text('Reports', 'Ripoota')}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="language-mode">Language</label>
            <select id="language-mode" value={language} onChange={(e) => setLanguage(e.target.value as 'EN' | 'LUG' | 'MIX')} className="max-w-28 rounded-md border border-blue-600 bg-blue-800/80 px-2 py-1 text-xs font-semibold text-white outline-none">
              <option value="EN">English</option>
              <option value="LUG">Luganda</option>
              <option value="MIX">English + Luganda</option>
            </select>
            <button onClick={toggleTheme} className="p-1.5 text-blue-200 hover:text-white transition" aria-label="Toggle theme">
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {(!isOnline || queuedCount > 0) && (
            <div className={`rounded-lg px-3 py-2 text-xs font-medium flex items-start gap-2 ${isOnline ? 'bg-blue-50 text-blue-900' : 'bg-amber-50 text-amber-950'}`} role="status">
              <WifiOff size={14} className="mt-0.5 shrink-0" />
              <span>
                {!isOnline
                  ? text('You are offline. Typed sales and voice notes are saved on this phone and will sync later.', 'Toli ku mukutu. Ebyawandiikibwa n\'amaloboozi biteekebwa ku ssimu ne bigenda oluvannyuma.')
                  : isSyncing
                    ? text(`Syncing ${queuedCount} queued item(s)…`, `Tusindika ebyateekebwa ${queuedCount}…`)
                    : text(`${queuedCount} item(s) waiting to sync.`, `Ebyateekebwa ${queuedCount} birinda okugenda.`)}
              </span>
            </div>
          )}
          {activeTab === 'record' && renderRecordScreen()}
          {activeTab === 'ledgers' && renderLedgersScreen()}
          {activeTab === 'debts' && renderDebtsScreen()}
          {activeTab === 'reports' && renderReportsScreen()}
        </div>

        {visibleRiskFlags.length > 0 && (
          <div className="absolute inset-0 z-40 flex flex-col justify-start pt-20 px-3 pb-20 pointer-events-none">
            <div className="pointer-events-auto max-h-full overflow-y-auto space-y-2" role="region" aria-label="System alerts">
              {visibleRiskFlags.map(({ flag, index }) => {
                const flagId = riskFlagKey(flag, index);
                const isCritical = flag.severity === 'critical' || flag.type === 'credit_risk' || flag.type === 'cash_vs_credit';
                const title = getRiskTitle(flag.type, language);
                return (
                  <div key={flagId} role="alert" className={`rounded-xl border shadow-lg px-3 py-3 ${isCritical ? 'bg-red-50 border-red-200 text-red-900' : 'bg-amber-50 border-amber-200 text-amber-950'}`}>
                    <div className="flex items-start gap-2">
                      <AlertCircle size={18} className={`mt-0.5 shrink-0 ${isCritical ? 'text-red-600' : 'text-amber-600'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold uppercase tracking-wide">{title}{flag.severity ? ` · ${localizeText(language, flag.severity, flag.severity === 'critical' ? 'kyakabi' : 'kya kwegendereza')}` : ''}</p>
                        <p className="text-sm font-medium leading-snug mt-0.5">{flag.message}</p>
                      </div>
                      <button type="button" onClick={() => dismissRiskFlag(flagId)} className={`shrink-0 rounded-md p-1 ${isCritical ? 'hover:bg-red-100' : 'hover:bg-amber-100'}`} aria-label="Dismiss alert"><X size={16} /></button>
                    </div>
                  </div>
                );
              })}
              {visibleRiskFlags.length > 1 && (
                <button type="button" onClick={() => setDismissedRiskIds(displayRiskFlags.map((f, i) => riskFlagKey(f, i)))} className="w-full rounded-lg bg-slate-900/80 text-white text-xs font-semibold py-2">Dismiss all</button>
              )}
            </div>
          </div>
        )}

        <nav className={`border-t flex justify-around py-2 px-1 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          {([
            { tab: 'record', icon: <Mic size={18} />, label: text('Record', 'Wandiika') },
            { tab: 'ledgers', icon: <BookOpen size={18} />, label: text('Ledgers', 'Ebitabo') },
            { tab: 'debts', icon: <CreditCard size={18} />, label: text('Debts & Dues', 'Amabanja') },
            { tab: 'reports', icon: <BarChart3 size={18} />, label: text('Reports', 'Ripoota') },
          ] as { tab: TabType; icon: React.ReactNode; label: string }[]).map(({ tab, icon, label }) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-xs font-medium transition ${activeTab === tab ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 hover:text-slate-600'}`}>
              {icon}<span>{label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
