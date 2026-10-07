/* ══════════════════════════════════════════════════════════════════════════
   Trial store: the visitor's browser is the whole database.

   - `hydrate()` paints from localStorage, seeding a first visit with sample
     reference data.
   - `commit()` updates memory and writes the cache on the same tick.
   - Screens read through `useStore()` and write through `commit()`, exactly as
     they do in the full SOLE build, so every screen is unchanged.
   ══════════════════════════════════════════════════════════════════════════ */

import { useSyncExternalStore } from 'react';
import type { StoreData, StoreKey } from '../types';
import { TRIAL_SEED } from './trial';

const CACHE_KEY = 'sole_store_cache_v2';

const EMPTY: StoreData = {
  bookings: [], products: [], guides: [], staff: [],
  groups: [], expenses: [], templates: [], customers: [], imports: [],
};
const STORE_KEYS = Object.keys(EMPTY) as StoreKey[];

let data: StoreData = { ...EMPTY };

const listeners = new Set<() => void>();
type ErrorHandler = (message: string) => void;
let errorHandler: ErrorHandler = msg => console.error('[sole-store]', msg);

/** Route save failures to a toast instead of the console. */
export function onStoreError(fn: ErrorHandler): void {
  errorHandler = fn;
}

function emit(): void {
  for (const fn of listeners) fn();
}

/* ── cache ──────────────────────────────────────────────────────────────── */
function readCache(): Partial<StoreData> | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as Partial<StoreData>) : null;
  } catch {
    return null;
  }
}

function writeCache(): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    // Unlike the full build there is no server copy, so a failed write loses data.
    errorHandler('This browser is out of storage space. Remove some uploaded images and try again.');
  }
}

/** Paint from the last visit's data. */
export function primeFromCache(): void {
  const cached = readCache();
  if (!cached) return;
  const next = { ...EMPTY };
  for (const key of STORE_KEYS) {
    const list = cached[key];
    if (Array.isArray(list)) (next as any)[key] = list;
  }
  data = next;
  emit();
}

/* ── write ──────────────────────────────────────────────────────────────── */
export function commit(patch: Partial<StoreData>): void {
  data = { ...data, ...patch };
  writeCache();
  emit();
}

/* ── lifecycle ──────────────────────────────────────────────────────────── */
/** A first visit starts from the sample guides and template; later visits from their own data. */
export async function hydrate(): Promise<void> {
  if (!readCache()) commit(TRIAL_SEED);
  else primeFromCache();
}

/** Signing out keeps the data: there is no other copy. */
export function teardown(): void {}

/** Nothing to reload from: the browser already holds everything. */
export async function refresh(): Promise<void> {}

/* ── React binding ──────────────────────────────────────────────────────── */
function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

const getSnapshot = (): StoreData => data;

export function useStore(): StoreData {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
