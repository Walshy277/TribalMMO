import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useGame } from "../hooks/useGame";
import {
  createClan,
  depositVaultGold,
  depositVaultItem,
  disbandClan,
  fetchClanEvents,
  fetchClanVault,
  fetchMyClan,
  inviteToClan,
  joinClan,
  kickMember,
  leaveClan,
  listClans,
  listMyClanInvites,
  respondClanInvite,
  setMemberRole,
  withdrawVaultGold,
  withdrawVaultItem,
} from "../lib/clanApi";
import { isOnlineFromSeen } from "../lib/presence";
import type { Clan, ClanEvent, ClanMember, ClanRole, ClanSummary, ClanVault } from "../types";
import { PATHS } from "../lib/paths";
import { PageHeader } from "../components/ui/PageHeader";
import { Notice } from "../components/ui/Notice";
import { EmptyState } from "../components/ui/EmptyState";
import { LoadingState } from "../components/ui/LoadingState";
import { PlayerLink } from "../components/PlayerLink";
import { PresenceDot } from "../components/PresenceDot";
import { ClanChat } from "../components/ClanChat";

const CREATE_COST = 10;

const ROLE_LABEL: Record<ClanRole, string> = {
  chieftain: "Chieftain",
  elder: "Elder",
  member: "Member",
};

const ROLE_ORDER: Record<ClanRole, number> = { chieftain: 0, elder: 1, member: 2 };

function memberOnline(m: ClanMember): boolean {
  return m.is_online ?? isOnlineFromSeen(m.last_seen_at);
}

type Tab = "roster" | "vault" | "feed" | "chat";
const TABS: { id: Tab; label: string }[] = [
  { id: "roster", label: "Roster" },
  { id: "vault", label: "Vault" },
  { id: "feed", label: "Feed" },
  { id: "chat", label: "Chat" },
];

