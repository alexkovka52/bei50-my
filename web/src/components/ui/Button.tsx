import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "outline" | "lime" | "glass";
type Size = "sm" | "md" | "lg";

const variantClass: Record<Variant, string> = {
  primary: "border-transparent bg-moss text-paper hover:bg-forest",
  outline: "border-lichen bg-transparent text-forest hover:bg-paper",
  lime: "border-transparent bg-budbreak text-forest hover:brightness-95",
  glass:
    "border-[rgba(227,238,212,0.14)] bg-[rgba(15,42,29,0.76)] text-dew backdrop-blur-[16px] hover:bg-[rgba(15,42,29,0.86)]",
};

const sizeClass: Record<Size, string> = {
  sm: "min-h-11 px-4 text-sm",
  md: "min-h-11 px-5 text-[15px]",
  lg: "min-h-12 px-6 text-base",
};

function buttonClasses(variant: Variant, size: Size, className?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-pill border font-semibold leading-none no-underline",
    "disabled:cursor-not-allowed disabled:opacity-50",
    variantClass[variant],
    sizeClass[size],
    className,
  );
}

type Shared = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
};

type ButtonProps = Shared & Omit<ComponentProps<"button">, "className" | "children"> & { href?: undefined };
type ButtonLinkProps = Shared & Omit<ComponentProps<typeof Link>, "className" | "children" | "href"> & { href: string };

export function Button({ variant = "primary", size = "md", className, children, ...props }: ButtonProps | ButtonLinkProps) {
  const classes = buttonClasses(variant, size, className);
  if ("href" in props && props.href) {
    const { href, ...rest } = props;
    return (
      <Link {...rest} href={href} className={classes}>
        {children}
      </Link>
    );
  }
  const { type, ...buttonRest } = props as ComponentProps<"button">;
  return (
    <button type={type ?? "button"} className={classes} {...buttonRest}>
      {children}
    </button>
  );
}
