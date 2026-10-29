import React from 'react';

export default function LoadingSpinner({
  size = 'md',
  message = 'Loading data...',
  className = '',
}) {
  const sizeMap = {
    sm: 'h-4 w-4 border-2',
    md: 'h-7 w-7 border-3',
    lg: 'h-10 w-10 border-4',
  };

  return (
    <div
      className={`flex flex-col items-center justify-center p-8 text-center ${className}`}
    >
      <div
        className={`animate-spin rounded-full border-slate-200 border-t-indigo-600 ${sizeMap[size] || sizeMap.md}`}
      />
      {message && (
        <p className="mt-3 text-sm text-slate-500 font-medium">{message}</p>
      )}
    </div>
  );
}
