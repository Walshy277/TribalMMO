import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useGame } from "../hooks/useGame";
import { sendMail } from "../lib/socialApi";
import type { MailItem } from "../types";
import { STORES } from "../data/gameData";
import { PATHS } from "../lib/paths";
import { Notice } from "../components/ui/Notice";
import { EmptyState } from "../components/ui/EmptyState";
import { LoadingState } from "../components/ui/LoadingState";
import { PlayerLink } from "../components/PlayerLink";

export function PostOfficePage() {
  const { profile, claimMail, fetchMail } = useGame();
  const [mail, setMail] = useState<MailItem[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [recipient, setRecipient] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [composeNotice, setComposeNotice] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  const store = STORES.find((s) => s.id === "post");

  const load = useCallback(() => {
    fetchMail().then((res) => {
      setMail(res.data);
      if (res.error) setNotice(res.error);
    });
  }, [fetchMail]);

  useEffect(() => {
    load();
  }, [load]);

  if (!profile || !store) return null;

  const handleClaim = async (mailId: number) => {
    setBusy(mailId);
    setNotice(null);
    const err = await claimMail(mailId);
    if (err) setNotice(err);
    setBusy(null);
    load();
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const to = recipient.trim();
    const subj = subject.trim();
    if (!to || !subj) return;
    setSending(true);
    setComposeNotice(null);
    const err = await sendMail(to, subj, body.trim());
    if (err) {
      setComposeNotice({ tone: "error", text: err });
    } else {
      setComposeNotice({ tone: "success", text: `Letter sent to ${to}.` });
      setRecipient("");
      setSubject("");
      setBody("");
    }
    setSending(false);
  };

  const unread = mail ? mail.filter((m) => !m.claimed_at).length : 0;

  return (
    <div className="space-y-4">
      <div>
        <Link to={PATHS.village} className="text-[10px] text-stone-500 hover:text-amber-400">
          ← back to the village
        </Link>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-2xl">{store.icon}</span>
          <div>
            <h2 className="text-sm font-bold text-stone-100">{store.name}</h2>
            <p className="text-[11px] text-stone-500">{store.tagline}</p>
          </div>
        </div>
        <p className="text-[11px] text-stone-600 mt-1.5">
          "{store.desc}" — <span className="text-stone-500">{store.keeper}</span>
        </p>
        {notice ? (
          <div className="mt-2">
            <Notice tone="error">{notice}</Notice>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-stone-800/60 bg-stone-900/60 p-3 space-y-2">
        <h3 className="text-[10px] font-semibold text-stone-500 uppercase tracking-widest">
          Send a letter
        </h3>
        {composeNotice ? <Notice tone={composeNotice.tone}>{composeNotice.text}</Notice> : null}
        <form onSubmit={handleSend} className="space-y-2">
          <input
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="Recipient name"
            maxLength={32}
            required
            className="w-full rounded-lg bg-stone-800 border border-stone-700 px-2.5 py-1.5 text-[11px] text-stone-200 placeholder:text-stone-600 focus:outline-none focus:ring-1 focus:ring-amber-600/60"
          />
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            maxLength={64}
            required
            className="w-full rounded-lg bg-stone-800 border border-stone-700 px-2.5 py-1.5 text-[11px] text-stone-200 placeholder:text-stone-600 focus:outline-none focus:ring-1 focus:ring-amber-600/60"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Message (optional)"
            maxLength={500}
            rows={3}
            className="w-full rounded-lg bg-stone-800 border border-stone-700 px-2.5 py-1.5 text-[11px] text-stone-200 placeholder:text-stone-600 resize-none focus:outline-none focus:ring-1 focus:ring-amber-600/60"
          />
          <button
            type="submit"
            disabled={sending || !recipient.trim() || !subject.trim()}
            className="px-3 py-1.5 rounded-lg bg-amber-600/80 hover:bg-amber-500 text-white text-[11px] font-medium transition-colors disabled:opacity-50 cursor-pointer"
          >
            {sending ? "Sending…" : "Send letter"}
          </button>
        </form>
      </div>

      {mail === null ? (
        <LoadingState
          message="The postmistress is sorting the day's letters…"
          className="min-h-0 py-8"
        />
      ) : mail.length === 0 ? (
        <EmptyState
          icon="✉️"
          title="No letters today"
          description="The ravens return from the east with nothing."
        />
      ) : (
        <div className="space-y-2">
          {unread > 0 && (
            <div className="text-[10px] text-stone-500">{unread} unread letter{unread > 1 ? "s" : ""}</div>
          )}
          {mail.map((letter) => {
            const claimed = !!letter.claimed_at;
            return (
              <div
                key={letter.id}
                className={`rounded-xl border p-3 ${
                  claimed
                    ? "border-stone-800/30 bg-stone-900/20 opacity-70"
                    : "border-stone-700/50 bg-stone-900/60"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-stone-200">
                    {claimed ? "✉️" : "📩"} {letter.subject}
                  </div>
                  <span className="text-[10px] text-stone-600 shrink-0">
                    <PlayerLink
                      name={letter.sender}
                      className="text-stone-500 hover:text-amber-400 transition-colors"
                    />
                  </span>
                </div>
                {letter.body && (
                  <p className="text-[11px] text-stone-400 mt-1.5 leading-relaxed">
                    {letter.body}
                  </p>
                )}
                {(letter.gold > 0 || (letter.item_id && letter.item_qty > 0)) && (
                  <div className="flex flex-wrap items-center gap-2 mt-2">
                    {letter.gold > 0 && (
                      <span className="text-[10px] text-amber-400 font-mono">
                        ◆ {letter.gold.toLocaleString()}
                      </span>
                    )}
                    {letter.item_id && letter.item_qty > 0 && (
                      <span className="text-[10px] text-stone-300">
                        {letter.item_icon} {letter.item_name} ×{letter.item_qty}
                      </span>
                    )}
                  </div>
                )}
                {claimed ? (
                  <div className="text-[10px] text-stone-600 mt-2">claimed</div>
                ) : (
                  <button
                    onClick={() => handleClaim(letter.id)}
                    disabled={busy === letter.id}
                    className="mt-2 px-2.5 py-1 rounded-lg text-[10px] font-medium bg-amber-600/80 hover:bg-amber-500 text-white transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {busy === letter.id ? "..." : "open parcel"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