export function ClanPage() {
  const { profile, refreshProfile } = useGame();
  const [clan, setClan] = useState<Clan | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("roster");

  const load = useCallback(async () => {
    const res = await fetchMyClan();
    if (res.error) setError(res.error);
    setClan(res.data ?? null);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleChange = useCallback(async () => {
    await load();
    await refreshProfile();
  }, [load, refreshProfile]);

  if (!profile || clan === undefined) {
    return <LoadingState message="Seeking word of your tribe…" />;
  }

  if (!clan) {
    return <NoClanView error={error} onJoined={handleChange} />;
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Clan"
        subtitle="You can become powerful alone, but you cannot become important alone."
      />

      {notice ? <Notice tone="error">{notice}</Notice> : null}

      <ClanHeader clan={clan} onChange={handleChange} onError={setNotice} />

      <div className="flex gap-1 border-b border-stone-800/60">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 text-[11px] font-medium border-b-2 -mb-px transition-colors cursor-pointer ${
              tab === t.id
                ? "border-amber-500 text-amber-400"
                : "border-transparent text-stone-500 hover:text-stone-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "roster" ? (
        <RosterPanel clan={clan} onChange={handleChange} />
      ) : tab === "vault" ? (
        <VaultPanel myRole={clan.my_role} onChange={handleChange} />
      ) : tab === "feed" ? (
        <FeedPanel />
      ) : (
        <ClanChat />
      )}
    </div>
  );
}

function ClanHeader({
  clan,
  onChange,
  onError,
}: {
  clan: Clan;
  onChange: () => Promise<void>;
  onError: (msg: string | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  const myRole = clan.my_role;

  const handleLeave = async () => {
    if (!confirm("Leave the clan?")) return;
    setBusy(true);
    onError(null);
    const err = await leaveClan();
    if (err) onError(err);
    else await onChange();
    setBusy(false);
  };

  const handleDisband = async () => {
    if (!confirm("Disband the clan? This cannot be undone.")) return;
    setBusy(true);
    onError(null);
    const err = await disbandClan();
    if (err) onError(err);
    else await onChange();
    setBusy(false);
  };

  return (
    <div className="rounded-xl border border-amber-800/40 bg-amber-950/20 p-4 space-y-2">
      <div className="flex items-center gap-3">
        <span className="text-3xl" aria-hidden="true">
          {clan.banner}
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-stone-100 truncate">
            {clan.name} <span className="text-amber-500/80">[{clan.tag}]</span>
          </div>
          <div className="text-[10px] text-stone-500">
            {clan.members.length} member{clan.members.length === 1 ? "" : "s"} ·{" "}
            {clan.recruitment === "open" ? "open recruitment" : "invite only"}
          </div>
        </div>
      </div>
      {clan.philosophy ? (
        <p className="text-[11px] text-stone-400 italic leading-relaxed">"{clan.philosophy}"</p>
      ) : null}
      <div className="flex flex-wrap gap-2 pt-1">
        {myRole !== "chieftain" ? (
          <button
            type="button"
            onClick={handleLeave}
            disabled={busy}
            className="px-3 py-1.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-[11px] text-stone-200 font-medium transition-colors disabled:opacity-50 cursor-pointer"
          >
            Leave clan
          </button>
        ) : (
          <button
            type="button"
            onClick={handleDisband}
            disabled={busy}
            className="px-3 py-1.5 rounded-lg bg-red-900/40 hover:bg-red-900/60 text-[11px] text-red-300 font-medium transition-colors disabled:opacity-50 cursor-pointer"
          >
            Disband clan
          </button>
        )}
        <Link
          to={PATHS.clans}
          className="px-3 py-1.5 rounded-lg text-[11px] text-amber-500/80 hover:text-amber-400 font-medium transition-colors"
        >
          Browse clans →
        </Link>
      </div>
    </div>
  );
}

function RosterPanel({ clan, onChange }: { clan: Clan; onChange: () => Promise<void> }) {
  const [inviteName, setInviteName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const myRole = clan.my_role;
  const isChieftain = myRole === "chieftain";
  const canInvite = myRole === "chieftain" || myRole === "elder";

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = inviteName.trim();
    if (!name) return;
    setBusy("invite");
    setError(null);
    setSuccess(null);
    const err = await inviteToClan(name);
    if (err) setError(err);
    else {
      setSuccess(`Invitation sent to ${name}.`);
      setInviteName("");
    }
    setBusy(null);
  };

  const handleRole = async (characterId: string, role: Exclude<ClanRole, "chieftain">) => {
    setBusy(characterId);
    setError(null);
    const err = await setMemberRole(characterId, role);
    if (err) setError(err);
    else await onChange();
    setBusy(null);
  };

  const handleKick = async (characterId: string, name: string) => {
    if (!confirm(`Kick ${name} from the clan?`)) return;
    setBusy(characterId);
    setError(null);
    const err = await kickMember(characterId);
    if (err) setError(err);
    else await onChange();
    setBusy(null);
  };

  const sortedMembers = [...clan.members].sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);

  return (
    <div className="space-y-3">
      {error ? <Notice tone="error">{error}</Notice> : null}
      {success ? <Notice tone="success">{success}</Notice> : null}

      {canInvite ? (
        <form
          onSubmit={handleInvite}
          className="rounded-xl border border-stone-800/60 bg-stone-900/60 p-3 flex gap-2"
        >
          <input
            value={inviteName}
            onChange={(e) => setInviteName(e.target.value)}
            placeholder="Invite by name…"
            className="flex-1 rounded-lg bg-stone-800 border border-stone-700 px-2.5 py-1.5 text-[11px] text-stone-200 placeholder:text-stone-600 focus:outline-none focus:ring-1 focus:ring-amber-600/60"
          />
          <button
            type="submit"
            disabled={busy === "invite" || !inviteName.trim()}
            className="px-3 py-1.5 rounded-lg bg-amber-600/80 hover:bg-amber-500 text-white text-[11px] font-medium transition-colors disabled:opacity-50 cursor-pointer"
          >
            Invite
          </button>
        </form>
      ) : null}

      <div className="space-y-1.5">
        {sortedMembers.map((m) => (
          <div
            key={m.character_id}
            className="rounded-xl border border-stone-800/40 bg-stone-900/40 p-2.5 flex items-center gap-2.5"
          >
            <PresenceDot online={memberOnline(m)} />
            <PlayerLink
              name={m.display_name}
              className="text-xs font-semibold text-stone-200 hover:text-amber-300 transition-colors flex-1 min-w-0 truncate"
            />
            <span className="text-[10px] text-amber-500/80 shrink-0">{ROLE_LABEL[m.role]}</span>
            {isChieftain && m.role !== "chieftain" ? (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={busy === m.character_id}
                  onClick={() => handleRole(m.character_id, m.role === "elder" ? "member" : "elder")}
                  className="text-[10px] text-stone-400 hover:text-amber-400 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {m.role === "elder" ? "demote" : "promote"}
                </button>
                <button
                  type="button"
                  disabled={busy === m.character_id}
                  onClick={() => handleKick(m.character_id, m.display_name)}
                  className="text-[10px] text-red-400/80 hover:text-red-400 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  kick
                </button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function VaultPanel({
  myRole,
  onChange,
}: {
  myRole: ClanRole | null | undefined;
  onChange: () => Promise<void>;
}) {
  const { profile } = useGame();
  const [vault, setVault] = useState<ClanVault | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [depositGold, setDepositGold] = useState(0);
  const [withdrawGold, setWithdrawGold] = useState(0);
  const [depositItemId, setDepositItemId] = useState<number | "">("");
  const [depositQty, setDepositQty] = useState(1);
  const [withdrawQtys, setWithdrawQtys] = useState<Record<number, number>>({});

  const load = useCallback(async () => {
    const res = await fetchClanVault();
    if (res.error) setError(res.error);
    setVault(res.data ?? { gold: 0, items: [] });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const canManage = myRole === "chieftain" || myRole === "elder";
  const depositable = (profile?.inventory ?? []).filter((i) => i.item_type !== "trophy");

  const run = useCallback(
    async (fn: () => Promise<string | null>) => {
      setBusy(true);
      setError(null);
      const err = await fn();
      if (err) {
        setError(err);
      } else {
        setDepositGold(0);
        setWithdrawGold(0);
        setDepositQty(1);
        setDepositItemId("");
        await load();
        await onChange();
      }
      setBusy(false);
    },
    [load, onChange],
  );

  if (!vault) {
    return <LoadingState message="Counting the vault's stock…" className="min-h-0 py-8" />;
  }

  return (
    <div className="space-y-3">
      {error ? <Notice tone="error">{error}</Notice> : null}

      <div className="rounded-xl border border-amber-800/40 bg-amber-950/20 p-3 flex items-center justify-between">
        <span className="text-[10px] font-semibold text-stone-500 uppercase tracking-widest">
          Vault Gold
        </span>
        <span className="text-amber-400 text-sm font-bold">◆ {vault.gold.toLocaleString()}</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div className="rounded-xl border border-stone-800/60 bg-stone-900/60 p-3 space-y-2">
          <div className="text-[10px] font-semibold text-stone-500 uppercase tracking-widest">
            Deposit gold
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              max={profile?.gold ?? 0}
              value={depositGold}
              onChange={(e) => setDepositGold(Math.max(0, Math.floor(Number(e.target.value)) || 0))}
              className="w-full rounded-lg bg-stone-800 border border-stone-700 px-2 py-1 text-[11px] text-stone-200 font-mono"
            />
            <button
              type="button"
              disabled={busy || depositGold <= 0}
              onClick={() => run(() => depositVaultGold(depositGold))}
              className="px-3 py-1 rounded-lg bg-amber-600/80 hover:bg-amber-500 text-white text-[11px] font-medium transition-colors disabled:opacity-50 cursor-pointer shrink-0"
            >
              Deposit
            </button>
          </div>
        </div>

        {canManage ? (
          <div className="rounded-xl border border-stone-800/60 bg-stone-900/60 p-3 space-y-2">
            <div className="text-[10px] font-semibold text-stone-500 uppercase tracking-widest">
              Withdraw gold
            </div>
            <div className="flex gap-2">
              <input
                type="number"
                min={1}
                max={vault.gold}
                value={withdrawGold}
                onChange={(e) => setWithdrawGold(Math.max(0, Math.floor(Number(e.target.value)) || 0))}
                className="w-full rounded-lg bg-stone-800 border border-stone-700 px-2 py-1 text-[11px] text-stone-200 font-mono"
              />
              <button
                type="button"
                disabled={busy || withdrawGold <= 0}
                onClick={() => run(() => withdrawVaultGold(withdrawGold))}
                className="px-3 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-[11px] font-medium transition-colors disabled:opacity-50 cursor-pointer shrink-0"
              >
                Withdraw
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-stone-800/60 bg-stone-900/60 p-3 space-y-2">
        <div className="text-[10px] font-semibold text-stone-500 uppercase tracking-widest">
          Deposit item
        </div>
        {depositable.length === 0 ? (
          <p className="text-[11px] text-stone-600">Nothing in your pack worth storing.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <select
              value={depositItemId}
              onChange={(e) => setDepositItemId(e.target.value ? Number(e.target.value) : "")}
              className="rounded-lg bg-stone-800 border border-stone-700 px-2 py-1 text-[11px] text-stone-200 cursor-pointer"
            >
              <option value="">choose item...</option>
              {depositable.map((i) => (
                <option key={i.item_id} value={i.item_id}>
                  {i.icon} {i.name} (×{i.quantity})
                </option>
              ))}
            </select>
            <input
              type="number"
              min={1}
              value={depositQty}
              onChange={(e) => setDepositQty(Math.max(1, Math.floor(Number(e.target.value)) || 1))}
              className="w-16 rounded-lg bg-stone-800 border border-stone-700 px-2 py-1 text-[11px] text-stone-200 font-mono"
            />
            <button
              type="button"
              disabled={busy || !depositItemId}
              onClick={() => depositItemId && run(() => depositVaultItem(depositItemId, depositQty))}
              className="px-3 py-1 rounded-lg bg-amber-600/80 hover:bg-amber-500 text-white text-[11px] font-medium transition-colors disabled:opacity-50 cursor-pointer"
            >
              Deposit
            </button>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-[10px] font-semibold text-stone-500 uppercase tracking-widest mb-1.5">
          Stored goods
        </h3>
        {vault.items.length === 0 ? (
          <EmptyState icon="📦" title="Vault is empty" description="No goods stored by the tribe yet." />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {vault.items.map((item) => (
              <div
                key={item.item_id}
                className="rounded-xl border border-stone-800/30 bg-stone-900/30 p-2 flex flex-col items-center gap-1 text-center"
              >
                <span className="text-xl" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="text-[11px] text-stone-200 font-semibold truncate w-full">
                  {item.name}
                </span>
                <span className="text-[10px] text-stone-500">×{item.quantity}</span>
                {canManage ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min={1}
                      max={item.quantity}
                      value={withdrawQtys[item.item_id] ?? 1}
                      onChange={(e) =>
                        setWithdrawQtys((q) => ({
                          ...q,
                          [item.item_id]: Math.max(
                            1,
                            Math.min(item.quantity, Math.floor(Number(e.target.value)) || 1),
                          ),
                        }))
                      }
                      className="w-12 rounded bg-stone-800 border border-stone-700 px-1 py-0.5 text-[10px] text-stone-200 font-mono text-center"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        run(() => withdrawVaultItem(item.item_id, withdrawQtys[item.item_id] ?? 1))
                      }
                      className="text-[10px] text-amber-500/90 hover:text-amber-400 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      take
                    </button>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FeedPanel() {
  const [events, setEvents] = useState<ClanEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchClanEvents().then((res) => {
      if (res.error) setError(res.error);
      setEvents(res.data ?? []);
    });
  }, []);

  if (events === null) {
    return <LoadingState message="Recalling the tribe's deeds…" className="min-h-0 py-8" />;
  }

  return (
    <div className="space-y-2">
      {error ? <Notice tone="error">{error}</Notice> : null}
      {events.length === 0 ? (
        <EmptyState icon="📜" title="No deeds recorded" description="The clan's saga has yet to begin." />
      ) : (
        events.map((e) => (
          <div key={e.id} className="rounded-xl border border-stone-800/40 bg-stone-900/40 p-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-stone-300">
                {e.actor_name ? (
                  <>
                    <PlayerLink
                      name={e.actor_name}
                      className="text-amber-400/90 hover:text-amber-300 font-medium transition-colors"
                    />{" "}
                  </>
                ) : null}
                {e.message}
              </span>
              <span className="text-[10px] text-stone-600 shrink-0">
                {new Date(e.created_at).toLocaleString()}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function NoClanView({
  error,
  onJoined,
}: {
  error: string | null;
  onJoined: () => Promise<void>;
}) {
  const { profile } = useGame();
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [philosophy, setPhilosophy] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [openClans, setOpenClans] = useState<ClanSummary[] | null>(null);
  const [invites, setInvites] = useState<
    {
      id: number;
      clan_name: string;
      clan_tag: string;
      clan_banner: string;
      inviter_name: string | null;
    }[] | null
  >(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [inviteBusy, setInviteBusy] = useState<number | null>(null);

  useEffect(() => {
    listClans().then((res) => {
      if (res.data) setOpenClans(res.data.filter((c) => c.recruitment === "open"));
      else setOpenClans([]);
    });
    listMyClanInvites().then((res) => {
      setInvites(res.data ?? []);
    });
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setFormError(null);
    const res = await createClan({
      name: name.trim(),
      tag: tag.trim(),
      philosophy: philosophy.trim() || undefined,
    });
    if (res.error) setFormError(res.error);
    else await onJoined();
    setBusy(false);
  };

  const handleJoin = async (clanId: string) => {
    setJoiningId(clanId);
    setFormError(null);
    const err = await joinClan(clanId);
    if (err) setFormError(err);
    else await onJoined();
    setJoiningId(null);
  };

  const handleInviteRespond = async (inviteId: number, accept: boolean) => {
    setInviteBusy(inviteId);
    setFormError(null);
    const err = await respondClanInvite(inviteId, accept);
    if (err) setFormError(err);
    else if (accept) await onJoined();
    else setInvites((prev) => (prev ?? []).filter((i) => i.id !== inviteId));
    setInviteBusy(null);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Clan"
        subtitle="You can become powerful alone, but you cannot become important alone."
      />

      {error ? <Notice tone="error">{error}</Notice> : null}
      {formError ? <Notice tone="error">{formError}</Notice> : null}

      {invites && invites.length > 0 ? (
        <div className="rounded-xl border border-stone-700/50 bg-stone-900/60 p-3 space-y-2">
          <div className="text-[10px] font-semibold text-stone-500 uppercase tracking-widest">
            Pending invitations
          </div>
          {invites.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center gap-2 rounded-lg border border-stone-800/50 bg-stone-950/40 p-2"
            >
              <span className="text-lg" aria-hidden="true">
                {inv.clan_banner}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-stone-200 truncate">
                  {inv.clan_name} <span className="text-amber-500/80">[{inv.clan_tag}]</span>
                </div>
                <div className="text-[10px] text-stone-500">
                  from{" "}
                  <PlayerLink
                    name={inv.inviter_name}
                    className="text-amber-400/80 hover:text-amber-300"
                  />
                </div>
              </div>
              <button
                type="button"
                disabled={inviteBusy === inv.id}
                onClick={() => handleInviteRespond(inv.id, true)}
                className="px-2 py-1 rounded-lg bg-amber-600/80 hover:bg-amber-500 text-white text-[10px] font-medium disabled:opacity-50 cursor-pointer"
              >
                Accept
              </button>
              <button
                type="button"
                disabled={inviteBusy === inv.id}
                onClick={() => handleInviteRespond(inv.id, false)}
                className="px-2 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-[10px] font-medium disabled:opacity-50 cursor-pointer"
              >
                Decline
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="rounded-xl border border-amber-800/40 bg-amber-950/20 p-4 space-y-3">
        <div className="text-2xl" aria-hidden="true">
          🏕️
        </div>
        <div>
          <div className="text-sm font-semibold text-stone-100">Found a clan</div>
          <p className="text-[11px] text-stone-500 mt-0.5">
            Costs ◆ {CREATE_COST} gold. You'll become its chieftain.
          </p>
        </div>
        <form onSubmit={handleCreate} className="space-y-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Clan name"
            maxLength={32}
            required
            className="w-full rounded-lg bg-stone-800 border border-stone-700 px-2.5 py-1.5 text-[11px] text-stone-200 placeholder:text-stone-600 focus:outline-none focus:ring-1 focus:ring-amber-600/60"
          />
          <input
            value={tag}
            onChange={(e) => setTag(e.target.value.toUpperCase())}
            placeholder="Tag (e.g. WLF)"
            maxLength={5}
            required
            className="w-full rounded-lg bg-stone-800 border border-stone-700 px-2.5 py-1.5 text-[11px] text-stone-200 uppercase placeholder:text-stone-600 focus:outline-none focus:ring-1 focus:ring-amber-600/60"
          />
          <textarea
            value={philosophy}
            onChange={(e) => setPhilosophy(e.target.value)}
            placeholder="Philosophy (optional)"
            maxLength={200}
            rows={2}
            className="w-full rounded-lg bg-stone-800 border border-stone-700 px-2.5 py-1.5 text-[11px] text-stone-200 placeholder:text-stone-600 resize-none focus:outline-none focus:ring-1 focus:ring-amber-600/60"
          />
          <button
            type="submit"
            disabled={busy || !name.trim() || !tag.trim() || (profile?.gold ?? 0) < CREATE_COST}
            className="px-3 py-1.5 rounded-lg bg-amber-600/80 hover:bg-amber-500 text-white text-[11px] font-medium transition-colors disabled:opacity-50 cursor-pointer"
          >
            {busy ? "Founding…" : `Found clan (◆ ${CREATE_COST})`}
          </button>
        </form>
        <Link
          to={PATHS.clans}
          className="block text-[11px] text-amber-500/80 hover:text-amber-400 font-medium transition-colors"
        >
          Browse the clan directory →
        </Link>
      </div>

      <div>
        <h3 className="text-[10px] font-semibold text-stone-500 uppercase tracking-widest mb-1.5">
          Open clans seeking members
        </h3>
        {openClans === null ? (
          <LoadingState message="Scouting open camps…" className="min-h-0 py-6" />
        ) : openClans.length === 0 ? (
          <p className="text-[11px] text-stone-600">No clans are recruiting right now.</p>
        ) : (
          <div className="space-y-1.5">
            {openClans.map((c) => (
              <div
                key={c.id}
                className="rounded-xl border border-stone-800/60 bg-stone-900/60 p-2.5 flex items-center gap-2.5"
              >
                <span className="text-xl" aria-hidden="true">
                  {c.banner}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-stone-200 truncate">
                    {c.name} <span className="text-amber-500/80">[{c.tag}]</span>
                  </div>
                  <div className="text-[10px] text-stone-500">
                    {c.member_count} member{c.member_count === 1 ? "" : "s"}
                    {c.chieftain_name ? ` · led by ${c.chieftain_name}` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  disabled={joiningId === c.id}
                  onClick={() => handleJoin(c.id)}
                  className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-600/80 hover:bg-amber-500 text-white text-[11px] font-medium transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {joiningId === c.id ? "..." : "Join"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
