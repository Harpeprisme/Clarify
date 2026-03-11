/**
 * useFilterParams — reads global filters from Zustand and returns
 * a function to build URLSearchParams for API calls.
 *
 * Usage:
 *   const { buildParams, dateFrom, dateTo, accountIds } = useFilterParams();
 *
 * buildParams(extra?)  → URLSearchParams ready to append to a URL
 *   - Adds startDate / endDate from the global filter
 *   - Adds accountIds=1,2,3 (comma-separated) when accounts are selected
 *   - Merges any `extra` key/value pairs
 */
import useStore from '../store';

const useFilterParams = () => {
  const dateFrom   = useStore(s => s.filterDateFrom);
  const dateTo     = useStore(s => s.filterDateTo);
  const accountIds = useStore(s => s.filterAccountIds); // number[]

  const buildParams = (extra = {}) => {
    const p = new URLSearchParams();
    // Date range
    if (dateFrom) p.set('startDate', dateFrom);
    if (dateTo)   p.set('endDate',   dateTo);
    // Accounts — send as comma-separated so one param, parsed by all backends
    if (accountIds && accountIds.length > 0) {
      p.set('accountIds', accountIds.join(','));
    }
    // Extra per-page params (page, limit, search, …)
    Object.entries(extra).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') p.set(k, v);
    });
    return p;
  };

  return { buildParams, dateFrom, dateTo, accountIds };
};

export default useFilterParams;
