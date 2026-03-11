import { useEffect } from 'react';
import useStore from '../store';

/**
 * Returns the current global filter as URLSearchParams-ready values.
 * Also accepts a callback that will be called whenever the filters change.
 *
 * @param {Function} onChange - called with no arguments when filters change
 * @returns {{ dateFrom, dateTo, accountIds, buildParams }}
 */
const useGlobalFilter = (onChange) => {
  const filterDateFrom    = useStore(s => s.filterDateFrom);
  const filterDateTo      = useStore(s => s.filterDateTo);
  const filterAccountIds  = useStore(s => s.filterAccountIds);

  // Fire onChange whenever any filter value changes
  useEffect(() => {
    if (onChange) onChange();
  }, [filterDateFrom, filterDateTo, filterAccountIds.join(',')]);

  /**
   * Build URLSearchParams for a single-account API.
   * If multiple accounts are selected, builds one per request (caller decides).
   */
  const buildParams = (extra = {}) => {
    const p = new URLSearchParams(extra);
    if (filterDateFrom) p.set('startDate', filterDateFrom);
    if (filterDateTo)   p.set('endDate',   filterDateTo);
    // Single-account filter: only add if exactly one selected
    if (filterAccountIds.length === 1) p.set('accountId', filterAccountIds[0]);
    return p;
  };

  /**
   * Append multiple-account filters to URLSearchParams.
   * When no accounts selected, adds nothing (= all accounts).
   */
  const buildParamsMulti = (extra = {}) => {
    const p = new URLSearchParams(extra);
    if (filterDateFrom) p.set('startDate', filterDateFrom);
    if (filterDateTo)   p.set('endDate',   filterDateTo);
    // for multi-account, caller fetches once and filters client-side
    return p;
  };

  return {
    dateFrom:   filterDateFrom,
    dateTo:     filterDateTo,
    accountIds: filterAccountIds,
    buildParams,
    buildParamsMulti,
  };
};

export default useGlobalFilter;
