import { supabase } from "./supabase";
import type { NoticeItem, OnlinePlayer } from "../types";

interface ApiResult<T> {
  data: T | null;
  error: string | null;
}

export async function setBio(bio: string): Promise<string | null> {
  const { error } = await supabase.rpc("set_bio", { p_bio: bio });
  return error?.message ?? null;
}

export async function sendMail(
  recipientName: string,
  subject: string,
  body: string,
): Promise<string | null> {
  const { error } = await supabase.rpc("send_mail", {
    p_recipient_name: recipientName,
    p_subject: subject,
    p_body: body,
  });
  return error?.message ?? null;
}

export async function fetchNotices(limit = 30): Promise<ApiResult<NoticeItem[]>> {
  const { data, error } = await supabase.rpc("list_notices", { p_limit: limit });
  return {
    data: (data as NoticeItem[] | null) ?? null,
    error: error?.message ?? null,
  };
}

export async function fetchOnlinePlayers(limit = 20): Promise<ApiResult<OnlinePlayer[]>> {
  const { data, error } = await supabase.rpc("list_online_players", { p_limit: limit });
  return {
    data: (data as OnlinePlayer[] | null) ?? null,
    error: error?.message ?? null,
  };
}
