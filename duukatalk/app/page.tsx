'use client';

import React, { useEffect, useRef, useState } from 'react';
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
  Plus
} from 'lucide-react';

// --- TYPES & MOCK DATA ---
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
}

interface ApiSummary {
  totalSales?: number;
  totalCreditOutstanding?: number;
}

interface ApiCreditCustomer {
  customerName?: string;
  amountOwed?: number;
  dueDates?: string[];
}

interface ApiRiskFlag {
  type: 'credit_risk' | 'stock_movement';
  message: string;
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

const OFFLINE_QUEUE_KEY = 'duukatalk-offline-queue';

type LedgerPayload = {
  customer_name: string;
  item: string;
  total_amount: number;
  payment_type: Transaction['type'];
};

type QueuedEntry = {
  payload: LedgerPayload;
  transaction: Transaction;
};

function readOfflineQueue(): QueuedEntry[] {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]') as QueuedEntry[];
  } catch {
    return [];
  }
}

function writeOfflineQueue(queue: QueuedEntry[]) {
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
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
  const [apiError, setApiError] = useState('');
  const [voiceMessage, setVoiceMessage] = useState('');
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Screen 1: Record Form State
  const [isRecording, setIsRecording] = useState<boolean>(false);
const [formData, setFormData] = useState<{ customer: string; item: string; amount: string; paymentType: Transaction['type'] }>({ customer: '', item: '', amount: '', paymentType: 'cash' });

  // Screen 2: Ledgers State
  const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [searchQuery, setSearchQuery] = useState('');

  const text = (english: string, luganda: string) => language === 'EN' ? english : language === 'LUG' ? luganda : `${english} · ${luganda}`;

  useEffect(() => {
    navigator.serviceWorker?.register('/sw.js').catch(() => undefined);

    const handleOnline = async () => {
      const queue = readOfflineQueue();
      if (!queue.length) return;

      const remaining: QueuedEntry[] = [];
      for (const entry of queue) {
        try {
          const response = await fetch('/api/ledger', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(entry.payload),
          });
          if (!response.ok) remaining.push(entry);
        } catch {
          remaining.push(entry);
        }
      }
      writeOfflineQueue(remaining);
      if (remaining.length !== queue.length) setFormMessage('Offline entries synced.');
    };
    window.addEventListener('online', handleOnline);

    const loadApiData = async () => {
      const responses = await Promise.allSettled([
        fetch('/api/ledger'),
        fetch('/api/summary'),
        fetch('/api/credit'),
        fetch('/api/risk'),
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
        readJson<{ customers?: ApiCreditCustomer[] }>(responses[2]),
        readJson<{ flags?: ApiRiskFlag[] }>(responses[3]),
      ]);

      if (ledgerData?.transactions) {
        const serverTransactions: Transaction[] = ledgerData.transactions.map((transaction, index) => {
          const customer = transaction.customer_name || 'Unknown customer';
          const itemParts = [transaction.quantity, transaction.unit, transaction.item].filter(Boolean);
          const paymentType: Transaction['type'] = (transaction.payment_type || transaction.type || 'cash') === 'credit' ? 'credit' : 'cash';
          return {
            id: transaction.id || transaction.transaction_id || `api-${index}`,
            customer,
            initials: customer.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
            item: itemParts.join(' ') || 'Recorded transaction',
            amount: transaction.total_amount || 0,
            type: paymentType,
            dueDate: transaction.due_date ? `Due ${new Date(transaction.due_date).toLocaleDateString()}` : undefined,
            date: transaction.timestamp ? new Date(transaction.timestamp).toLocaleString() : 'Recently',
          };
        });
        const queuedTransactions = readOfflineQueue().map((entry) => entry.transaction);
        setTransactions([...queuedTransactions, ...serverTransactions]);
      }
      if (summaryData) setSummary(summaryData);
      if (creditData?.customers) {
        setDebts(creditData.customers.map((customer, index) => ({
          id: `credit-${index}-${customer.customerName || 'customer'}`,
          customer: customer.customerName || 'Unknown customer',
          initials: (customer.customerName || 'UC').split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
          item: 'Outstanding balance',
          amount: customer.amountOwed || 0,
          dueDate: customer.dueDates?.[0] ? `Due ${new Date(customer.dueDates[0]).toLocaleDateString()}` : 'No due date',
        })));
      }
      if (riskData?.flags) setRiskFlags(riskData.flags);
      if (failedRoutes > 0) setApiError('Live data is unavailable for some screens. Showing local data.');
    };

    void loadApiData();

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const filteredTransactions = transactions.filter((transaction) => {
    const query = searchQuery.trim().toLowerCase();
    return !query || [transaction.customer, transaction.item, transaction.type].some((value) => value.toLowerCase().includes(query));
  });

  const toggleTheme = () => setIsDarkMode(prev => !prev);

  const handleVoiceRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setVoiceMessage(text('Voice recording is not supported in this browser.', 'Browser eno tegusobola kuwandiika na ddoboozi.'));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mediaRecorderRef.current = recorder;

      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      });
      recorder.addEventListener('stop', async () => {
        stream.getTracks().forEach((track) => track.stop());
        setIsRecording(false);
        setVoiceMessage(text('Processing recording...', 'Tukola ku ddoboozi...'));

        const audioBlob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const formData = new FormData();
        formData.append('audio', audioBlob, 'sale.webm');

        try {
          const response = await fetch('/api/voice-to-json', { method: 'POST', body: formData });
          const result = await response.json() as { success?: boolean; error?: string; transcript?: string };
          if (!response.ok || !result.success) throw new Error(result.error || 'Voice processing failed');
          setVoiceMessage(result.transcript ? `Heard: ${result.transcript}` : text('Voice entry saved.', 'Ekiwandiiko kyawandiikiddwa.'));
          window.location.reload();
        } catch (error) {
          setVoiceMessage(error instanceof Error ? error.message : text('Voice processing failed.', 'Okukola ku ddoboozi kulemedde.'));
        }
      });

      recorder.start();
      setIsRecording(true);
      setVoiceMessage(text('Listening... tap again to stop.', 'Mpuliriza... nyiga nate okukomya.'));
    } catch {
      setVoiceMessage(text('Microphone access was denied. Allow microphone access and try again.', 'Tonnakkiriza microphone. Kiriza microphone oddemu ogezeeko.'));
    }
  };

  const handleSaveEntry = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(formData.amount);

    if (!formData.customer.trim() || !formData.item.trim() || !amount) {
      setFormMessage(text('Add a customer, item, and amount first.', 'Sooka omuguzi, ekyaguddwa, n’omuwendo nga tonnaba kusiba.'));
      return;
    }

    const customerName = formData.customer.trim();
    const payload: LedgerPayload = {
      customer_name: customerName,
      item: formData.item.trim(),
      total_amount: amount,
      payment_type: formData.paymentType,
    };
    const localId = crypto.randomUUID();
    const localTimestamp = new Date().toISOString();
    const newTransaction: Transaction = {
      id: localId,
      customer: customerName,
      initials: customerName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
      item: formData.item.trim(),
      amount,
      type: formData.paymentType as Transaction['type'],
      dueDate: formData.paymentType === 'credit' ? 'Due soon' : undefined,
      date: new Date(localTimestamp).toLocaleString(),
    };

    try {
      const response = await fetch('/api/ledger', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Save failed');
    } catch {
      const queue = readOfflineQueue();
      writeOfflineQueue([...queue, { payload, transaction: newTransaction }]);
      setFormMessage(text('Saved offline. It will sync when you reconnect.', 'Kuumiddwa awatali mutimbagano. Kijja kuterekebwa nga okomyewo ku mutimbagano.'));
    }

    setTransactions((currentTransactions) => [newTransaction, ...currentTransactions]);
    if (newTransaction.type === 'credit') {
      setDebts((currentDebts) => [
        { ...newTransaction, dueDate: 'Due soon' },
        ...currentDebts,
      ]);
    }
    setFormData({ customer: '', item: '', amount: '', paymentType: 'cash' });
    if (navigator.onLine) setFormMessage(text('Entry saved to your ledger.', 'Ekiwandiiko kiteekeddwa mu bitabo byo.'));
    setActiveTab('ledgers');
  };

  const handleExport = () => {
    const csvRows = [
      ['Customer', 'Item', 'Amount (UGX)', 'Type', 'Date'],
      ...filteredTransactions.map((transaction) => [transaction.customer, transaction.item, String(transaction.amount), transaction.type, transaction.date]),
    ];
    const csv = csvRows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(',')).join('\n');
    const downloadUrl = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const downloadLink = document.createElement('a');
    downloadLink.href = downloadUrl;
    downloadLink.download = 'duukatalk-ledger.csv';
    downloadLink.click();
    URL.revokeObjectURL(downloadUrl);
  };

  // --- SUB-COMPONENTS FOR EACH SCREEN ---

  // 1. RECORD SCREEN
  const renderRecordScreen = () => (
    <div className="space-y-4">
      {/* Profile Header */}
      <div className={`p-3.5 rounded-xl border flex items-center justify-between ${isDarkMode ? 'bg-slate-800/50 border-slate-700' : 'bg-slate-50 border-slate-200'}`}>
        <div className="flex items-center gap-3">
          <div className="bg-amber-100 dark:bg-amber-900/40 p-2.5 rounded-full text-amber-600">
            <Store size={20} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm">Mama Kintu</span>
              <span className="text-sm">👋</span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">🏬 Stall #42 · Kalerwe Market</p>
          </div>
        </div>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
          Online
        </span>
      </div>

      {/* Voice Record Hero */}
      <div className="bg-blue-900 rounded-2xl p-6 text-center text-white flex flex-col items-center justify-center shadow-inner">
        <button 
          onClick={() => void handleVoiceRecording()}
          className={`w-20 h-20 rounded-full flex items-center justify-center transition-all transform active:scale-95 shadow-lg ${
            isRecording ? 'bg-red-500 ring-8 ring-red-400/30 animate-pulse' : 'bg-white text-blue-900 hover:bg-blue-50'
          }`}
        >
          <Mic size={36} className={isRecording ? 'text-white' : 'text-blue-900'} />
        </button>
        <h2 className="mt-4 font-bold text-lg">{text('Tap to Speak', 'Nyiga Owogerere')}</h2>
        <p className="text-xs text-blue-200 mt-1 max-w-xs leading-relaxed">
          {text('Record a sale or debt in English or Luganda', 'Wandiika amagoba oba amabanja mu Lungereza oba Luganda')}
        </p>
      </div>

      {voiceMessage && <p className="rounded-lg bg-blue-50 px-3 py-2 text-center text-xs text-blue-800" role="status">{voiceMessage}</p>}

      {apiError && <p className="rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-800" role="status">{text('Live data is unavailable for some screens. Showing local data.', "Data y'okukola tebiriwo ku screen ezimu. Tulaga data ey'omu kitundu.")}</p>}

      <div className="relative flex items-center justify-center py-1">
        <div className="border-t border-slate-200 dark:border-slate-800 w-full"></div>
        <span className="bg-white dark:bg-slate-900 px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider absolute">
          {text('OR WRITE', 'OBA WANDIIKA')}
        </span>
      </div>

      {/* Manual Input Form */}
      <form onSubmit={handleSaveEntry} className="space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <Edit3 size={14} />
          <span>{text('Type manually', "Wandiika n'Engalo")}</span>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            {text('Customer (Name or Phone)', 'Omuguzi (Erinnya oba Ssimu)')}
          </label>
          <div className="relative">
            <User size={16} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="e.g. Nakato Grace or 0772…"
              value={formData.customer}
              onChange={(e) => setFormData({...formData, customer: e.target.value})}
              className={`w-full pl-9 pr-3 py-2 text-sm rounded-lg border outline-none ${
                isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300'
              }`}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            {text('Item & Quantity', 'Ebyaguddwa')}
          </label>
          <div className="relative">
            <Package size={16} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="e.g. Kasooli 2kg, Amafuta 1L"
              value={formData.item}
              onChange={(e) => setFormData({...formData, item: e.target.value})}
              className={`w-full pl-9 pr-3 py-2 text-sm rounded-lg border outline-none ${
                isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300'
              }`}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            {text('Total Amount (UGX)', 'Omuwendo (UGX)')}
          </label>
          <div className="relative">
            <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">UGX</span>
            <input
              type="number"
              placeholder="0"
              value={formData.amount}
              onChange={(e) => setFormData({...formData, amount: e.target.value})}
              className={`w-full pl-12 pr-3 py-2 text-sm font-semibold rounded-lg border outline-none ${
                isDarkMode ? 'bg-slate-800 border-slate-700 text-white' : 'bg-white border-slate-300'
              }`}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-1">
          <button
            type="button"
            onClick={() => setFormData({...formData, paymentType: 'cash'})}
            className={`py-2 px-3 rounded-lg border flex items-center justify-center gap-2 text-xs font-medium transition ${
              formData.paymentType === 'cash'
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
            }`}
          >
            <DollarSign size={16} /> 💵 {text('Cash', 'Ensimbi')}
          </button>
          <button
            type="button"
            onClick={() => setFormData({...formData, paymentType: 'credit'})}
            className={`py-2 px-3 rounded-lg border flex items-center justify-center gap-2 text-xs font-medium transition ${
              formData.paymentType === 'credit'
                ? 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
            }`}
          >
            <CreditCard size={16} /> 📒 {text('Credit', 'Omubanja')}
          </button>
        </div>

        <button
          type="submit"
          className="w-full py-2.5 mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2 shadow-sm transition"
        >
          <CheckCircle size={16} /> {text('Save Entry', 'Kola')} ✓
        </button>
        {formMessage && <p className="text-center text-xs font-medium text-emerald-600 dark:text-emerald-400" role="status">{formMessage}</p>}
      </form>
    </div>
  );

  // 2. LEDGERS SCREEN
  const renderLedgersScreen = () => (
<div className="space-y-4 relative min-h-[36.25rem]">
      {/* Date Navigation & Controls */}
      <div className="flex items-center justify-between gap-2">
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium ${isDarkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}>
          <ChevronLeft size={16} className="cursor-pointer text-slate-400 hover:text-slate-600" />
          <span>Saturday, 5 Sept</span>
          <ChevronRight size={16} className="cursor-pointer text-slate-400 hover:text-slate-600" />
        </div>
        <button onClick={handleExport} className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-blue-800">
          <Download size={14} /> PDF
        </button>
      </div>

      {/* Time Filter Pills */}
      <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl text-xs font-medium">
        <button 
          onClick={() => setTimeframe('daily')}
          className={`py-1.5 rounded-lg transition ${timeframe === 'daily' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-900 dark:text-white font-bold' : 'text-slate-500'}`}
        >
          {text('Daily', 'Leero')}
        </button>
        <button 
          onClick={() => setTimeframe('weekly')}
          className={`py-1.5 rounded-lg transition ${timeframe === 'weekly' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-900 dark:text-white font-bold' : 'text-slate-500'}`}
        >
          {text('Weekly', 'Sabiti')}
        </button>
        <button 
          onClick={() => setTimeframe('monthly')}
          className={`py-1.5 rounded-lg transition ${timeframe === 'monthly' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-900 dark:text-white font-bold' : 'text-slate-500'}`}
        >
          {text('Monthly', "Ogw'e")}
        </button>
      </div>

      {/* Overview Inflows Card */}
      <div className="bg-linear-to-br from-blue-900 to-blue-950 rounded-2xl p-4 text-white shadow-md">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-[11px] text-blue-200 uppercase font-semibold tracking-wider">{text('Total inflows', 'Ebyakolwa')}</span>
            <div className="text-2xl font-extrabold mt-0.5">UGX {(summary?.totalSales || transactions.filter((transaction) => transaction.type === 'cash').reduce((total, transaction) => total + transaction.amount, 0)).toLocaleString()}</div>
          </div>
          <span className="inline-flex items-center text-xs font-semibold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
            <TrendingUp size={12} className="mr-1" /> +14%
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-blue-800/60 text-xs">
          <div>
            <span className="text-blue-300 text-[11px]">{text('Cash in Hand', 'Ssente eziri mu ngalo')}</span>
            <p className="font-bold text-sm">UGX {(summary?.totalSales || transactions.filter((transaction) => transaction.type === 'cash').reduce((total, transaction) => total + transaction.amount, 0)).toLocaleString()}</p>
          </div>
          <div>
            <span className="text-blue-300 text-[11px]">{text('Credit Given', 'Amabanja agawereddwa')}</span>
            <p className="font-bold text-sm text-amber-300">UGX {(summary?.totalCreditOutstanding || debts.reduce((total, debt) => total + debt.amount, 0)).toLocaleString()}</p>
          </div>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-3 text-slate-400" />
          <input 
          type="text" 
            placeholder={text('Search customer or item…', 'Noonya omuguzi oba ekyaguddwa…')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={`w-full pl-9 pr-9 py-2.5 text-xs rounded-xl border outline-none ${
            isDarkMode ? 'bg-slate-800 border-slate-700 text-white placeholder-slate-500' : 'bg-slate-50 border-slate-200 placeholder-slate-400'
          }`}
        />
        <Mic size={16} className="absolute right-3 top-3 text-amber-500 cursor-pointer" />
      </div>

      {/* Transactions List */}
      <div>
        <div className="flex justify-between items-center mb-2 px-1">
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{text('Transactions', 'Ebintu Ebyakozesebwa')}</span>
          <span className="text-[11px] text-slate-400">{text('Sorted by recent', 'Bisengekeddwa okusinziira ku bipya')}</span>
        </div>

        <div className="space-y-2">
          {filteredTransactions.map((tx) => (
            <div key={tx.id} className={`p-3 rounded-xl border flex items-center justify-between ${isDarkMode ? 'bg-slate-800/60 border-slate-700/60' : 'bg-white border-slate-100 shadow-sm'}`}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 flex items-center justify-center font-bold text-xs">
                  {tx.initials}
                </div>
                <div>
                  <h4 className="text-xs font-bold">{tx.customer}</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{tx.item}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-bold">UGX {tx.amount.toLocaleString()}</div>
                <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold mt-0.5 ${
                  tx.type === 'cash' 
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300' 
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                }`}>
                  {tx.type === 'cash' ? 'Cash' : tx.dueDate}
                </span>
              </div>
            </div>
          ))}
          {filteredTransactions.length === 0 && <p className="py-6 text-center text-xs text-slate-500">{text('No matching transactions.', 'Tewali bizuuliddwa.')}</p>}
        </div>
      </div>

      {/* Floating Action Button */}
      <button className="absolute bottom-2 right-2 w-12 h-12 bg-amber-500 text-slate-950 rounded-full flex items-center justify-center shadow-lg hover:bg-amber-400 transition">
        <Mic size={22} />
      </button>
    </div>
  );

  // 3. DEBTS & DUES SCREEN
  const renderDebtsScreen = () => (
    <div className="space-y-4">
      {/* Debts Summary Card */}
      <div className="bg-amber-500 rounded-2xl p-4 text-slate-950 shadow-md">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-800">{text('Total outstanding debts', 'Amabanja gonna agakyaliwo')}</span>
            <div className="text-2xl font-extrabold mt-0.5">UGX {debts.reduce((total, debt) => total + debt.amount, 0).toLocaleString()}</div>
          </div>
          <AlertCircle size={22} className="text-slate-900" />
        </div>
        <p className="text-xs mt-2 font-medium text-slate-800">{debts.length} customer{debts.length === 1 ? '' : 's'} with pending balances</p>
      </div>

      <div className="flex justify-between items-center pt-2">
        <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">{text('Active Debts', 'Amabanja agakyaliwo')}</h3>
        <button onClick={() => { setFormData((currentForm) => ({ ...currentForm, paymentType: 'credit' })); setActiveTab('record'); }} className="text-xs text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1">
          <Plus size={14} /> {text('Add Debt', 'Yongera ibanja')}
        </button>
      </div>

      <div className="space-y-2.5">
        {debts.map((debt) => <div key={debt.id} className={`p-3.5 rounded-xl border ${isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'}`}>
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">{debt.initials}</div>
              <div>
                <h4 className="text-xs font-bold">{debt.customer}</h4>
                <p className="text-[11px] text-slate-500">{debt.item}</p>
              </div>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-amber-600 dark:text-amber-400">UGX {debt.amount.toLocaleString()}</span>
              <p className="text-[10px] text-red-500 font-semibold">{debt.dueDate}</p>
            </div>
          </div>
          <div className="flex gap-2 mt-3 pt-2 border-t border-slate-100 dark:border-slate-700/50">
            <button onClick={() => setDebts((currentDebts) => currentDebts.filter((currentDebt) => currentDebt.id !== debt.id))} className="flex-1 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1">
              <CheckCircle size={12} /> {text('Mark Paid', 'Kiteekeddwaako ssente')}
            </button>
            <button className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium flex items-center justify-center gap-1 text-slate-600 dark:text-slate-300">
              <Phone size={12} /> {text('Call', 'Kuba essimu')}
            </button>
          </div>
        </div>)}
        {debts.length === 0 && <p className="py-6 text-center text-xs text-slate-500">{text('All debts are settled.', 'Amabanja gonna gasasuddwa.')}</p>}
      </div>
    </div>
  );

  // 4. REPORTS SCREEN
  const renderReportsScreen = () => (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">{text('Business Insights', 'Ebikwata ku Dduuka')}</h3>
        <span className="text-xs text-blue-600 dark:text-blue-400 font-semibold">{text('This Month', 'Omwezi guno')}</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className={`p-3.5 rounded-xl border ${isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'}`}>
          <span className="text-[11px] text-slate-500">{text('Total Sales', 'Amagoba gonna')}</span>
          <div className="text-base font-extrabold text-emerald-600 dark:text-emerald-400 mt-1">UGX {(summary?.totalSales || transactions.filter((transaction) => transaction.type === 'cash').reduce((total, transaction) => total + transaction.amount, 0)).toLocaleString()}</div>
          <span className="text-[10px] text-emerald-600 font-semibold">{text('↑ 12% vs last month', '↑ 12% okusinga omwezi oguwedde')}</span>
        </div>
        <div className={`p-3.5 rounded-xl border ${isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'}`}>
          <span className="text-[11px] text-slate-500">{text('Total Debt Collected', 'Amabanja agakunganyiziddwa')}</span>
          <div className="text-base font-extrabold text-blue-600 dark:text-blue-400 mt-1">UGX {(summary?.totalCreditOutstanding || debts.reduce((total, debt) => total + debt.amount, 0)).toLocaleString()}</div>
          <span className="text-[10px] text-blue-600 font-semibold">{text('8 customers paid', 'Abaguzi 8 basasudde')}</span>
        </div>
      </div>

      {/* Top Selling Items */}
      <div className={`p-4 rounded-xl border ${isDarkMode ? 'bg-slate-800/60 border-slate-700' : 'bg-white border-slate-200'}`}>
        <h4 className="text-xs font-bold mb-3">{text('Top Selling Items', 'Ebisinga okutundibwa')}</h4>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs font-medium mb-1">
              <span>Super Rice (kg)</span>
              <span className="font-bold">142 kg</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
              <div className="bg-blue-600 h-full w-[85%] rounded-full"></div>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs font-medium mb-1">
              <span>Maize Flour (kg)</span>
              <span className="font-bold">98 kg</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
              <div className="bg-blue-600 h-full w-[65%] rounded-full"></div>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs font-medium mb-1">
              <span>Cooking Oil (L)</span>
              <span className="font-bold">45 L</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
              <div className="bg-blue-600 h-full w-[40%] rounded-full"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className={`min-h-screen flex justify-center items-center ${isDarkMode ? 'bg-gray-950 text-white' : 'bg-slate-100 text-slate-800'}`}>
      <div className={`w-full max-w-md min-h-screen sm:min-h-0 sm:h-[52.5rem] sm:rounded-3xl shadow-2xl flex flex-col justify-between overflow-hidden relative ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
        
        {/* App Header */}
        <header className="bg-blue-900 text-white px-5 py-4 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-2">
            <div className="bg-amber-500 p-2 rounded-lg text-slate-900 font-bold">
              <Mic size={18} />
            </div>
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
            <select
              id="language-mode"
              value={language}
              onChange={(event) => setLanguage(event.target.value as 'EN' | 'LUG' | 'MIX')}
              className="max-w-28 rounded-md border border-blue-600 bg-blue-800/80 px-2 py-1 text-xs font-semibold text-white outline-none"
            >
              <option value="EN">English</option>
              <option value="LUG">Luganda</option>
              <option value="MIX">English + Luganda</option>
            </select>
            <button 
              onClick={toggleTheme}
              className="p-1.5 text-blue-200 hover:text-white transition"
              aria-label="Toggle theme"
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        {/* Dynamic View Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {riskFlags.length > 0 && <div className="space-y-2" role="alert">
            {riskFlags.map((flag, index) => <div key={`${flag.type}-${index}`} className={`rounded-lg px-3 py-2 text-xs font-medium ${flag.type === 'credit_risk' ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800'}`}>
              {flag.message}
            </div>)}
          </div>}
          {activeTab === 'record' && renderRecordScreen()}
          {activeTab === 'ledgers' && renderLedgersScreen()}
          {activeTab === 'debts' && renderDebtsScreen()}
          {activeTab === 'reports' && renderReportsScreen()}
        </div>

        {/* Bottom Navigation */}
        <nav className={`border-t flex justify-around py-2 px-1 ${isDarkMode ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200'}`}>
          <button 
            onClick={() => setActiveTab('record')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-xs font-medium transition ${
              activeTab === 'record' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Mic size={18} />
            <span>{text('Record', 'Wandiika')}</span>
          </button>

          <button 
            onClick={() => setActiveTab('ledgers')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-xs font-medium transition ${
              activeTab === 'ledgers' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <BookOpen size={18} />
            <span>{text('Ledgers', 'Ebitabo')}</span>
          </button>

          <button 
            onClick={() => setActiveTab('debts')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-xs font-medium transition ${
              activeTab === 'debts' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <CreditCard size={18} />
            <span>{text('Debts & Dues', 'Amabanja')}</span>
          </button>

          <button 
            onClick={() => setActiveTab('reports')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-xs font-medium transition ${
              activeTab === 'reports' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <BarChart3 size={18} />
            <span>{text('Reports', 'Ripoota')}</span>
          </button>
        </nav>

      </div>
    </div>
  );
}