"use client";

import "./navigation.css";
import { usePathname } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import SessionMenu from "./SessionMenu";
import { useSessionValue } from "./SessionProvider";
import { useCuratorNotifications } from "./CuratorNotifications";

export default function MainHeader() {
  const pathname = usePathname();
  const { user } = useSessionValue();
  const notifications = useCuratorNotifications();
  const pending = (notifications?.comments ?? 0) + (notifications?.inbox ?? 0);
  // Offered to the administrator only, and only as a shortcut: the API turns down a
  // publish from anyone else, whatever the header chose to show.
  const canPublish = user?.isAdmin() ?? false;

  return (
    <header className="main-header">
      <Link
        href="/"
        aria-label="Manolo Sandria — home"
        className="main-header__brand"
      >
        <Image
          src="/images/branding/manolo-logo-black.svg"
          alt="Manolo Sandria Fotografía"
          width={384}
          height={96}
          className="w-64 max-w-full xl:w-96 h-auto py-2 md:py-0"
        />
      </Link>
      <div className="main-header__actions">
        <nav aria-label="Main navigation" className="main-header__nav">
          {[
            ["/", "Home"],
            ["/gallery", "Gallery"],
            ["/collections", "Collections"],
            ...(canPublish ? [["/curator", "Curator"]] : []),
            ["/contact", "Contact"],
          ].map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
            >
              {label}
              {href === "/curator" && pending > 0 && (
                <span
                  className="curator-badge"
                  aria-label={`${pending} pending notifications`}
                >
                  {pending}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <SessionMenu />
      </div>
    </header>
  );
}
