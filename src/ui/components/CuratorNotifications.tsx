"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { CuratorNotifications } from "@/src/domain/repositories/ContactRepository";
import { manageContact } from "@/src/infrastructure/contactServices";
import { useSessionValue } from "./SessionProvider";

const Context = createContext<CuratorNotifications | null>(null);
export const useCuratorNotifications = () => useContext(Context);
export function CuratorNotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useSessionValue();
  const admin = user?.isAdmin() ?? false;
  const [counts, setCounts] = useState<CuratorNotifications | null>(null);
  useEffect(() => {
    if (!admin) return;
    let active = true;
    const refresh = () => {
      void manageContact
        .notifications()
        .then((value) => {
          if (active) setCounts(value);
        })
        .catch(() => {
          if (active) setCounts(null);
        });
    };
    refresh();
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener("curator:refresh", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("curator:refresh", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [admin, user]);
  return (
    <Context.Provider value={admin ? counts : null}>
      {children}
    </Context.Provider>
  );
}
