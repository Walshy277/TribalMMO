import { useCallback, useEffect, useRef, useState } from "react";
import { fetchClanMessages, sendClanMessage } from "../lib/clanApi";
import type { ClanMessage } from "../types";
import { PlayerLink } from "./PlayerLink";
import { Notice } from "./ui/Notice";

const POLL_MS = 4000;

export function ClanChat() {
  const [messages, setMessages] = useState<ClanMessage[] | null>(null);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const res = await fetchClanMessages();
    if (res.error) setError(res.error);
    else setMessages(res.data ? [...res.data].reverse() : []);
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_MS);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed) return;
    setSending(true);
    setError(null);
    const err = await sendClanMessage(trimmed);
    if (err) {
      setError(err);
    } else {
      setBody("");
      await load();
    }
    setSending(false);
  };

  return (
    <div className="space-y-2">
      {error ? <Notice tone="error">{error}</Notice> : null}

      <div
        ref={scrollRef}
        className="rounded-xl border border-stone-800/40 bg-stone-900/40 p-2.5 max-h-56 overflow-y-auto space-y-1.5"
      >
        {messages === null ? (
          <div className="text-[11px] text-stone-600 text-center py-4">
            The fire-side chatter is stirring…
          </div>
        ) : messages.length === 0 ? (
          <div className="text-[11px] text-stone-600 text-center py-4 italic">
            No words spoken yet.
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="text-[11px] leading-relaxed">
              <PlayerLink
                name={m.sender_name}
                className="text-amber-400/90 hover:text-amber-300 font-semibold transition-colors"
              />
              <span className="text-stone-600">: </span>
              <span className="text-stone-300">{m.body}</span>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSend} className="flex gap-2">
        <label className="sr-only" htmlFor="clan-chat-input">
          Message the clan
        </label>
        <input
          id="clan-chat-input"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={300}
          placeholder="Speak to the clan…"
          className="flex-1 rounded-lg bg-stone-800 border border-stone-700 px-2.5 py-1.5 text-[11px] text-stone-200 placeholder:text-stone-600 focus:outline-none focus:ring-1 focus:ring-amber-600/60"
        />
        <button
          type="submit"
          disabled={sending || !body.trim()}
          className="px-3 py-1.5 rounded-lg bg-amber-600/80 hover:bg-amber-500 text-white text-[11px] font-medium transition-colors cursor-pointer disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
