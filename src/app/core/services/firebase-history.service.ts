/**
 * Firebase History Service
 * Handles syncing match history data from Firebase Realtime Database
 */

import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { 
  getDatabase, 
  ref, 
  onValue, 
  set, 
  push, 
  remove,
  Database
} from 'firebase/database';
import { initializeApp, FirebaseApp, getApps } from 'firebase/app';
import { environment } from '../../../environments/environment';

export interface HistoryEntry {
  id?: string;
  date?: string;
  description?: string;
  
  // Team data
  teamA?: string[];
  teamB?: string[];
  scoreA?: number;
  scoreB?: number;
  scorerA?: string;
  scorerB?: string;
  assistA?: string;
  assistB?: string;
  ownGoalA?: string;
  ownGoalB?: string;
  yellowA?: string;
  yellowB?: string;
  redA?: string;
  redB?: string;
  
  // Financial data - Revenue (Thu)
  thu?: number;
  thuMode?: 'auto' | 'manual';
  thu_main?: number;
  thu_penalties?: number;
  thu_other?: number;
  
  // Financial data - Expenses (Chi)
  chi_trongtai?: number;
  chi_nuoc?: number;
  chi_san?: number;
  chi_dilai?: number;
  chi_anuong?: number;
  chi_khac?: number;
  chi_total?: number;
  
  // Metadata
  createdAt?: string | number | object | null;
  updatedAt?: string | number | object | null;
  updatedBy?: string;
  lastSaved?: string;
  createdBy?: string;
}

@Injectable({
  providedIn: 'root'
})
export class FirebaseHistoryService {
  private app: FirebaseApp | null = null;
  private database: Database | null = null;
  private isEnabled = false;
  
  private readonly _history$ = new BehaviorSubject<HistoryEntry[]>([]);
  private readonly _loading$ = new BehaviorSubject<boolean>(false);
  private readonly _error$ = new BehaviorSubject<string | null>(null);
  private readonly _connected$ = new BehaviorSubject<boolean>(false);

  constructor() {
    console.log('🔥 FirebaseHistoryService initializing...');
    this.initializeFirebase();
  }

  // Public observables
  get history$(): Observable<HistoryEntry[]> {
    return this._history$.asObservable();
  }

  get loading$(): Observable<boolean> {
    return this._loading$.asObservable();
  }

  get error$(): Observable<string | null> {
    return this._error$.asObservable();
  }

  get connected$(): Observable<boolean> {
    return this._connected$.asObservable();
  }

  private initializeFirebase(): void {
    try {
      // Check if Firebase config is valid (not placeholder values)
      const config = environment.firebase;
      const hasValidConfig = config.databaseURL && 
                           config.projectId && 
                           !config.apiKey.includes('fake') &&
                           !config.databaseURL.includes('placeholder');

      if (!hasValidConfig) {
        console.warn('⚠️ Firebase config contains placeholder values');
        this.isEnabled = false;
        return;
      }

      // Check if Firebase app already exists
      const existingApps = getApps();
      if (existingApps.length > 0) {
        console.log('🔥 Using existing Firebase app instance');
        this.app = existingApps[0];
      } else {
        console.log('🔥 Initializing new Firebase app');
        this.app = initializeApp(config);
      }
      
      this.database = getDatabase(this.app, config.databaseURL);
      this.isEnabled = true;
      
      console.log('✅ Firebase initialized successfully');
      console.log('🔗 Database URL:', config.databaseURL);
      
      // Set up real-time listener for history data
      this.setupHistoryListener();
      this.setupConnectionMonitoring();
      
    } catch (error) {
      console.error('❌ Firebase initialization failed:', error);
      this.isEnabled = false;
      this._error$.next(`Firebase initialization failed: ${error}`);
    }
  }

