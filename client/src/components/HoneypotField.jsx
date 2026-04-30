import React, { useState } from 'react';

// Honeypot field for public form endpoints (register, forgot-password,
// the public AI reply generator). Pairs with server/middleware/honeypot.js.
//
// How it works:
// - Renders a real <input name="website"> so naive form-filling bots fill it.
// - Real users never see / tab to / interact with it (off-screen + aria-hidden
//   + tabindex=-1 + autocomplete=off).
// - Caller uses the controlled value via the `value`/`onChange` pair OR just
//   reads the field on submit by `new FormData(e.target).get('website')`.
//
// We hide via off-screen positioning (NOT display:none) because some bots
// skip display:none fields. clip-path:inset(50%) and 1px size keep the
// element non-zero-area for bots that filter on visible rect, but the user
// can't see or interact with it.
//
// Usage:
//   <HoneypotField value={hp} onChange={setHp} />
//   ... on submit, if hp !== '' the server will fake-200 anyway, but we
//   can also short-circuit client-side to avoid the round trip.
export default function HoneypotField({ value, onChange, name = 'website' }) {
  // Local state if caller doesn't manage it — the field still works as a
  // honeypot because the server checks req.body.website regardless.
  const [local, setLocal] = useState('');
  const v = value !== undefined ? value : local;
  const set = onChange !== undefined ? onChange : setLocal;
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: '-9999px',
        top: 'auto',
        width: '1px',
        height: '1px',
        overflow: 'hidden',
        clipPath: 'inset(50%)',
      }}
    >
      <label htmlFor={`hp-${name}`}>Website (leave blank)</label>
      <input
        id={`hp-${name}`}
        type="text"
        name={name}
        tabIndex={-1}
        autoComplete="off"
        value={v}
        onChange={(e) => set(e.target.value)}
      />
    </div>
  );
}
