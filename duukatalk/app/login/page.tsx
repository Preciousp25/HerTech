'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Mic,
  Store,
} from 'lucide-react';

const LANGUAGE_KEY = 'duukaTalkLanguage';

type AuthMode = 'signup' | 'login';
type Language = 'EN' | 'LUG' | 'SW' | 'AR' | 'FR';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>('login');
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window === 'undefined') return 'EN';
    const stored = window.localStorage.getItem(LANGUAGE_KEY) as Language | null;
    return stored ?? 'EN';
  });
  const [businessName, setBusinessName] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const isSignup = mode === 'signup';
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

  const handleLanguageChange = (nextLanguage: Language) => {
    setLanguage(nextLanguage);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LANGUAGE_KEY, nextLanguage);
    }
  };

  const saveSession = (name: string) => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        'duukaTalkSession',
        JSON.stringify({
          businessName: name,
          loggedInAt: new Date().toISOString(),
        }),
      );
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setMessage('');

    const cleanBusinessName = businessName.trim();

    if (!cleanBusinessName) {
      setError(text('Enter your business name to continue.', 'Yingiza erinnya ly’ekibiina okweyongerayo.'));
      return;
    }

    if (!/^\d{4}$/.test(pin)) {
      setError(text('Your PIN must be exactly 4 digits.', 'PIN yo erina kuba nnamba 4 zokka.'));
      return;
    }

    saveSession(cleanBusinessName);

    if (!isSignup) {
      router.push('/');
      return;
    }

    setMessage(
      text(
        `Your ${cleanBusinessName} account is ready to go.`,
        `Akaawunti ya ${cleanBusinessName} eteekeddwa okukola.`,
      ),
    );
    router.push('/');
  };

  const switchMode = (nextMode: AuthMode) => {
    setMode(nextMode);
    setError('');
    setMessage('');
  };

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900 lg:grid lg:grid-cols-[minmax(22rem,0.9fr)_minmax(30rem,1.1fr)]">
      <section className="relative hidden min-h-screen overflow-hidden bg-blue-950 px-10 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-16">
        <div className="absolute -right-28 top-24 h-72 w-72 rounded-full border-[3rem] border-amber-500/20" />
        <div className="absolute -bottom-40 -left-32 h-96 w-96 rounded-full bg-blue-900/70" />
        <div className="absolute bottom-32 right-20 h-4 w-4 rounded-full bg-amber-400 shadow-[0_0_0_10px_rgba(245,158,11,0.12)]" />

        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500 text-blue-950 shadow-lg shadow-amber-950/20">
            <Mic size={22} strokeWidth={2.5} />
          </div>
          <div>
            <p className="text-lg font-bold leading-none">DuukaTalk</p>
            <p className="mt-1 text-xs font-medium text-blue-200">
              {text('Your shop, your story.', 'Ebyalo byo, ebyafaayo byo.')}
            </p>
          </div>
        </div>

        <div className="relative z-10 max-w-md">
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.22em] text-amber-400">
            {text('Simple books. Strong business.', 'Ebitabo byawandiikibwa. Bizinensi ya maanyi.')}
          </p>
          <h1 className="text-4xl font-bold leading-tight xl:text-5xl">
            {text('Keep your business moving forward.', 'Tereeza bizinensi yo okudda mu maaso.')}
          </h1>
          <p className="mt-6 max-w-sm text-base leading-7 text-blue-100">
            {text(
              "Record sales, track debts, and understand your shop's story in one friendly place.",
              'Wandiika amagoba, teekateeka amabanja era otegeere ebyakolebwa mu katale mu kifo kimu ekyesigamizibwa.',
            )}
          </p>
          <div className="mt-10 flex items-center gap-3 text-sm font-medium text-blue-100">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-300">
              <Store size={17} />
            </span>
            {text('Built for everyday shop owners', 'Kuzimbiddwa abakola katale buli lunaku')}
          </div>
        </div>

        <p className="relative z-10 text-xs text-blue-300">
          {text('© 2025 DuukaTalk · Made for local businesses', '© 2025 DuukaTalk · Kizimbiddwa bizinensi ezimu')}
        </p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-6 flex justify-end">
            <label className="sr-only" htmlFor="login-language-mode">{text('Language', 'Lulimi', 'Lugha', 'اللغة', 'Langue')}</label>
            <select
              id="login-language-mode"
              value={language}
              onChange={(event) => handleLanguageChange(event.target.value as Language)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm outline-none focus:border-blue-600"
            >
              <option value="EN">English</option>
              <option value="LUG">Luganda</option>
              <option value="SW">Kiswahili</option>
              <option value="AR">العربية</option>
              <option value="FR">Français</option>
            </select>
          </div>

          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-blue-950">
              <Mic size={20} strokeWidth={2.5} />
            </div>
            <div>
              <p className="font-bold text-blue-950">DuukaTalk</p>
              <p className="text-xs text-slate-500">{text('Your shop, your story.', 'Ebyalo byo, ebyafaayo byo.')}</p>
            </div>
          </div>

          <div className="mb-8">
            <p className="mb-3 text-sm font-semibold text-amber-600">
              {isSignup ? text('Welcome to DuukaTalk', 'Tuyambalidde DuukaTalk', 'Karibu DuukaTalk', 'مرحبًا بك في DuukaTalk', 'Bienvenue chez DuukaTalk') : text('Welcome back', 'Tuyanjula', 'Karibu tena', 'مرحبًا بعودتك', 'Bon retour')}
            </p>
            <h2 className="text-3xl font-bold tracking-tight text-blue-950 sm:text-4xl">
              {isSignup ? text('Set up your shop.', 'Tegeka akatale ko.', 'Sanikisha duka lako.', 'أنشئ متجرك.', 'Configurez votre boutique.') : text('Log in to your shop.', 'Yingira mu katale ko.', 'Ingia kwenye duka lako.', 'تسجيل الدخول إلى متجرك.', 'Connectez-vous à votre boutique.')}
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              {isSignup
                ? text('Create a quick, secure account for your business.', 'Tondawo akaawunti eyanguyiriza n’eyokwerinda.', 'Unda akaunti ya haraka na salama ya biashara yako.', 'أنشئ حسابًا سريعًا وآمنًا لعملك.', 'Créez un compte rapide et sécurisé pour votre entreprise.')
                : text('Enter your details to pick up where you left off.', 'Yingiza ebikukwatako okomekereza gy’oweddemu.', 'Ingiza maelezo yako ili kuendelea kutoka kilichokoma.', 'أدخل التفاصيل لاستئناف ما بدأته.', 'Saisissez vos détails pour reprendre là où vous vous êtes arrêté.')}
            </p>
          </div>

          <div className="mb-8 grid grid-cols-2 rounded-xl bg-slate-200/80 p-1">
            <button
              type="button"
              onClick={() => switchMode('signup')}
              className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                isSignup
                  ? 'bg-white text-blue-950 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {text('Sign up', 'Wandiise', 'Jisajili', 'إنشاء حساب', 'S\'inscrire')}
            </button>
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`rounded-lg px-4 py-2.5 text-sm font-semibold transition ${
                !isSignup
                  ? 'bg-white text-blue-950 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {text('Log in', 'Yingira', 'Ingia', 'تسجيل الدخول', 'Se connecter')}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label htmlFor="business-name" className="mb-2 block text-sm font-semibold text-slate-700">
                {text('Business name', 'Erinnya ly’ekibiina', 'Jina la biashara', 'اسم العمل', 'Nom de l\'entreprise')}
              </label>
              <div className="relative">
                <Store className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={19} />
                <input
                  id="business-name"
                  type="text"
                  autoComplete="organization"
                  value={businessName}
                  onChange={(event) => setBusinessName(event.target.value)}
                  placeholder={text("e.g. Mama Kintu's Shop", "eky. Katale ya Mama Kintu", "mfano: Duka la Mama Kintu", "مثال: متجر أما كينتو", "ex. Boutique Mama Kintu")}
                  className="h-13 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10"
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label htmlFor="business-pin" className="block text-sm font-semibold text-slate-700">
                  {text('4-digit PIN', 'PIN ya namba 4', 'PIN ya nambari 4', 'PIN مكون من 4 أرقام', 'PIN à 4 chiffres')}
                </label>
                <span className="text-xs text-slate-400">{text('Keep it private', 'Eky’ekyama', 'Hifadhi kwa siri', 'احتفظ به سريًا', 'Gardez-le privé')}</span>
              </div>
              <div className="relative">
                <LockKeyhole className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  id="business-pin"
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  pattern="[0-9]{4}"
                  maxLength={4}
                  value={pin}
                  onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="••••"
                  className="h-13 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-12 text-lg tracking-[0.45em] text-slate-900 outline-none transition placeholder:tracking-[0.35em] placeholder:text-slate-300 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPin((visible) => !visible)}
                  aria-label={showPin ? text('Hide PIN', 'Kisa PIN', 'Ficha PIN', 'إخفاء PIN', 'Masquer le PIN') : text('Show PIN', 'Laga PIN', 'Onyesha PIN', 'إظهار PIN', 'Afficher le PIN')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {error && <p className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700" role="alert">{error}</p>}
            {message && <p className="rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700" role="status">{message}</p>}

            <button
              type="submit"
              className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-blue-900 px-4 text-sm font-bold text-white shadow-lg shadow-blue-950/15 transition hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-900/20"
            >
              {isSignup ? text('Create my account', 'Tondawo akaawunti yange', 'Unda akaunti yangu', 'إنشاء حسابي', 'Créer mon compte') : text('Log in', 'Yingira', 'Ingia', 'تسجيل الدخول', 'Se connecter')}
              <ArrowRight size={18} />
            </button>
          </form>

          <p className="mt-8 text-center text-xs leading-5 text-slate-400">
            {text('By continuing, you agree to keep your account details safe and private.', 'Bw’ogenda mu maaso, okiraba obuterevu mu kukiika ebikwata ku akaawunti yo.', 'Kwa kuendelea, unakubali kuweka maelezo ya akaunti yako salama na faragha.', 'بالمتابعة، أنت توافق على الحفاظ على تفاصيل حسابك آمنة وخاصة.', 'En continuant, vous acceptez de garder les détails de votre compte sécurisés et privés.')}
          </p>
        </div>
      </section>
    </main>
  );
}
