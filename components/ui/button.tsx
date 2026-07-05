import Link from "next/link";

const baseClassName =
  "inline-flex items-center justify-center rounded-lg px-4 py-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

const variantClassNames = {
  primary: "bg-slate-900 text-white hover:bg-slate-800",
  secondary:
    "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50",
  danger: "border border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100",
  ghost: "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
} as const;

type ButtonVariant = keyof typeof variantClassNames;

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`${baseClassName} ${variantClassNames[variant]} ${className}`}
      {...props}
    />
  );
}

type ButtonLinkProps = {
  href: string;
  variant?: ButtonVariant;
  className?: string;
  children: React.ReactNode;
};

export function ButtonLink({
  href,
  variant = "secondary",
  className = "",
  children,
}: ButtonLinkProps) {
  return (
    <Link
      href={href}
      className={`${baseClassName} ${variantClassNames[variant]} ${className}`}
    >
      {children}
    </Link>
  );
}
