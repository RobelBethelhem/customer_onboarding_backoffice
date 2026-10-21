'use client';

import { Loader2 } from 'lucide-react';

/** "Showing 100 of 352 · Load more" under a list that is loaded a page at a time */
export default function LoadMore({ shown, total, loading, onClick }: {
  shown: number;
  total: number;
  loading: boolean;
  onClick: () => void;
}) {
  if (total <= shown) return null;
  return (
    <div className="flex items-center justify-center gap-4 py-2 text-sm text-gray-500">
      <span>Showing {shown} of {total}</span>
      <button
        onClick={onClick}
        disabled={loading}
        className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 bg-white rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />} Load more
      </button>
    </div>
  );
}
