import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { startOfMonth, subMonths, startOfYear, format } from 'date-fns';
import api from '../api';

// ─── Preset helpers ───────────────────────────────────────────────────────────
const today = () => format(new Date(), 'yyyy-MM-dd');

const presetRanges = {
  '1M': () => ({
    dateFrom: format(subMonths(new Date(), 1), 'yyyy-MM-dd'),
    dateTo: today(),
  }),
  '3M': () => ({
    dateFrom: format(subMonths(new Date(), 3), 'yyyy-MM-dd'),
    dateTo: today(),
  }),
  '6M': () => ({
    dateFrom: format(subMonths(new Date(), 6), 'yyyy-MM-dd'),
    dateTo: today(),
  }),
  'YTD': () => ({
    dateFrom: format(startOfYear(new Date()), 'yyyy-MM-dd'),
    dateTo: today(),
  }),
  'ALL': () => ({ dateFrom: '', dateTo: '' }),
};

const DEFAULT_PRESET = '3M';

const useStore = create(
  devtools((set, get) => ({
    // ── Theme ──────────────────────────────────────────────────────────
    darkMode: localStorage.getItem('theme') === 'dark',
    toggleDarkMode: () => {
      const isDark = !get().darkMode;
      localStorage.setItem('theme', isDark ? 'dark' : 'light');
      if (isDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
      } else {
        document.documentElement.removeAttribute('data-theme');
      }
      set({ darkMode: isDark });
    },

    // ── Auth ────────────────────────────────────────────────────────────
    user: JSON.parse(localStorage.getItem('openbank_user')) || null,
    setUser: (user, token) => {
      if (user && token) {
        localStorage.setItem('openbank_user', JSON.stringify(user));
        localStorage.setItem('openbank_token', token);
      } else {
        localStorage.removeItem('openbank_user');
        localStorage.removeItem('openbank_token');
      }
      set({ user });
    },

    // ── Accounts cache ──────────────────────────────────────────────────
    accountTypes: [],
    fetchAccountTypes: async () => {
      try {
        const { data } = await api.get('/account-types');
        set({ accountTypes: data });
        return data;
      } catch (error) { console.error('Failed to fetch account types:', error); }
    },

    accounts: [],
    fetchAccounts: async () => {
      try {
        const { data } = await api.get('/accounts');
        set({ accounts: data });
        return data;
      } catch (error) {
        console.error('Failed to fetch accounts:', error);
      }
    },

    // ── Global Filters ──────────────────────────────────────────────────
    // preset: '1M' | '3M' | '6M' | 'YTD' | 'ALL' | 'CUSTOM'
    filterPreset: DEFAULT_PRESET,
    filterDateFrom: presetRanges[DEFAULT_PRESET]().dateFrom,
    filterDateTo:   presetRanges[DEFAULT_PRESET]().dateTo,
    // [] means "all accounts selected"
    filterAccountIds: [],
    // 'ALL' | 'COURANT' | 'EPARGNE' | 'CREDIT'
    // Global comparative benchmark for Bourse module
    customBenchmarkTicker: '^GSPC', // Default to S&P 500
    setCustomBenchmarkTicker: (ticker) => set({ customBenchmarkTicker: ticker }),

    /** Set a named preset (updates dates automatically) */
    setFilterPreset: (preset) => {
      const range = presetRanges[preset]?.() ?? { dateFrom: '', dateTo: '' };
      set({ filterPreset: preset, filterDateFrom: range.dateFrom, filterDateTo: range.dateTo });
    },

    /** Set account type filter and automatically select all accounts of that type */
    setFilterAccountType: (type) => {
      const { accounts, accountTypes } = get();
      if (type === 'ALL') {
        set({ filterAccountType: 'ALL', filterAccountIds: [] });
        return;
      }

      const matches = accounts.filter(acc => {
        const typeDef = accountTypes.find(t => t.id === acc.type);
        const group = typeDef ? typeDef.group : null;
        return group === type;
      });

      set({ 
        filterAccountType: type, 
        filterAccountIds: matches.map(a => a.id) 
      });
    },

    /** Set a custom date range */
    setFilterCustomRange: (dateFrom, dateTo) => {
      set({ filterPreset: 'CUSTOM', filterDateFrom: dateFrom, filterDateTo: dateTo });
    },

    /** Toggle a single account id in the selection; empty array = all accounts */
    toggleFilterAccount: (id) => {
      const current = get().filterAccountIds;
      const accounts = get().accounts;
      let next;
      
      if (current.includes(id)) {
        next = current.filter(a => a !== id);
      } else {
        next = [...current, id];
      }
      
      set({ filterAccountIds: next });

      // Auto-update filterAccountType based on selection
      if (next.length > 0) {
        const { accountTypes } = get();
        const selectedAccs = accounts.filter(a => next.includes(a.id));
        const types = new Set(selectedAccs.map(a => {
          const typeDef = accountTypes.find(t => t.id === a.type);
          return typeDef ? typeDef.group : null;
        }));

        if (types.size === 1 && [...types][0] !== null) {
          set({ filterAccountType: [...types][0] });
        } else {
          set({ filterAccountType: 'ALL' });
        }
      }
    },

    /** Select all accounts (clear the filter) */
    clearFilterAccounts: () => set({ filterAccountIds: [], filterAccountType: 'ALL' }),

    /** Convenience: return URLSearchParams fragment for API calls */
    getFilterParams: () => {
      const { filterDateFrom, filterDateTo, filterAccountIds, filterAccountType, accounts } = get();
      const p = new URLSearchParams();
      if (filterDateFrom) p.append('startDate', filterDateFrom);
      if (filterDateTo)   p.append('endDate',   filterDateTo);
      
      let finalIds = [...filterAccountIds];

      // If no specific accounts selected, but a type is selected, filter accounts by type
      if (finalIds.length === 0 && filterAccountType !== 'ALL') {
        const { accountTypes } = get();
        const matches = accounts.filter(acc => {
          const typeDef = accountTypes.find(t => t.id === acc.type);
          const group = typeDef ? typeDef.group : null;
          return group === filterAccountType;
        });
        finalIds = matches.map(a => a.id);
      }

      if (finalIds.length > 0) {
        p.append('accountIds', finalIds.join(','));
      }

      return p;
    },

    // ── Misc ────────────────────────────────────────────────────────────
    isLoading: false,
    setLoading: (loading) => set({ isLoading: loading }),
  }))
);

export { presetRanges };
export default useStore;
