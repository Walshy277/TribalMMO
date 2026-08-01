import { supabase } from "./supabase";
import type {
  Clan,
  ClanEvent,
  ClanMessage,
  ClanRole,
  ClanSummary,
  ClanVault,
} from "../types";

interface ApiResult<T> {
  data: T | null;
  error: string | null;
}

export async function fetchMyClan(): Promise<ApiResult<Clan | null>> {
  const { data, error } = await supabase.rpc("get_my_clan");
  if (error) return { data: null, error: error.message };
  return { data: (data as Clan | null) ?? null, error: null };
}

export async function fetchClan(clanId: string): Promise<ApiResult<Clan>> {
  const { data, error } = await supabase.rpc("get_clan", { p_clan_id: clanId });
  return { data: (data as Clan | null) ?? null, error: error?.message ?? null };
}

export async function listClans(limit = 30): Promise<ApiResult<ClanSummary[]>> {
  const { data, error } = await supabase.rpc("list_clans", { p_limit: limit });
  return {
    data: (data as ClanSummary[] | null) ?? null,
    error: error?.message ?? null,
  };
}

export async function createClan(input: {
  name: string;
  tag: string;
  philosophy?: string;
  banner?: string;
}): Promise<ApiResult<Clan>> {
  const { data, error } = await supabase.rpc("create_clan", {
    p_name: input.name,
    p_tag: input.tag,
    p_philosophy: input.philosophy ?? null,
    p_banner: input.banner ?? "🏕️",
  });
  return { data: (data as Clan | null) ?? null, error: error?.message ?? null };
}

export async function disbandClan(): Promise<string | null> {
  const { error } = await supabase.rpc("disband_clan");
  return error?.message ?? null;
}

export async function joinClan(clanId: string): Promise<string | null> {
  const { error } = await supabase.rpc("join_clan", { p_clan_id: clanId });
  return error?.message ?? null;
}

export async function leaveClan(): Promise<string | null> {
  const { error } = await supabase.rpc("leave_clan");
  return error?.message ?? null;
}

export async function inviteToClan(name: string): Promise<string | null> {
  const { error } = await supabase.rpc("invite_to_clan", { p_name: name });
  return error?.message ?? null;
}

export async function listMyClanInvites(): Promise<
  ApiResult<
    {
      id: number;
      clan_id: string;
      clan_name: string;
      clan_tag: string;
      clan_banner: string;
      inviter_id: string;
      inviter_name: string | null;
      created_at: string;
      expires_at: string;
    }[]
  >
> {
  const { data, error } = await supabase.rpc("list_my_clan_invites");
  return { data: (data as never) ?? null, error: error?.message ?? null };
}

export async function respondClanInvite(
  inviteId: number,
  accept: boolean,
): Promise<string | null> {
  const { error } = await supabase.rpc("respond_clan_invite", {
    p_invite_id: inviteId,
    p_accept: accept,
  });
  return error?.message ?? null;
}

export async function kickMember(characterId: string): Promise<string | null> {
  const { error } = await supabase.rpc("kick_member", {
    p_character_id: characterId,
  });
  return error?.message ?? null;
}

export async function setMemberRole(
  characterId: string,
  role: Exclude<ClanRole, "chieftain">,
): Promise<string | null> {
  const { error } = await supabase.rpc("set_member_role", {
    p_character_id: characterId,
    p_role: role,
  });
  return error?.message ?? null;
}

export async function fetchClanVault(): Promise<ApiResult<ClanVault>> {
  const { data, error } = await supabase.rpc("get_clan_vault");
  return { data: (data as ClanVault | null) ?? null, error: error?.message ?? null };
}

export async function depositVaultGold(amount: number): Promise<string | null> {
  const { error } = await supabase.rpc("clan_vault_deposit_gold", { p_amount: amount });
  return error?.message ?? null;
}

export async function withdrawVaultGold(amount: number): Promise<string | null> {
  const { error } = await supabase.rpc("clan_vault_withdraw_gold", { p_amount: amount });
  return error?.message ?? null;
}

export async function depositVaultItem(
  itemId: number,
  quantity: number,
): Promise<string | null> {
  const { error } = await supabase.rpc("clan_vault_deposit_item", {
    p_item_id: itemId,
    p_quantity: quantity,
  });
  return error?.message ?? null;
}

export async function withdrawVaultItem(
  itemId: number,
  quantity: number,
): Promise<string | null> {
  const { error } = await supabase.rpc("clan_vault_withdraw_item", {
    p_item_id: itemId,
    p_quantity: quantity,
  });
  return error?.message ?? null;
}

export async function fetchClanEvents(limit = 40): Promise<ApiResult<ClanEvent[]>> {
  const { data, error } = await supabase.rpc("list_clan_events", { p_limit: limit });
  return {
    data: (data as ClanEvent[] | null) ?? null,
    error: error?.message ?? null,
  };
}

export async function fetchClanMessages(
  beforeId?: number | null,
  limit = 50,
): Promise<ApiResult<ClanMessage[]>> {
  const { data, error } = await supabase.rpc("list_clan_messages", {
    p_before_id: beforeId ?? null,
    p_limit: limit,
  });
  return {
    data: (data as ClanMessage[] | null) ?? null,
    error: error?.message ?? null,
  };
}

export async function sendClanMessage(body: string): Promise<string | null> {
  const { error } = await supabase.rpc("send_clan_message", { p_body: body });
  return error?.message ?? null;
}
