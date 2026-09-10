'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  Loader2,
  Mic,
  Store,
} from 'lucide-react';

type AuthMode = 'signup' | 'login';
type Language = 'EN' | 'LUG' | 'MIX';

interface AuthApiResponse {
  success: boolean;
  error?: string;
  attemptsRemaining?: number;
  lockedUntil?: string;
  vendorId?: string;
  businessName?: string;
  ownerName?: string;
  phone?: string;
}

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState<AuthMode>('signup');
  const [language, setLanguage] = useState<Language>('MIX');
  const [businessName, setBusinessName] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSignup = mode === 'signup';

  const text = (english: string, luganda: string) =>
    language === 'EN'
      ? english
      : language === 'LUG'
        ? luganda
        : `${english} · ${luganda}`;

  const formatLockoutMessage = (lockedUntil: string): string => {
    const unlockDate = new Date(lockedUntil);
    const timeLabel = unlockDate.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    return text(
      `Too many incorrect attempts. Please try again after ${timeLabel}.`,
      `Ogezezzaako emirundi mingi nga PIN ekyamu. Ddamu ogezeeko oluvannyuma lwa ${timeLabel}.`,
    );
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError('');
    setMessage('');

    if (!businessName.trim()) {
      setError(
        text(
          'Enter your business name to continue.',
          'Yingiza erinnya ly’ekibiina okweyongerayo.',
        ),
      );
      return;
    }

    if (!/^\d{4}$/.test(pin)) {
      setError(
        text(
          'Your PIN must be exactly 4 digits.',
          'PIN yo erina kuba nnamba 4 zokka.',
        ),
      );
      return;
    }

    setIsSubmitting(true);

    try {
      if (isSignup) {
        const response = await fetch('/api/auth/signup', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            businessName: businessName.trim(),
            pin,
          }),
        });

        const data = (await response.json().catch(() => null)) as
          | AuthApiResponse
          | null;

        if (!response.ok || !data?.success) {
          setError(
            data?.error ||
              text(
                'Could not create your account. Please try again.',
                'Tetusobodde kutondawo akaawunti yo. Ddamu ogezeeko.',
              ),
          );
          return;
        }

        setMessage(
          text(
            `Your ${businessName.trim()} account is ready to go. You can now log in.`,
            `Akaawunti ya ${businessName.trim()} eteekeddwa okukola. Kati osobola okuyingira.`,
          ),
        );

        // Switch to login mode after successful signup.
        setMode('login');
        setPin('');

        return;
      }

      // Login
      // The API requires BOTH the business name and PIN.
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          businessName: businessName.trim(),
          pin,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | AuthApiResponse
        | null;

      if (!response.ok || !data?.success) {
        if (data?.lockedUntil) {
          setError(formatLockoutMessage(data.lockedUntil));
        } else if (typeof data?.attemptsRemaining === 'number') {
          setError(
            text(
              `Incorrect PIN. ${data.attemptsRemaining} attempt${
                data.attemptsRemaining === 1 ? '' : 's'
              } remaining.`,
              `PIN nkyamu. Ogenda kusigalako emirundi ${data.attemptsRemaining}.`,
            ),
          );
        } else {
          setError(
            data?.error ||
              text(
                'Could not log in. Please try again.',
                'Tetusobodde kuyingira. Ddamu ogezeeko.',
              ),
          );
        }

        return;
      }

      // Login was successful.
      // The API should return the authenticated vendorId.
      console.log('Vendor logged in:', {
        vendorId: data.vendorId,
        businessName: data.businessName,
        ownerName: data.ownerName,
      });

      router.push('/');
    } catch {
      setError(
        text(
          'Something went wrong. Please check your connection and try again.',
          'Wabaddewo ekizibu. Kebera network yo oyongere ogezeeko.',
        ),
      );
    } finally {
      setIsSubmitting(false);
    }
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
              {text(
                'Your shop, your story.',
                'Ebyalo byo, ebyafaayo byo.',
              )}
            </p>
          </div>
        </div>

        <div className="relative z-10 max-w-md">
          <p className="mb-5 text-sm font-semibold uppercase tracking-[0.22em] text-amber-400">
            {text(
              'Simple books. Strong business.',
              'Ebitabo byawandiikibwa. Bizinensi ya maanyi.',
            )}
          </p>

          <h1 className="text-4xl font-bold leading-tight xl:text-5xl">
            {text(
              'Keep your business moving forward.',
              'Tereeza bizinensi yo okudda mu maaso.',
            )}
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

            {text(
              'Built for everyday shop owners',
              'Kuzimbiddwa abakola katale buli lunaku',
            )}
          </div>
        </div>

        <p className="relative z-10 text-xs text-blue-300">
          {text(
            '© 2025 DuukaTalk · Made for local businesses',
            '© 2025 DuukaTalk · Kizimbiddwa bizinensi ezimu',
          )}
        </p>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-6 flex justify-end">
            <label
              className="sr-only"
              htmlFor="login-language-mode"
            >
              Language
            </label>

            <select
              id="login-language-mode"
              value={language}
              onChange={(event) =>
                setLanguage(event.target.value as Language)
              }
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-sm outline-none focus:border-blue-600"
            >
              <option value="EN">English</option>
              <option value="LUG">Luganda</option>
              <option value="MIX">English + Luganda</option>
            </select>
          </div>

          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500 text-blue-950">
              <Mic size={20} strokeWidth={2.5} />
            </div>

            <div>
              <p className="font-bold text-blue-950">DuukaTalk</p>
              <p className="text-xs text-slate-500">
                {text(
                  'Your shop, your story.',
                  'Ebyalo byo, ebyafaayo byo.',
                )}
              </p>
            </div>
          </div>

          <div className="mb-8">
            <p className="mb-3 text-sm font-semibold text-amber-600">
              {isSignup
                ? text('Welcome to DuukaTalk', 'Tuyambalidde DuukaTalk')
                : text('Welcome back', 'Tuyanjula')}
            </p>

            <h2 className="text-3xl font-bold tracking-tight text-blue-950 sm:text-4xl">
              {isSignup
                ? text('Set up your shop.', 'Tegeka akatale ko.')
                : text('Log in to your shop.', 'Yingira mu katale ko.')}
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              {isSignup
                ? text(
                    'Create a quick, secure account for your business.',
                    'Tondawo akaawunti eyanguyiriza n’eyokwerinda.',
                  )
                : text(
                    'Enter your details to pick up where you left off.',
                    'Yingiza ebikukwatako okomekereza gy’oweddemu.',
                  )}
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
              {text('Sign up', 'Wandiise')}
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
              {text('Log in', 'Yingira')}
            </button>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-5"
            noValidate
          >
            <div>
              <label
                htmlFor="business-name"
                className="mb-2 block text-sm font-semibold text-slate-700"
              >
                {text(
                  'Business name',
                  'Erinnya ly’ekibiina',
                )}
              </label>

              <div className="relative">
                <Store
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  size={19}
                />

                <input
                  id="business-name"
                  type="text"
                  autoComplete="organization"
                  value={businessName}
                  onChange={(event) =>
                    setBusinessName(event.target.value)
                  }
                  placeholder={text(
                    "e.g. Mama Kintu's Shop",
                    'eky. Katale ya Mama Kintu',
                  )}
                  className="h-13 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10"
                />
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label
                  htmlFor="business-pin"
                  className="block text-sm font-semibold text-slate-700"
                >
                  {text(
                    '4-digit PIN',
                    'PIN ya namba 4',
                  )}
                </label>

                <span className="text-xs text-slate-400">
                  {text(
                    'Keep it private',
                    'Eky’ekyama',
                  )}
                </span>
              </div>

              <div className="relative">
                <LockKeyhole
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />

                <input
                  id="business-pin"
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  autoComplete={
                    isSignup
                      ? 'new-password'
                      : 'current-password'
                  }
                  pattern="[0-9]{4}"
                  maxLength={4}
                  value={pin}
                  onChange={(event) =>
                    setPin(
                      event.target.value
                        .replace(/\D/g, '')
                        .slice(0, 4),
                    )
                  }
                  placeholder="••••"
                  className="h-13 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-12 text-lg tracking-[0.45em] text-slate-900 outline-none transition placeholder:tracking-[0.35em] placeholder:text-slate-300 focus:border-blue-600 focus:ring-4 focus:ring-blue-600/10"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPin((visible) => !visible)
                  }
                  aria-label={
                    showPin
                      ? text('Hide PIN', 'Kisa PIN')
                      : text('Show PIN', 'Laga PIN')
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  {showPin ? (
                    <EyeOff size={18} />
                  ) : (
                    <Eye size={18} />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p
                className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700"
                role="alert"
              >
                {error}
              </p>
            )}

            {message && (
              <p
                className="rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700"
                role="status"
              >
                {message}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-13 w-full items-center justify-center gap-2 rounded-xl bg-blue-900 px-4 text-sm font-bold text-white shadow-lg shadow-blue-950/15 transition hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-900/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? (
                <Loader2
                  size={18}
                  className="animate-spin"
                />
              ) : (
                <>
                  {isSignup
                    ? text(
                        'Create my account',
                        'Tondawo akaawunti yange',
                      )
                    : text('Log in', 'Yingira')}

                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-xs leading-5 text-slate-400">
            {text(
              'By continuing, you agree to keep your account details safe and private.',
              'Bw’ogenda mu maaso, okiraba obuterevu mu kukiika ebikwata ku akaawunti yo.',
            )}
          </p>
        </div>
      </section>
    </main>
  );
}