"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Início", icon: "⌂" },
  { href: "/orders", label: "Pedidos", icon: "≡" },
  { href: "/products", label: "Cardápio", icon: "★" },
  { href: "/tables", label: "Mesas", icon: "▦" },
  { href: "/more", label: "Mais", icon: "···" },
];

export function TopNav() {
  const pathname = usePathname();

  return (
    <nav className="top-nav" aria-label="Navegação principal">
      {LINKS.map((link) => {
        const active =
          link.href === "/"
            ? pathname === "/"
            : pathname.startsWith(link.href);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`nav-link${active ? " active" : ""}`}
          >
            <span className="icon">{link.icon}</span>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
