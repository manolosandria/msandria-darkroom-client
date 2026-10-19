'use client';

import Image from "next/image";
import Link from "next/link";
import SessionMenu from "./SessionMenu";
import { useSessionValue } from "./SessionProvider";
import { useCuratorNotifications } from "./CuratorNotifications";

export default function MainHeader() {
  const { user } = useSessionValue();
  const notifications = useCuratorNotifications();
  const pending = (notifications?.comments ?? 0) + (notifications?.inbox ?? 0);
  // Offered to the administrator only, and only as a shortcut: the API turns down a
  // publish from anyone else, whatever the header chose to show.
  const canPublish = user?.isAdmin() ?? false;

  return (
      <header className="bg-gray-100 py-4 md:py-6 flex flex-wrap gap-6 xl:flex-row flex-col items-center justify-between px-8">
        <Image src="/images/branding/manolo-logo-black.svg" alt="Manolo Sandria Fotografía"
          width={384} height={96}
          className="w-64 max-w-full xl:w-96 h-auto py-2 md:py-0"
        />
        <div className="flex flex-wrap justify-center gap-6 flex-col sm:flex-row items-center">
          <nav className="flex flex-wrap justify-center gap-6 flex-col sm:flex-row items-center text-lg font-semibold text-gray-700">
            <Link href="/">Home</Link>
            <Link href="/gallery">Gallery</Link>
            {canPublish && (
              <Link href="/curator">
                Curator
                {pending > 0 && (
                  <span
                    className="curator-badge"
                    aria-label={`${pending} pending notifications`}
                  >
                    {pending}
                  </span>
                )}
              </Link>
            )}
            <Link href="/contact">Contact</Link>
          </nav>
          <SessionMenu />
        </div>
      </header>
    );
}
