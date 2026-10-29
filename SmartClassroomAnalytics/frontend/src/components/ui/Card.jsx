import React from 'react';

export default function Card({
  children,
  title,
  subtitle,
  action,
  className = '',
  bodyClassName = 'p-5',
  headerClassName = 'px-5 py-4 border-b border-slate-100',
  footer,
}) {
  return (
    <div
      className={`bg-white rounded-xl border border-slate-200/80 shadow-xs transition-shadow hover:shadow-sm ${className}`}
    >
      {(title || subtitle || action) && (
        <div
          className={`flex items-center justify-between gap-4 ${headerClassName}`}
        >
          <div>
            {title && (
              <h3 className="text-base font-semibold text-slate-900 tracking-tight">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
      {footer && (
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 rounded-b-xl">
          {footer}
        </div>
      )}
    </div>
  );
}
