'use client';

import React from 'react';

type Presence = 'online' | 'offline' | 'away' | null;

const presenceColor: Record<Exclude<Presence, null>, string> = {
  online: 'var(--success)',
  offline: 'var(--text-muted)',
  away: 'var(--warning)',
};

export function Avatar({ name, src, size = 36, presence = null }: {
  name?: string;
  src?: string | null;
  size?: number;
  presence?: Presence;
}) {
  const initial = (name || '?').charAt(0).toUpperCase();
  return (
    <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
      <span
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: src ? 'var(--surface-sunken)' : 'var(--gradient-primary)',
          color: '#fff',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: size * 0.4,
          overflow: 'hidden',
        }}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={name || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          initial
        )}
      </span>
      {presence && (
        <span
          aria-label={presence}
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: Math.max(8, size * 0.28),
            height: Math.max(8, size * 0.28),
            borderRadius: '50%',
            background: presenceColor[presence],
            border: '2px solid var(--surface-raised)',
          }}
        />
      )}
    </span>
  );
}

export function AvatarGroup({ people, max = 4, size = 30 }: {
  people: { name?: string; src?: string | null }[];
  max?: number;
  size?: number;
}) {
  const shown = people.slice(0, max);
  const extra = people.length - shown.length;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center' }}>
      {shown.map((p, i) => (
        <span key={i} style={{ marginLeft: i === 0 ? 0 : -size * 0.3, border: '2px solid var(--surface-raised)', borderRadius: '50%' }}>
          <Avatar name={p.name} src={p.src} size={size} />
        </span>
      ))}
      {extra > 0 && (
        <span
          style={{
            marginLeft: -size * 0.3,
            width: size,
            height: size,
            borderRadius: '50%',
            background: 'var(--surface-sunken)',
            color: 'var(--text-secondary)',
            border: '2px solid var(--surface-raised)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: size * 0.34,
            fontWeight: 600,
          }}
        >
          +{extra}
        </span>
      )}
    </span>
  );
}

export default Avatar;
