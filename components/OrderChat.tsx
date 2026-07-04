"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { humanize } from "@/lib/errors";
import Icon from "./Icon";

// Starter prompts per side — the whole reason this chat exists is questions
// like "have you started?", so hand them out as one-tap chips.
const OPENERS: Record<string, string[]> = {
  customer: ["Have you started preparing my order?", "How long will it take?"],
  seller: ["We've started on your order 🍳", "Your order is ready for pickup"],
  rider: ["I'm on my way", "I'm outside — can you meet me?"],
  admin: ["Hi, support here — how can we help?"],
};

/**
 * Live thread between everyone on one order. The server decides who the
 * caller is (customer / seller / rider / admin) and whether the thread is
 * still open — this component just renders whatever it's allowed to see.
 */
export default function OrderChat({ orderId }: { orderId: string }) {
  const chat = useQuery(api.orderChat.list, { orderId });
  const send = useMutation(api.orderChat.send);

  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const count = chat?.messages.length ?? 0;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [count]);

  if (chat === undefined)
    return <div className="h-16 rounded-2xl bg-surface-container-low animate-pulse" />;
  if (chat === null) return null;

  const deliver = async (text: string) => {
    setBusy(true);
    setErr(null);
    try {
      await send({ orderId: orderId as Id<"marketplaceOrders">, body: text });
      setDraft("");
    } catch (e) {
      setErr(humanize(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {chat.messages.length === 0 ? (
        <p className="font-label-sm text-tertiary mb-sm">
          No messages yet — say hi, or ask about your order.
        </p>
      ) : (
        <div className="flex flex-col gap-2 mb-sm max-h-72 overflow-y-auto pr-1">
          {chat.messages.map((m) => (
            <div key={m._id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                  m.mine
                    ? "bg-primary text-on-primary rounded-br-md"
                    : "bg-surface-container-high text-on-surface rounded-bl-md"
                }`}
              >
                {!m.mine ? (
                  <p className="font-label-sm text-[11px] opacity-70 capitalize">{m.senderName}</p>
                ) : null}
                <p className="font-body-md text-[14px] whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`font-label-sm text-[10px] mt-0.5 ${m.mine ? "text-on-primary/70" : "text-tertiary"}`}>
                  {new Date(m.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      )}

      {chat.open ? (
        <>
          {chat.messages.length === 0 ? (
            <div className="flex flex-wrap gap-2 mb-sm">
              {(OPENERS[chat.me] ?? []).map((s) => (
                <button
                  key={s}
                  type="button"
                  disabled={busy}
                  onClick={() => deliver(s)}
                  className="px-3 py-1.5 rounded-full bg-surface-container-high text-on-surface-variant font-label-sm disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          ) : null}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (draft.trim()) deliver(draft);
            }}
            className="flex items-center gap-2"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Type a message…"
              maxLength={500}
              className="flex-grow rounded-full bg-surface-container-low border border-outline-variant/50 px-4 py-2.5 font-body-md text-[14px] focus:outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={busy || !draft.trim()}
              aria-label="Send message"
              className="w-11 h-11 rounded-full bg-primary text-on-primary flex items-center justify-center flex-shrink-0 disabled:opacity-50 active:scale-95 transition-transform"
            >
              <Icon name="send" className="text-xl" />
            </button>
          </form>
        </>
      ) : (
        <p className="font-label-sm text-tertiary flex items-center gap-1">
          <Icon name="lock" className="text-base" /> Chat closed — this order is finished.
        </p>
      )}

      {err ? <p className="text-error font-label-sm mt-2">{err}</p> : null}
    </div>
  );
}
