export function getFirebaseConfig(env = process.env) {
  const config = {
    apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
    authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
    storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
  };

  return Object.fromEntries(
    Object.entries(config).filter(([, value]) => String(value).trim().length > 0),
  );
}

export function isFirebaseConfigured(env = process.env) {
  const config = getFirebaseConfig(env);
  return Object.keys(config).length >= 6;
}
