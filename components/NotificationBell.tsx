"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import Icon from "./Icon";

export default function NotificationBell() {
  const notifications = useQuery(api.notifications.myNotifications);
  const unread = useQuery(api.notifications.unreadCount) ?? 0;
  const markRead = useMutation(api.notifications.markRead);
  const markAllRead = useMutation(api.notifications.markAllRead);
  const [open, setOpen] = useState(false);

  // Hidden entirely for signed-out users (query returns []).
  if (notifications === undefined) return null;

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setOpen((o) => !o)}
        className="relative p-1.5 rounded-full text-on-surface active:scale-95 transition-transform"
      >
        <Icon name="notifications" className="text-2xl" fill={open} />
        {unread > 0 ? (
          <span className="absolute top-0 right-0 bg-error text-on-error text-[10px] min-w-4 h-4 px-1 rounded-full flex items-center justify-center font-bold tabular-nums">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute right-0 mt-2 w-[min(88vw,340px)] max-h-[70vh] overflow-y-auto bg-surface rounded-3xl shadow-xl border border-outline-variant/30 z-50">
            <div className="flex items-center justify-between px-md py-sm sticky top-0 bg-surface border-b border-outline-variant/30">
              <span className="font-label-md text-on-surface">Notifications</span>
              {unread > 0 ? (
                <button type="button" onClick={() => markAllRead()} className="font-label-sm text-primary">
                  Mark all read
                </button>
              ) : null}
            </div>

            {notifications.length === 0 ? (
              <p className="text-tertiary font-label-sm text-center py-lg">No notifications yet.</p>
            ) : (
              <ul className="divide-y divide-outline-variant/30">
                {notifications.map((n) => (
                  <li key={n._id}>
                    <button
                      type="button"
                      onClick={() => !n.read && markRead({ id: n._id })}
                      className={`w-full text-left px-md py-3 flex gap-sm ${n.read ? "" : "bg-primary-fixed/30"}`}
                    >
                      <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${n.read ? "bg-transparent" : "bg-primary"}`} />
                      <span className="min-w-0">
                        <span className="block font-label-md text-on-surface">{n.title}</span>
                        <span className="block font-label-sm text-tertiary">{n.body}</span>
                        <span className="block font-label-sm text-tertiary text-[11px] mt-0.5">
                          {new Date(n.createdAt).toLocaleString([], { hour: "numeric", minute: "2-digit", day: "numeric", month: "short" })}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}
