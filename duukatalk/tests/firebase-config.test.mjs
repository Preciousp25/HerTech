import test from 'node:test';
import assert from 'node:assert/strict';

import { getFirebaseConfig, isFirebaseConfigured } from '../lib/firebase-config.mjs';

test('missing Firebase env values are treated as unconfigured', () => {
  const config = getFirebaseConfig({});
  assert.equal(isFirebaseConfigured({}), false);
  assert.deepEqual(config, {});
});

test('valid Firebase env values are recognized as configured', () => {
  const config = getFirebaseConfig({
    NEXT_PUBLIC_FIREBASE_API_KEY: 'key',
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'demo.firebaseapp.com',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'demo-project',
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'demo-project.appspot.com',
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '123456789',
    NEXT_PUBLIC_FIREBASE_APP_ID: '1:123456789:web:abc',
  });

  assert.equal(isFirebaseConfigured({
    NEXT_PUBLIC_FIREBASE_API_KEY: 'key',
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: 'demo.firebaseapp.com',
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: 'demo-project',
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: 'demo-project.appspot.com',
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: '123456789',
    NEXT_PUBLIC_FIREBASE_APP_ID: '1:123456789:web:abc',
  }), true);

  assert.equal(config.projectId, 'demo-project');
});
