import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import Button from './Button';

export default function ErrorAlert({
  title = 'Failed to load data',
  message,
  onRetry,
  className = '',
}) {
  return (
    <div
      className={`rounded-xl border border-rose-200 bg-rose-50/70 p-4 text-rose-900 ${className}`}
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold">{title}</h4>
          {message && (
            <p className="text-xs text-rose-700 mt-1 break-words">{message}</p>
          )}
        </div>
        {onRetry && (
          <Button
            size="sm"
            variant="outline"
            onClick={onRetry}
            icon={RefreshCw}
            className="shrink-0 bg-white/80 border-rose-300 text-rose-800 hover:bg-white"
          >
            Retry
          </Button>
        )}
      </div>
    </div>
  );
}
