import React, { useState, useMemo } from 'react';
import { Search, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { EmptyState } from './EmptyState';

export interface Column<T> {
  key: keyof T | string;
  header: string;
  render?: (row: T, idx: number) => React.ReactNode;
  sortable?: boolean;
  align?: 'left' | 'right' | 'center';
  width?: string;
}

interface DataTableProps<T extends Record<string, unknown>> {
  data: T[];
  columns: Column<T>[];
  searchable?: boolean;
  searchKeys?: (keyof T)[];
  pageSize?: number;
  loading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  rowKey?: (row: T, idx: number) => string | number;
  onRowClick?: (row: T) => void;
  stickyHeader?: boolean;
}

export function DataTable<T extends Record<string, unknown>>({
  data, columns, searchable = false, searchKeys = [], pageSize = 20,
  loading = false, emptyTitle = 'No data', emptyDescription,
  rowKey, onRowClick, stickyHeader = false,
}: DataTableProps<T>) {
  const [search,  setSearch]  = useState('');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page,    setPage]    = useState(1);

  const filtered = useMemo(() => {
    if (!search.trim() || !searchKeys.length) return data;
    const q = search.toLowerCase();
    return data.filter(row =>
      searchKeys.some(k => String(row[k] ?? '').toLowerCase().includes(q))
    );
  }, [data, search, searchKeys]);

  const sorted = useMemo(() => {
    if (!sortCol) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortCol as keyof T] ?? '';
      const bv = b[sortCol as keyof T] ?? '';
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortCol, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paged     = sorted.slice((page - 1) * pageSize, page * pageSize);

  function toggleSort(key: string) {
    if (sortCol === key) setDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortCol(key); setSortDir('asc'); }
    setPage(1);
  }
  function setDir(d: 'asc' | 'desc') { setSortDir(d); }

  if (loading) {
    return (
      <div className="animate-pulse space-y-2 p-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 bg-gray-100 rounded-lg" />
        ))}
      </div>
    );
  }

  if (!data.length) {
    return <EmptyState title={emptyTitle} description={emptyDescription} compact />;
  }

  return (
    <div>
      {searchable && (
        <div className="px-4 py-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="search"
              placeholder="Search…"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className={`bg-gray-50 border-b border-gray-100 ${stickyHeader ? 'sticky top-0 z-10' : ''}`}>
            <tr>
              {columns.map(col => (
                <th
                  key={String(col.key)}
                  className={`px-4 py-3 font-semibold text-gray-600 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'} ${col.sortable ? 'cursor-pointer select-none hover:text-gray-900' : ''}`}
                  style={col.width ? { width: col.width } : undefined}
                  onClick={() => col.sortable && toggleSort(String(col.key))}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && (
                      sortCol === String(col.key)
                        ? sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                        : <ChevronsUpDown className="w-3 h-3 opacity-30" />
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {paged.map((row, idx) => (
              <tr
                key={rowKey ? rowKey(row, idx) : idx}
                onClick={() => onRowClick?.(row)}
                className={`${onRowClick ? 'cursor-pointer hover:bg-blue-50/50 active:bg-blue-50' : 'hover:bg-gray-50/50'} transition-colors`}
              >
                {columns.map(col => (
                  <td
                    key={String(col.key)}
                    className={`px-4 py-3 text-gray-800 ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : ''}`}
                  >
                    {col.render ? col.render(row, idx) : String(row[col.key as keyof T] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pageCount > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, sorted.length)} of {sorted.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              ← Prev
            </button>
            <span className="px-3 py-1.5 text-xs font-medium text-gray-700">
              {page} / {pageCount}
            </span>
            <button
              onClick={() => setPage(p => Math.min(pageCount, p + 1))}
              disabled={page === pageCount}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50 transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
