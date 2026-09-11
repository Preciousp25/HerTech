'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  LogOut,
  Settings,
  ShieldCheck,
  Smartphone,
  LockKeyhole,
  Palette,
  SunMedium,
  MoonStar
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

const DEBT_LIMIT = 200000;
const LANGUAGE_KEY = 'duukaTalkLanguage';

export default function DuukaTalkApp() {
  const router = useRouter();
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);
  const [language, setLanguage] = useState<'EN' | 'LUG' | 'SW' | 'AR' | 'FR'>(() => {
    if (typeof window === 'undefined') return 'EN';
    const stored = window.localStorage.getItem(LANGUAGE_KEY) as 'EN' | 'LUG' | 'SW' | 'AR' | 'FR' | null;
    return stored ?? 'EN';
  });
  const [activeTab, setActiveTab] = useState<TabType>('record');
  const [transactions, setTransactions] = useState<Transaction[]>(MOCK_TRANSACTIONS);
  const [debts, setDebts] = useState<Debt[]>(INITIAL_DEBTS);
  const [formMessage, setFormMessage] = useState('');
  const [summary, setSummary] = useState<ApiSummary | null>(null);
  const [riskFlags, setRiskFlags] = useState<ApiRiskFlag[]>([]);
  const [apiError, setApiError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [shopName, setShopName] = useState('Shop');
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [privacyAction, setPrivacyAction] = useState<'none' | 'pin' | 'phone'>('none');
  const [newPin, setNewPin] = useState('');
  const [newPhone, setNewPhone] = useState('');

  useEffect(() => {
    const session = typeof window !== 'undefined' ? window.localStorage.getItem('duukaTalkSession') : null;
    if (!session) {
      setIsAuthenticated(false);
      router.replace('/login');
      return;
    }

    try {
      const parsedSession = JSON.parse(session) as { businessName?: string };
      setShopName(parsedSession.businessName || 'Shop');
    } catch {
      setShopName('Shop');
    }

    setIsAuthenticated(true);
  }, [router]);

  // Screen 1: Record Form State
  const [isRecording, setIsRecording] = useState<boolean>(false);
const [formData, setFormData] = useState<{ customer: string; item: string; amount: string; paymentType: Transaction['type'] }>({ customer: '', item: '', amount: '', paymentType: 'cash' });

  // Screen 2: Ledgers State
  const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
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
        setTransactions(ledgerData.transactions.map((transaction, index) => {
          const customer = transaction.customer_name || 'Unknown customer';
          const itemParts = [transaction.quantity, transaction.unit, transaction.item].filter(Boolean);
          return {
            id: transaction.id || transaction.transaction_id || `api-${index}`,
            customer,
            initials: customer.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
            item: itemParts.join(' ') || 'Recorded transaction',
            amount: transaction.total_amount || 0,
            type: (transaction.payment_type || transaction.type || 'cash') === 'credit' ? 'credit' : 'cash',
            dueDate: transaction.due_date ? `Due ${new Date(transaction.due_date).toLocaleDateString()}` : undefined,
            date: transaction.timestamp ? new Date(transaction.timestamp).toLocaleString() : 'Recently',
          };
        }));
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
  }, []);

  const filteredTransactions = transactions.filter((transaction) => {
    const query = searchQuery.trim().toLowerCase();
    return !query || [transaction.customer, transaction.item, transaction.type].some((value) => value.toLowerCase().includes(query));
  });

  const text = (english: string, luganda = english, swahili = english, arabic = english, french = english) => {
    switch (language) {
      case 'LUG':
        return luganda || english;
      case 'SW':
        return swahili || english;
      case 'AR':
        return arabic || english;
      case 'FR':
        return french || english;
      default:
        return english;
    }
  };

  const handleLanguageChange = (nextLanguage: 'EN' | 'LUG' | 'SW' | 'AR' | 'FR') => {
    setLanguage(nextLanguage);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LANGUAGE_KEY, nextLanguage);
    }
  };

  const cashSales = transactions.filter((transaction) => transaction.type === 'cash').reduce((sum, transaction) => sum + transaction.amount, 0);
  const debtSales = transactions.filter((transaction) => transaction.type === 'credit').reduce((sum, transaction) => sum + transaction.amount, 0);
  const dailySales = transactions.filter((transaction) => transaction.date.toLowerCase().includes('today')).reduce((sum, transaction) => sum + transaction.amount, 0);
  const weeklySales = transactions.slice(0, Math.min(transactions.length, 3)).reduce((sum, transaction) => sum + transaction.amount, 0);
  const monthlySales = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);

  const toggleTheme = () => setIsDarkMode(prev => !prev);

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('duukaTalkSession');
    }
    setShowSettingsMenu(false);
    router.push('/login');
  };

  const handlePrivacySave = () => {
    if (privacyAction === 'pin' && newPin.trim()) {
      setNewPin('');
      setPrivacyAction('none');
      setShowSettingsMenu(false);
      return;
    }

    if (privacyAction === 'phone' && newPhone.trim()) {
      setNewPhone('');
      setPrivacyAction('none');
      setShowSettingsMenu(false);
      return;
    }
  };

  const handleSaveEntry = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(formData.amount);

    if (!formData.customer.trim() || !formData.item.trim() || !amount) {
      setFormMessage(text('Add a customer, item, and amount first.', 'Sooka omuguzi, ekyaguddwa, n’omuwendo nga tonnaba kusiba.'));
      return;
    }

    const customerName = formData.customer.trim();
    const newTransaction: Transaction = {
      id: crypto.randomUUID(),
      customer: customerName,
      initials: customerName.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(),
      item: formData.item.trim(),
      amount,
      type: formData.paymentType as Transaction['type'],
      dueDate: formData.paymentType === 'credit' ? 'Due soon' : undefined,
      date: 'Just now',
    };

    setTransactions((currentTransactions) => [newTransaction, ...currentTransactions]);
    if (newTransaction.type === 'credit') {
      setDebts((currentDebts) => [
        { ...newTransaction, dueDate: 'Due soon' },
        ...currentDebts,
      ]);
    }
    setFormData({ customer: '', item: '', amount: '', paymentType: 'cash' });
    setFormMessage(text('Entry saved to your ledger.', 'Ekiwandiiko kiteekeddwa mu bitabo byo.'));
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
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-sm">{shopName}</span>
            <span className="text-sm">👋</span>
          </div>
        </div>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-900/60 dark:text-emerald-300">
          {text('Online', 'Mulimu', 'Mtandaoni', 'متصل', 'En ligne')}
        </span>
      </div>

      {/* Voice Record Hero */}
      <div className="bg-blue-900 rounded-2xl p-6 text-center text-white flex flex-col items-center justify-center shadow-inner">
        <button 
          onClick={() => setIsRecording(!isRecording)}
          className={`w-20 h-20 rounded-full flex items-center justify-center transition-all transform active:scale-95 shadow-lg ${
            isRecording ? 'bg-red-500 ring-8 ring-red-400/30 animate-pulse' : 'bg-white text-blue-900 hover:bg-blue-50'
          }`}
        >
          <Mic size={36} className={isRecording ? 'text-white' : 'text-blue-900'} />
        </button>
        <h2 className="mt-4 font-bold text-lg">{text('Tap to Speak', 'Nyiga Owogerere', 'Gusa ili kuzungumza', 'اضغط للتحدث', 'Appuyez pour parler')}</h2>
        <p className="text-xs text-blue-200 mt-1 max-w-xs leading-relaxed">
          {text('Record a sale or debt in English or Luganda', 'Wandiika amagoba oba amabanja mu Lungereza oba Luganda', 'Rekodi mauzo au deni kwa Kiingereza au Kiswahili', 'سجل مبيعًا أو دينًا بالعربية أو الإنجليزية', 'Enregistrez une vente ou une dette en français ou en anglais')}
        </p>
      </div>

      {apiError && <p className="rounded-lg bg-amber-50 px-3 py-2 text-center text-xs text-amber-800" role="status">{text('Live data is unavailable for some screens. Showing local data.', "Data y'okukola tebiriwo ku screen ezimu. Tulaga data ey'omu kitundu.", 'Data haiwezekani kwa baadhi ya skrini. Inaonyesha data ya ndani.', 'البيانات الفعلية غير متاحة لبعض الشاشات. يتم عرض البيانات المحلية.', 'Les données en direct ne sont pas disponibles sur certains écrans. Affichage des données locales.')}</p>}

      <div className="relative flex items-center justify-center py-1">
        <div className="border-t border-slate-200 dark:border-slate-800 w-full"></div>
        <span className="bg-white dark:bg-slate-900 px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider absolute">
          {text('OR WRITE', 'OBA WANDIIKA', 'AUANDIKE', 'أو اكتب', 'OU ÉCRIRE')}
        </span>
      </div>

      {/* Manual Input Form */}
      <form onSubmit={handleSaveEntry} className="space-y-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <Edit3 size={14} />
          <span>{text('Type manually', "Wandiika n'Engalo", 'Andika kwa mikono', 'اكتب يدويًا', 'Saisir manuellement')}</span>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
            {text('Customer (Name or Phone)', 'Omuguzi (Erinnya oba Ssimu)', 'Mteja (Jina au Simu)', 'العميل (الاسم أو الهاتف)', 'Client (nom ou téléphone)')}
          </label>
          <div className="relative">
            <User size={16} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder={text('e.g. Nakato Grace or 0772…', 'eky. Nakato Grace oba 0772…', 'mfano: Nakato Grace au 0772…', 'مثال: نكاتو غريس أو 0772…', 'ex. Nakato Grace ou 0772…')}
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
            {text('Item & Quantity', 'Ebyaguddwa', 'Bidhaa na Kiasi', 'العنصر والكمية', 'Article et quantité')}
          </label>
          <div className="relative">
            <Package size={16} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder={text('e.g. Kasooli 2kg, Amafuta 1L', 'eky. Kasooli 2kg, Amafuta 1L', 'mfano: Kasooli 2kg, Mafuta 1L', 'مثال: كاسولي 2 كجم، زيت 1 لتر', 'ex. Kasooli 2kg, huile 1L')}
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
            {text('Total Amount (UGX)', 'Omuwendo (UGX)', 'Jumla ya Kiasi (UGX)', 'إجمالي المبلغ (UGX)', 'Montant total (UGX)')}
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
            <CreditCard size={16} /> 📒 {text('Credit', 'Omubanja', 'Deni', 'ائتمان', 'Crédit')}
          </button>
        </div>

        <button
          type="submit"
          className="w-full py-2.5 mt-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2 shadow-sm transition"
        >
          <CheckCircle size={16} /> {text('Save Entry', 'Kola', 'Hifadhi', 'حفظ', 'Enregistrer')} ✓
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
          <span>{text('Saturday, 5 Sept', 'Sabbiiti, 5 Sept', 'Jumamosi, 5 Sept', 'السبت، 5 سبتمبر', 'Samedi, 5 Sept')}</span>
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
          {text('Daily', 'Leero', 'Kila siku', 'يومياً', 'Quotidien')}
        </button>
        <button 
          onClick={() => setTimeframe('weekly')}
          className={`py-1.5 rounded-lg transition ${timeframe === 'weekly' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-900 dark:text-white font-bold' : 'text-slate-500'}`}
        >
          {text('Weekly', 'Sabiti', 'Kila wiki', 'أسبوعياً', 'Hebdomadaire')}
        </button>
        <button 
          onClick={() => setTimeframe('monthly')}
          className={`py-1.5 rounded-lg transition ${timeframe === 'monthly' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-900 dark:text-white font-bold' : 'text-slate-500'}`}
        >
          {text('Monthly', "Ogw'e", 'Kila mwezi', 'شهرياً', 'Mensuel')}
        </button>
      </div>

      {/* Overview Inflows Card */}
      <div className="bg-linear-to-br from-blue-900 to-blue-950 rounded-2xl p-4 text-white shadow-md">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-[11px] text-blue-200 uppercase font-semibold tracking-wider">{text('Total inflows', 'Ebyakolwa', 'Mapato ya jumla', 'إجمالي التدفقات', 'Total des entrées')}</span>
            <div className="text-2xl font-extrabold mt-0.5">UGX {(summary?.totalSales || transactions.filter((transaction) => transaction.type === 'cash').reduce((total, transaction) => total + transaction.amount, 0)).toLocaleString()}</div>
          </div>
          <span className="inline-flex items-center text-xs font-semibold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
            <TrendingUp size={12} className="mr-1" /> +14%
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-blue-800/60 text-xs">
          <div>
            <span className="text-blue-300 text-[11px]">{text('Cash in Hand', 'Ssente eziri mu ngalo', 'Fedha mkononi', 'النقد في اليد', 'Espèces en main')}</span>
            <p className="font-bold text-sm">UGX {(summary?.totalSales || transactions.filter((transaction) => transaction.type === 'cash').reduce((total, transaction) => total + transaction.amount, 0)).toLocaleString()}</p>
          </div>
          <div>
            <span className="text-blue-300 text-[11px]">{text('Credit Given', 'Amabanja agawereddwa', 'Deni iliyotolewa', 'الائتمان الممنوح', 'Crédit accordé')}</span>
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
                  {tx.type === 'cash' ? text('Cash', 'Ensimbi', 'Pesa', 'نقد', 'Espèces') : text(tx.dueDate || 'Due soon', 'Due soon', 'Inakuja hivi karibuni', 'قريبًا', 'Bientôt')}
                </span>
              </div>
            </div>
          ))}
          {filteredTransactions.length === 0 && <p className="py-6 text-center text-xs text-slate-500">{text('No matching transactions.', 'Tewali bizuuliddwa.', 'Hakuna miamala inayolingana.', 'لا توجد معاملات مطابقة.', 'Aucune transaction correspondante.')}</p>}
        </div>
      </div>

      {/* Floating Action Button */}
      <button className="absolute bottom-2 right-2 w-12 h-12 bg-amber-500 text-slate-950 rounded-full flex items-center justify-center shadow-lg hover:bg-amber-400 transition">
        <Mic size={22} />
      </button>
    </div>
  );

  // 3. DEBTS & DUES SCREEN
  const overLimitDebts = debts.filter((debt) => debt.amount > DEBT_LIMIT);

  const renderDebtsScreen = () => (
    <div className="space-y-4">
      {overLimitDebts.length > 0 && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-red-800 shadow-sm">
          {overLimitDebts.map((debt) => {
            const exceededAmount = debt.amount - DEBT_LIMIT;
            return (
              <div key={debt.id} className="flex items-start gap-2 text-xs font-semibold">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <span>
                  {debt.customer} {text('has exceeded the loan limit of UGX 200,000 by UGX', 'yebulidde omupimo gw’amabanja ogw’UGX 200,000 ng’akola UGX', 'amezidi kikomo cha mkopo cha UGX 200,000 kwa UGX', 'تجاوز حد القرض البالغ UGX 200,000 بمبلغ UGX', 'a dépassé la limite de prêt de UGX 200,000 de UGX')} {exceededAmount.toLocaleString()}.
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Debts Summary Card */}
      <div className="bg-amber-500 rounded-2xl p-4 text-slate-950 shadow-md">
        <div className="flex justify-between items-start">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-800">{text('Total outstanding debts', 'Amabanja gonna agakyaliwo', 'Jumla ya deni zilizoendelea', 'إجمالي الديون المستحقة', 'Total des dettes impayées')}</span>
            <div className="text-2xl font-extrabold mt-0.5">UGX {debts.reduce((total, debt) => total + debt.amount, 0).toLocaleString()}</div>
          </div>
          <AlertCircle size={22} className="text-slate-900" />
        </div>
        <p className="text-xs mt-2 font-medium text-slate-800">{text(`${debts.length} customer${debts.length === 1 ? '' : 's'} with pending balances`, `${debts.length} omuguzi${debts.length === 1 ? '' : 's'} alina emiwendo egikyaliyo`, `${debts.length} mteja${debts.length === 1 ? '' : 's'} na salio zinasubiri`, `${debts.length} عميل${debts.length === 1 ? '' : 's'} مع أرصدة معلقة`, `${debts.length} client${debts.length === 1 ? '' : 's'} avec soldes en attente`)}</p>
      </div>

      <div className="flex justify-between items-center pt-2">
        <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">{text('Active Debts', 'Amabanja agakyaliwo', 'Deni Zinazoendelea', 'الديون النشطة', 'Dettes actives')}</h3>
        <button onClick={() => { setFormData((currentForm) => ({ ...currentForm, paymentType: 'credit' })); setActiveTab('record'); }} className="text-xs text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1">
          <Plus size={14} /> {text('Add Debt', 'Yongera ibanja', 'Ongeza Deni', 'إضافة دين', 'Ajouter une dette')}
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
              <CheckCircle size={12} /> {text('Mark Paid', 'Kiteekeddwaako ssente', 'Weka Kulipwa', 'تحديد كمدفوع', 'Marqué payé')}
            </button>
            <button className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium flex items-center justify-center gap-1 text-slate-600 dark:text-slate-300">
              <Phone size={12} /> {text('Call', 'Kuba essimu', 'Piga simu', 'اتصال', 'Appel')}
            </button>
          </div>
        </div>)}
        {debts.length === 0 && <p className="py-6 text-center text-xs text-slate-500">{text('All debts are settled.', 'Amabanja gonna gasasuddwa.', 'Deni zote zamelipwa.', 'تم سداد جميع الديون.', 'Toutes les dettes sont réglées.')}</p>}
      </div>
    </div>
  );

  // 4. REPORTS SCREEN
  const renderReportsScreen = () => (
    <div className="space-y-4 bg-[#eaf0f7] p-3 rounded-[18px]">
      <div className="flex items-center justify-between rounded-2xl bg-[#edf1f6] px-2 py-1.5">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-xl bg-[#e7eef9] text-[#1e3a8a] shadow-sm flex items-center justify-center">
            <BarChart3 size={18} />
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{text('Report', 'Ebipimo', 'Ripoti', 'تقرير', 'Rapport')}</div>
            <div className="text-[13px] font-bold text-slate-700">{text('This Month', 'Omwezi guno', 'Mwezi huu', 'هذا الشهر', 'Ce mois-ci')}</div>
          </div>
        </div>
        <button className="rounded-full bg-[#dfeaf6] px-3 py-1.5 text-[11px] font-semibold text-blue-800">{text('Ledger Book', 'Ebitabo', 'Kitabu cha akaunti', 'دفتر الحسابات', 'Livre de comptes')}</button>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="mb-2 flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">
          <span>{text('Total sales', 'Omuwendo gwonna ogwaginyira', 'Jumla ya mauzo', 'إجمالي المبيعات', 'Total des ventes')}</span>
          <span className="text-[#00a76f]">{text('+14% vs Sept', '+14% vs Sept', '+14% vs Sept', '+14% vs Sept', '+14% vs Sept')}</span>
        </div>
        <div className="text-4xl font-black leading-none text-slate-900">UGX 4,280,000</div>
        <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div className="h-full w-[86%] rounded-full bg-blue-600" />
        </div>
        <div className="mt-2 text-[11px] text-slate-500">{text('Goal 5.0M (86%)', 'Ekigendere 5.0M (86%)', 'Lengo 5.0M (86%)', 'الهدف 5.0M (86%)', 'Objectif 5.0M (86%)')}</div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500">{text('Cash sales', 'Ensimbi Ezigga', 'Mauzo ya cash', 'المبيعات النقدية', 'Ventes comptant')}</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
              <TrendingUp size={16} />
            </span>
          </div>
          <div className="mt-2 text-[22px] font-black text-slate-900">3.8M</div>
          <div className="text-[11px] text-slate-500">{text('UGX · 88% of sales', 'UGX · 88% y’ebintu', 'UGX · 88% ya mauzo', 'UGX · 88% من المبيعات', 'UGX · 88% des ventes')}</div>
        </div>

        <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500">{text('Credit sales', 'Amanjanjo', 'Mauzo ya deni', 'المبيعات بالدين', 'Ventes à crédit')}</span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-red-600">
              <AlertCircle size={16} />
            </span>
          </div>
          <div className="mt-2 text-[22px] font-black text-slate-900">342k</div>
          <div className="text-[11px] text-slate-500">{text('UGX · 12% of sales', 'UGX · 12% y’ebintu', 'UGX · 12% ya mauzo', 'UGX · 12% من المبيعات', 'UGX · 12% des ventes')}</div>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
        <div className="mb-3 flex items-center justify-between">
          <h4 className="text-[13px] font-bold text-slate-700">{text('Top selling items', 'Ebitu Ebisubuulwa Ennyo', 'Bidhaa zinazouzwa zaidi', 'أكثر المنتجات مبيعًا', 'Articles les plus vendus')}</h4>
        </div>
        <div className="space-y-4">
          <div>
            <div className="mb-1 flex items-center justify-between text-[12px] font-medium text-slate-700">
              <span>{text('Maize flour / Posho', 'Maize flour / Posho', 'Unga wa mahindi / Posho', 'دقيق الذرة / بوسهو', 'Farine de maïs / Posho')}</span>
              <span className="font-bold">1.2M</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div className="h-full w-[82%] rounded-full bg-blue-600" />
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-[12px] font-medium text-slate-700">
              <span>{text('Cooking oil', 'Cooking oil', 'Mafuta ya kupikia', 'زيت الطبخ', 'Huile de cuisson')}</span>
              <span className="font-bold">980k</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div className="h-full w-[66%] rounded-full bg-blue-600" />
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-[12px] font-medium text-slate-700">
              <span>{text('Sugar / Sukari', 'Sugar / Sukari', 'Sukari', 'السكر', 'Sucre')}</span>
              <span className="font-bold">760k</span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
              <div className="h-full w-[52%] rounded-full bg-blue-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
        <div className="mb-2 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#e9f0ff] text-[#2347bf]">
            <Download size={20} />
          </div>
          <div>
            <div className="text-[12px] font-bold text-slate-800">{text('This month ledger', 'Eby’ensimbi ebyomwezi guno', 'Kumbukumbu ya mwezi huu', 'دفتر هذا الشهر', 'Journal de ce mois')}</div>
            <div className="text-[11px] text-slate-500">{text('Bank-ready PDF', 'PDF etegese okuba mu banki', 'PDF tayari kwa benki', 'PDF جاهز للبنك', 'PDF prêt pour la banque')}</div>
          </div>
        </div>

        <button className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#0b4cc8] py-3 text-sm font-bold text-white shadow-md shadow-blue-900/20">
          <Download size={18} />
          {text('Open PDF', 'Tikkula PDF', 'Fungua PDF', 'فتح PDF', 'Ouvrir le PDF')}
        </button>
      </div>
    </div>
  );

  if (isAuthenticated === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-700">
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium shadow-sm">
          Loading your workspace...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className={`min-h-screen flex justify-center items-center ${isDarkMode ? 'bg-gray-950 text-white' : 'bg-slate-100 text-slate-800'}`}>
      <div className={`w-full max-w-md min-h-screen sm:min-h-0 sm:h-[52.5rem] sm:rounded-3xl shadow-2xl flex flex-col justify-between overflow-hidden relative ${isDarkMode ? 'bg-slate-900' : 'bg-white'}`}>
        
        {/* App Header */}
        <header className="bg-blue-900 text-white px-5 py-4 shadow-md">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="bg-amber-500 p-2 rounded-lg text-slate-900 font-bold shrink-0">
                <Mic size={18} />
              </div>
              <div className="min-w-0">
                <h1 className="font-bold text-base leading-tight truncate">{text('Speak Your Ledger', 'Yogera Ebitabo Byo', 'Zungumza Kumbukumbu Yako', 'تحدث عن دفتر الحسابات', 'Parlez de votre journal')}</h1>
                <p className="text-xs text-blue-200">
                  {activeTab === 'record' && text('Record', 'Wandiika', 'Rekodi', 'تسجيل', 'Enregistrer')}
                  {activeTab === 'ledgers' && text('Ledgers', 'Ebitabo', 'Vitabu', 'دفاتر', 'Livres')}
                  {activeTab === 'debts' && text('Debts & Dues', 'Amabanja', 'Deni na Madeni', 'الديون', 'Dettes')}
                  {activeTab === 'reports' && text('Reports', 'Ripoota', 'Ripoti', 'التقارير', 'Rapports')}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 relative">
              <label className="sr-only" htmlFor="language-mode">Language</label>
              <select
                id="language-mode"
                value={language}
                onChange={(event) => handleLanguageChange(event.target.value as 'EN' | 'LUG' | 'SW' | 'AR' | 'FR')}
                className="max-w-28 rounded-md border border-blue-600 bg-blue-800/80 px-2 py-1 text-xs font-semibold text-white outline-none"
              >
                <option value="EN">English</option>
                <option value="LUG">Luganda</option>
                <option value="SW">Kiswahili</option>
                <option value="AR">العربية</option>
                <option value="FR">Français</option>
              </select>

              <div className="relative">
                <button
                  onClick={() => setShowSettingsMenu((current) => !current)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-blue-600 bg-blue-800/80 text-blue-100 shadow-sm transition hover:bg-blue-700/80 hover:text-white"
                  aria-label={text('Open settings', 'Tteeka settings', 'Fungua mipangilio', 'فتح الإعدادات', 'Ouvrir les paramètres')}
                >
                  <Settings size={18} />
                </button>

                {showSettingsMenu && (
                  <div className="absolute right-0 top-12 w-72 rounded-2xl border border-slate-200 bg-white p-3 text-slate-800 shadow-2xl z-20">
                    <div className="mb-2 flex items-center gap-2 rounded-xl bg-slate-100 px-2 py-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-700">
                        <Palette size={16} />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{text('Theme', 'Endabika', 'Mandhari', 'السمة', 'Thème')}</div>
                        <div className="text-sm font-semibold">{isDarkMode ? text('Dark mode', 'Mode emyufu', 'Hali ya giza', 'الوضع الداكن', 'Mode sombre') : text('Light mode', 'Mode eyaka', 'Hali ya mwanga', 'الوضع الفاتح', 'Mode clair')}</div>
                      </div>
                    </div>

                    <button
                      onClick={toggleTheme}
                      className="mb-2 flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-left text-sm font-medium transition hover:bg-slate-50"
                    >
                      <span className="flex items-center gap-2">
                        {isDarkMode ? <SunMedium size={16} className="text-amber-500" /> : <MoonStar size={16} className="text-indigo-600" />}
                        {text('Switch theme', 'Kyusa endabika', 'Badilisha mandhari', 'تبديل السمة', 'Changer le thème')}
                      </span>
                      <span className="text-xs font-bold text-slate-500">{isDarkMode ? 'Dark' : 'Light'}</span>
                    </button>

                    <div className="mb-2 rounded-xl border border-slate-200 bg-slate-50 p-2">
                      <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                        <ShieldCheck size={14} />
                        {text('Privacy', 'Ebyobwamibiri', 'Faragha', 'الخصوصية', 'Confidentialité')}
                      </div>

                      <div className="space-y-2">
                        <button
                          onClick={() => { setPrivacyAction('pin'); setShowSettingsMenu(true); }}
                          className="flex w-full items-center justify-between rounded-lg bg-white px-2 py-2 text-left text-sm font-medium shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
                        >
                          <span className="flex items-center gap-2">
                            <LockKeyhole size={14} className="text-slate-500" />
                            {text('Change PIN', 'Kyusa PIN', 'Badilisha PIN', 'تغيير PIN', 'Modifier le PIN')}
                          </span>
                          <ChevronRight size={14} className="text-slate-400" />
                        </button>

                        <button
                          onClick={() => { setPrivacyAction('phone'); setShowSettingsMenu(true); }}
                          className="flex w-full items-center justify-between rounded-lg bg-white px-2 py-2 text-left text-sm font-medium shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
                        >
                          <span className="flex items-center gap-2">
                            <Smartphone size={14} className="text-slate-500" />
                            {text('Change phone number', 'Kyusa ennamba y’essimu', 'Badilisha nambari ya simu', 'تغيير رقم الهاتف', 'Modifier le numéro de téléphone')}
                          </span>
                          <ChevronRight size={14} className="text-slate-400" />
                        </button>
                      </div>
                    </div>

                    {privacyAction !== 'none' && (
                      <div className="mb-2 rounded-xl border border-blue-200 bg-blue-50 p-2.5">
                        <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-blue-700">
                          {privacyAction === 'pin' ? text('Update PIN', 'Kyusa PIN', 'Sasisha PIN', 'تحديث PIN', 'Mettre à jour le PIN') : text('Update phone number', 'Kyusa ennamba y’essimu', 'Sasisha nambari ya simu', 'تحديث رقم الهاتف', 'Mettre à jour le numéro')}
                        </div>
                        <input
                          type={privacyAction === 'pin' ? 'password' : 'tel'}
                          value={privacyAction === 'pin' ? newPin : newPhone}
                          onChange={(event) => privacyAction === 'pin' ? setNewPin(event.target.value) : setNewPhone(event.target.value)}
                          placeholder={privacyAction === 'pin' ? '••••' : '+256 7xx xxx xxx'}
                          className="w-full rounded-lg border border-blue-200 bg-white px-2 py-2 text-sm outline-none focus:border-blue-500"
                        />
                        <button
                          onClick={handlePrivacySave}
                          className="mt-2 w-full rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white"
                        >
                          {text('Save', 'Kola', 'Hifadhi', 'حفظ', 'Enregistrer')}
                        </button>
                      </div>
                    )}

                    <button
                      onClick={handleLogout}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                    >
                      <LogOut size={16} />
                      {text('Log out', 'Fulumya', 'Toka', 'تسجيل الخروج', 'Se déconnecter')}
                    </button>
                  </div>
                )}
              </div>
            </div>
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
            <span>{text('Record', 'Wandiika', 'Rekodi', 'تسجيل', 'Enregistrer')}</span>
          </button>

          <button 
            onClick={() => setActiveTab('ledgers')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-xs font-medium transition ${
              activeTab === 'ledgers' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <BookOpen size={18} />
            <span>{text('Ledgers', 'Ebitabo', 'Vitabu', 'دفاتر', 'Livres')}</span>
          </button>

          <button 
            onClick={() => setActiveTab('debts')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-xs font-medium transition ${
              activeTab === 'debts' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <CreditCard size={18} />
            <span>{text('Debts & Dues', 'Amabanja', 'Deni na Madeni', 'الديون', 'Dettes')}</span>
          </button>

          <button 
            onClick={() => setActiveTab('reports')}
            className={`flex flex-col items-center gap-1 py-1 px-3 rounded-lg text-xs font-medium transition ${
              activeTab === 'reports' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <BarChart3 size={18} />
            <span>{text('Reports', 'Ripoota', 'Ripoti', 'التقارير', 'Rapports')}</span>
          </button>
        </nav>

      </div>
    </div>
  );
}