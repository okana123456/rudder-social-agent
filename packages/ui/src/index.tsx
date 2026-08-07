import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

export function Button({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`rudder-button ${className}`} {...props} />;
}
export function Card({ children, className = '' }: PropsWithChildren<{ className?: string }>) {
  return <section className={`rudder-card ${className}`}>{children}</section>;
}
