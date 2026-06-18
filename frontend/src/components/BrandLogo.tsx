'use client';

type BrandLogoProps = {
  variant?: 'primary' | 'dark' | 'icon' | 'stacked';
  height?: number;
  compact?: boolean;
};

const LOGOS = {
  primary: '/brand/PID_HCMS_v4_three_people_primary.svg',
  dark: '/brand/PID_HCMS_v4_three_people_dark.svg',
  icon: '/brand/PID_HCMS_v4_three_people_icon.svg',
  stacked: '/brand/PID_HCMS_v4_three_people_stacked.svg',
};

export default function BrandLogo({ variant = 'dark', height = 40, compact = false }: BrandLogoProps) {
  const src = compact ? LOGOS.icon : LOGOS[variant];

  return (
    <img
      src={src}
      alt="PID hcms"
      style={{
        display: 'block',
        height,
        width: compact ? height : 'auto',
        maxWidth: '100%',
        objectFit: 'contain',
      }}
    />
  );
}
