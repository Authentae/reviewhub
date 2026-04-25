import React from 'react';

// Shared empty-state card used on Dashboard, Analytics, and anywhere else
// a "no data yet" message needs a consistent look. Accepts primary/secondary
// actions as children so each caller decides its own CTAs — keeps the
// component presentation-only and decoupled from the surrounding data flow.
//
// Props:
//   icon     — any short string (emoji) or ReactNode rendered as the hero glyph
//   title    — bold line under the icon
//   body     — optional grey sub-text
//   children — action row (buttons, links)
//   className — extra classes on the outer card (rarely needed)
export default function EmptyState({ icon, title, body, children, className = '' }) {
  return (
    <div className={`card p-12 text-center ${className}`}>
      {icon && (
        <p className="text-4xl mb-3" aria-hidden="true">{icon}</p>
      )}
      <p className="font-semibold text-gray-700 dark:text-gray-300 mb-1">
        {title}
      </p>
      {body && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5 max-w-md mx-auto">
          {body}
        </p>
      )}
      {children && (
        <div className="flex items-center justify-center gap-3 flex-wrap mt-2">
          {children}
        </div>
      )}
    </div>
  );
}
