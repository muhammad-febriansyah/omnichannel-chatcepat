"use client";

// Aceternity UI — Resizable Navbar (https://ui.aceternity.com/components/resizable-navbar)
// Diadaptasi: motion/react → framer-motion, @tabler/icons → lucide, warna → token dark-safe.
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";
import { motion, AnimatePresence, useScroll, useMotionValueEvent } from "framer-motion";
import React, { useRef, useState } from "react";

interface NavbarProps {
  children: React.ReactNode;
  className?: string;
}
interface NavBodyProps {
  children: React.ReactNode;
  className?: string;
  visible?: boolean;
}
interface NavItemsProps {
  items: { name: string; link: string }[];
  className?: string;
  onItemClick?: () => void;
}
interface MobileNavProps {
  children: React.ReactNode;
  className?: string;
  visible?: boolean;
}
interface MobileNavHeaderProps {
  children: React.ReactNode;
  className?: string;
}
interface MobileNavMenuProps {
  children: React.ReactNode;
  className?: string;
  isOpen: boolean;
  onClose: () => void;
}

export const Navbar = ({ children, className }: NavbarProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const [visible, setVisible] = useState<boolean>(false);

  useMotionValueEvent(scrollY, "change", (latest) => {
    setVisible(latest > 80);
  });

  return (
    <motion.div ref={ref} className={cn("fixed inset-x-0 top-0 z-50 w-full px-2 pt-3", className)}>
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(child as React.ReactElement<{ visible?: boolean }>, { visible })
          : child,
      )}
    </motion.div>
  );
};

export const NavBody = ({ children, className, visible }: NavBodyProps) => {
  return (
    <motion.div
      animate={{
        backdropFilter: visible ? "blur(12px)" : "none",
        boxShadow: visible
          ? "0 0 24px rgba(30,42,120,0.06), 0 1px 1px rgba(0,0,0,0.05), 0 0 0 1px rgba(30,42,120,0.04), 0 8px 32px rgba(30,42,120,0.08)"
          : "none",
        width: visible ? "44%" : "100%",
        y: visible ? 12 : 0,
      }}
      transition={{ type: "spring", stiffness: 200, damping: 50 }}
      style={{ minWidth: "800px" }}
      className={cn(
        "relative z-[60] mx-auto hidden w-full max-w-7xl flex-row items-center justify-between self-start rounded-full bg-transparent px-4 py-2 lg:flex",
        visible && "border border-border bg-background/80",
        className,
      )}
    >
      {children}
    </motion.div>
  );
};

export const NavItems = ({ items, className, onItemClick }: NavItemsProps) => {
  const [hovered, setHovered] = useState<number | null>(null);
  return (
    <motion.div
      onMouseLeave={() => setHovered(null)}
      className={cn(
        "absolute inset-0 hidden flex-1 flex-row items-center justify-center space-x-1 text-sm font-medium lg:flex",
        className,
      )}
    >
      {items.map((item, idx) => (
        <a
          onMouseEnter={() => setHovered(idx)}
          onClick={onItemClick}
          className="relative px-4 py-2 text-muted-foreground transition-colors hover:text-foreground"
          key={`link-${idx}`}
          href={item.link}
        >
          {hovered === idx && (
            <motion.div layoutId="navbar-hovered" className="absolute inset-0 h-full w-full rounded-full bg-muted" />
          )}
          <span className="relative z-20">{item.name}</span>
        </a>
      ))}
    </motion.div>
  );
};

export const MobileNav = ({ children, className, visible }: MobileNavProps) => {
  return (
    <motion.div
      animate={{
        backdropFilter: visible ? "blur(12px)" : "none",
        boxShadow: visible ? "0 8px 32px rgba(30,42,120,0.10)" : "none",
        width: visible ? "92%" : "100%",
        paddingRight: visible ? "12px" : "0px",
        paddingLeft: visible ? "12px" : "0px",
        borderRadius: visible ? "1rem" : "2rem",
        y: visible ? 12 : 0,
      }}
      transition={{ type: "spring", stiffness: 200, damping: 50 }}
      className={cn(
        "relative z-50 mx-auto flex w-full max-w-[calc(100vw-1rem)] flex-col items-center justify-between bg-transparent px-0 py-2 lg:hidden",
        visible && "border border-border bg-background/80",
        className,
      )}
    >
      {children}
    </motion.div>
  );
};

export const MobileNavHeader = ({ children, className }: MobileNavHeaderProps) => {
  return <div className={cn("flex w-full flex-row items-center justify-between px-2", className)}>{children}</div>;
};

export const MobileNavMenu = ({ children, className, isOpen }: MobileNavMenuProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={cn(
            "absolute inset-x-0 top-14 z-50 flex w-full flex-col items-start justify-start gap-2 rounded-2xl border border-border bg-background px-4 py-6 shadow-xl",
            className,
          )}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const MobileNavToggle = ({ isOpen, onClick }: { isOpen: boolean; onClick: () => void }) => {
  return (
    <button
      type="button"
      aria-label={isOpen ? "Tutup menu" : "Buka menu"}
      aria-expanded={isOpen}
      onClick={onClick}
      className="inline-flex size-10 items-center justify-center rounded-lg text-foreground"
    >
      {isOpen ? <X className="size-5" /> : <Menu className="size-5" />}
    </button>
  );
};

export const NavbarButton = ({
  href,
  as: Tag = "a",
  children,
  className,
  variant = "primary",
  ...props
}: {
  href?: string;
  as?: React.ElementType;
  children: React.ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "dark";
} & (React.ComponentPropsWithoutRef<"a"> | React.ComponentPropsWithoutRef<"button">)) => {
  const base =
    "px-4 py-2 rounded-full text-sm font-semibold relative cursor-pointer transition duration-200 inline-block text-center hover:-translate-y-0.5";
  const variants = {
    primary: "bg-brand-blue text-white shadow-sm hover:bg-brand-navy",
    secondary: "bg-transparent text-foreground hover:text-brand-blue",
    dark: "bg-brand-navy text-white",
  };
  return (
    <Tag href={href || undefined} className={cn(base, variants[variant], className)} {...props}>
      {children}
    </Tag>
  );
};