  private setupHistoryListener(): void {
    if (!this.database) {
      console.warn('Database not initialized');
      return;
    }

    this._loading$.next(true);
    
    const historyRef = ref(this.database, 'history');
    
    console.log('🔄 Setting up real-time listener for history data...');
    
    onValue(historyRef, 
      (snapshot) => {
        try {
          console.log('📥 Received history data from Firebase');
          
          const data = snapshot.val();
          const historyEntries: HistoryEntry[] = [];
          
          if (data) {
            // Convert Firebase object to array
            Object.keys(data).forEach(key => {
              const entry: HistoryEntry = {
                id: key,
                ...data[key]
              };
              historyEntries.push(entry);
            });
            
            // Sort by date (most recent first)
            historyEntries.sort((a, b) => {
              const getDateValue = (entry: HistoryEntry): number => {
                if (entry.date) {
                  if (typeof entry.date === 'string' || typeof entry.date === 'number') {
                    return new Date(entry.date).getTime();
                  }
                }
                if (entry.createdAt) {
                  if (typeof entry.createdAt === 'string' || typeof entry.createdAt === 'number') {
                    return new Date(entry.createdAt).getTime();
                  }
                }
                return 0;
              };
              
              const dateA = getDateValue(a);
              const dateB = getDateValue(b);
              return dateB - dateA;
            });
          }
          
          console.log(`📊 Loaded ${historyEntries.length} history entries from Firebase`);
          
          // Log the first entry for debugging
          if (historyEntries.length > 0) {
            console.log('📋 Sample entry:', historyEntries[0]);
          }
          
          this._history$.next(historyEntries);
          this._error$.next(null);
          this._connected$.next(true);
          
        } catch (error) {
          console.error('❌ Error processing history data:', error);
          this._error$.next(`Error processing history data: ${error}`);
        } finally {
          this._loading$.next(false);
        }
      },
      (error) => {
        console.error('❌ Firebase history listener error:', error);
        this._error$.next(`Firebase connection error: ${error.message}`);
        this._connected$.next(false);
        this._loading$.next(false);
        
        // Retry connection after delay
        setTimeout(() => {
          console.log('🔄 Retrying Firebase connection...');
          this.setupHistoryListener();
        }, 5000);
      }
    );
  }

  private setupConnectionMonitoring(): void {
    if (!this.database) return;
    
    const connectedRef = ref(this.database, '.info/connected');
    onValue(connectedRef, (snapshot) => {
      const isConnected = snapshot.val();
      this._connected$.next(isConnected);
      
      if (isConnected) {
        console.log('🟢 Firebase connected');
      } else {
        console.log('🔴 Firebase disconnected');
      }
    });
  }

  // Public methods for managing history
  async addHistoryEntry(entry: Omit<HistoryEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    if (!this.database || !this.isEnabled) {
      throw new Error('Firebase not available');
    }

    const historyRef = ref(this.database, 'history');
    const newEntryRef = push(historyRef);
    
    const newEntry: HistoryEntry = {
      ...entry,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await set(newEntryRef, newEntry);
    console.log('✅ History entry added to Firebase');
    
    return newEntryRef.key!;
  }

  async updateHistoryEntry(id: string, updates: Partial<HistoryEntry>): Promise<void> {
    if (!this.database || !this.isEnabled) {
      throw new Error('Firebase not available');
    }

    const entryRef = ref(this.database, `history/${id}`);
    const updatedData = {
      ...updates,
      updatedAt: new Date().toISOString()
    };

    await set(entryRef, updatedData);
    console.log('✅ History entry updated in Firebase');
  }

  async deleteHistoryEntry(id: string): Promise<void> {
    if (!this.database || !this.isEnabled) {
      throw new Error('Firebase not available');
    }

    const entryRef = ref(this.database, `history/${id}`);
    await remove(entryRef);
    console.log('✅ History entry deleted from Firebase');
  }

  // Get current history data synchronously
  getCurrentHistory(): HistoryEntry[] {
    return this._history$.value;
  }

  // Force refresh the data
  async refreshHistory(): Promise<void> {
    if (!this.isEnabled) {
      console.warn('Firebase not enabled, cannot refresh history');
      return;
    }
    
    console.log('🔄 Refreshing history data...');
    // The real-time listener will automatically update the data
  }

  // Check service status
  getStatus(): {
    isEnabled: boolean;
    isConnected: boolean;
    hasData: boolean;
    recordCount: number;
  } {
    return {
      isEnabled: this.isEnabled,
      isConnected: this._connected$.value,
      hasData: this._history$.value.length > 0,
      recordCount: this._history$.value.length
    };
  }
}