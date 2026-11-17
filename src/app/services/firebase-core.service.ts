import { Injectable } from '@angular/core';
// firebase/app is small and always needed. firebase/database (~130 KB) is loaded on demand in initialize()
// so it stays out of the initial bundle.
import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import type { Database } from 'firebase/database';

import { firebaseConfig, isFirebaseConfigValid } from '../config/firebase.config';

@Injectable({ providedIn: 'root' })
export class FirebaseCoreService {
  app: FirebaseApp | null = null;
  database: Database | null = null;
  enabled = false;
  private failureReason: string | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _fb: any = null; // holder for db functions
  private initPromise: Promise<void> | null = null;

  constructor() {
    if (!isFirebaseConfigValid) {
      this.enabled = false;
      this.failureReason = 'invalid-config';
      console.log('⚠️ FirebaseCoreService disabled (invalid config)');
    }
    // Defer actual initialization until first ensureInitialized call.
  }

  private static initializing = false;
  private static initialized = false;
  private static cachedApp: FirebaseApp | null = null;
  private static cachedDb: Database | null = null;

  private async initialize() {
    if (!isFirebaseConfigValid) { return; }
    // Guard against concurrent / repeated initialization attempts
    if (FirebaseCoreService.initialized && FirebaseCoreService.cachedApp && FirebaseCoreService.cachedDb) {
      this.app = FirebaseCoreService.cachedApp;
      this.database = FirebaseCoreService.cachedDb;
      this.enabled = true;
      console.log('[FirebaseCore] Reusing existing cached app & database (singleton guard)');
      return;
    }
    if (FirebaseCoreService.initializing) {
      // Wait until first initializer completes
      console.log('[FirebaseCore] Another initialization in progress; awaiting completion');
      while (FirebaseCoreService.initializing) {
        await new Promise(res => setTimeout(res, 50));
      }
      // After wait, reuse cached values if available
      if (FirebaseCoreService.initialized && FirebaseCoreService.cachedApp && FirebaseCoreService.cachedDb) {
        this.app = FirebaseCoreService.cachedApp;
        this.database = FirebaseCoreService.cachedDb;
        this.enabled = true;
        console.log('[FirebaseCore] Initialization completed by another caller; adopting cached instances');
        return;
      }
    }
    FirebaseCoreService.initializing = true;
    try {
      console.log('[FirebaseCore] initialize() start. Existing apps:', getApps().length);
      const { getDatabase, ref, push, set, onValue, serverTimestamp, goOffline, goOnline } = await import('firebase/database');
      const existing = getApps();
      this.app = existing.length ? existing[0] : initializeApp(firebaseConfig);
      console.log('[FirebaseCore] App resolved. Name:', this.app.name);
      // Some environments / emulators can throw if passing databaseURL explicitly. Try with URL then fallback.
      try {
        this.database = getDatabase(this.app, firebaseConfig.databaseURL);
        console.log('[FirebaseCore] Database initialized with explicit URL.');
      } catch (dbErr) {
        console.warn('[FirebaseCore] getDatabase(databaseURL) failed, retrying without URL:', dbErr);
        this.database = getDatabase(this.app);
        console.log('[FirebaseCore] Database initialized WITHOUT explicit URL.');
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this._fb = { ref, push, set, onValue, serverTimestamp, goOffline, goOnline, getDatabase } as any;
      this.enabled = true;
      FirebaseCoreService.cachedApp = this.app;
      FirebaseCoreService.cachedDb = this.database;
      FirebaseCoreService.initialized = true;
      console.log('✅ Firebase core initialized (static imports). Enabled:', this.enabled, 'Has DB:', !!this.database);
    } catch (e) {
      console.error('❌ Firebase static init failed', e);
      this.failureReason = e instanceof Error ? e.message : 'static-init-failed';
      this.enabled = false;
      console.log('[FirebaseCore] Initialization failed. enabled set to false. failureReason:', this.failureReason);
    }
    FirebaseCoreService.initializing = false;
  }

  async ensureInitialized(): Promise<boolean> {
    if (this.enabled && this.app && this.database) return true;
    if (!this.initPromise) {
      this.initPromise = this.initialize();
    }
    await this.initPromise;
    return this.enabled;
  }

  // Accessor for dynamic firebase functions
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fb(): any { return this._fb; }

  getDiagnostics() {
    return {
      enabled: this.enabled,
      hasApp: !!this.app,
      hasDatabase: !!this.database,
      failureReason: this.failureReason,
      configValid: isFirebaseConfigValid,
      apiKeySnippet: (firebaseConfig.apiKey || '').slice(0, 8) + '…',
      dbUrl: firebaseConfig.databaseURL
    };
  }

  // Explicit method to dump diagnostics to console for ad-hoc debugging
  logDiagnostics(context = 'manual') {
    const d = this.getDiagnostics();
    console.log(`[FirebaseCore][Diagnostics:${context}]`, d);
  }
}
