import React from 'react';

const VARIANT_MAP = {
  PRESENT: 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-600/20',
  ABSENT: 'bg-rose-50 text-rose-700 border-rose-200 ring-rose-600/20',
  ACTIVE: 'bg-blue-50 text-blue-700 border-blue-200 ring-blue-600/20',
  COMPLETED: 'bg-slate-100 text-slate-700 border-slate-200 ring-slate-600/20',
  WARNING: 'bg-amber-50 text-amber-700 border-amber-200 ring-amber-600/20',
  ONLINE: 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-600/20',
  OFFLINE: 'bg-rose-50 text-rose-700 border-rose-200 ring-rose-600/20',
  CHECKING: 'bg-amber-50 text-amber-700 border-amber-200 ring-amber-600/20',
  DEMO: 'bg-purple-50 text-purple-700 border-purple-200 ring-purple-600/20',
  DEFAULT: 'bg-slate-50 text-slate-700 border-slate-200 ring-slate-600/20',
};

export default function Badge({
  children,
  variant = 'DEFAULT',
  className = '',
  dot = false,
  size = 'md',
}) {
  const variantKey = String(variant).toUpperCase();
  const colorClasses = VARIANT_MAP[variantKey] || VARIANT_MAP.DEFAULT;

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  }[size] || 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium border ${colorClasses} ${sizeClasses} ${className}`}
    >
      {dot && (
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            variantKey === 'PRESENT' || variantKey === 'ONLINE'
              ? 'bg-emerald-500 animate-pulse'
              : variantKey === 'ABSENT' || variantKey === 'OFFLINE'
              ? 'bg-rose-500'
              : variantKey === 'ACTIVE'
              ? 'bg-blue-500 animate-pulse'
              : 'bg-slate-400'
          }`}
        />
      )}
      {children}
    </span>
  );
}
