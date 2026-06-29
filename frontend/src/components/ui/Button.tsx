'use client';

import React from 'react';
import Link from 'next/link';

type Variant = 'primary' | 'success' | 'danger' | 'warning' | 'ghost' | 'link';
type Size = 'sm' | 'md' | 'lg';

interface BaseProps {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  children?: React.ReactNode;
}

type ButtonProps = BaseProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & { href?: undefined };
type AnchorProps = BaseProps & { href: string } & Omit<
    React.AnchorHTMLAttributes<HTMLAnchorElement>,
    'href' | 'children'
  >;

function classes(variant: Variant, size: Size, fullWidth?: boolean) {
  const v = variant === 'link' ? 'btn-ghost' : `btn-${variant}`;
  return ['btn', v, size !== 'md' ? `btn-${size}` : '', fullWidth ? 'btn-block' : '']
    .filter(Boolean)
    .join(' ');
}

const linkStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--accent)',
  boxShadow: 'none',
  padding: '0.4rem 0.5rem',
};

function Spinner() {
  return (
    <span
      aria-hidden="true"
      style={{
        width: 14,
        height: 14,
        border: '2px solid currentColor',
        borderTopColor: 'transparent',
        borderRadius: '50%',
        display: 'inline-block',
        animation: 'spin-slow 0.7s linear infinite',
      }}
    />
  );
}

export function Button(props: ButtonProps | AnchorProps) {
  const {
    variant = 'primary',
    size = 'md',
    loading = false,
    leftIcon,
    rightIcon,
    fullWidth,
    children,
    ...rest
  } = props as BaseProps & Record<string, unknown>;

  const className = [classes(variant, size, fullWidth), (rest as { className?: string }).className]
    .filter(Boolean)
    .join(' ');
  const style: React.CSSProperties = {
    ...(fullWidth ? { width: '100%' } : {}),
    ...(variant === 'link' ? linkStyle : {}),
    ...((rest as { style?: React.CSSProperties }).style || {}),
  };

  const content = (
    <>
      {loading ? <Spinner /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </>
  );

  if ('href' in props && props.href !== undefined) {
    const { href, ...anchorRest } = rest as { href: string } & Record<string, unknown>;
    return (
      <Link href={props.href} className={className} style={style} {...(anchorRest as object)}>
        {content}
      </Link>
    );
  }

  const { disabled, ...btnRest } = rest as { disabled?: boolean } & Record<string, unknown>;
  return (
    <button className={className} style={style} disabled={disabled || loading} {...(btnRest as object)}>
      {content}
    </button>
  );
}

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  children: React.ReactNode;
  size?: number;
  tone?: 'default' | 'danger';
}

export function IconButton({ label, children, size = 34, tone = 'default', style, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      style={{
        width: size,
        height: size,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border-subtle)',
        background: 'transparent',
        color: tone === 'danger' ? 'var(--danger-fg)' : 'var(--text-secondary)',
        cursor: 'pointer',
        transition: 'var(--transition)',
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}

export default Button;
