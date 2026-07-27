export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      characters: {
        Row: {
          id: string
          user_id: string
          name: string
          background: string
          title: string
          bio: string
          avatar_url: string
          profile_color: string
          strength: number
          agility: number
          endurance: number
          focus: number
          cunning: number
          stamina: number
          max_stamina: number
          gold: number
          stamina_updated_at: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          background?: string
          title?: string
          bio?: string
          avatar_url?: string
          profile_color?: string
          strength?: number
          agility?: number
          endurance?: number
          focus?: number
          cunning?: number
          stamina?: number
          max_stamina?: number
          gold?: number
          stamina_updated_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          background?: string
          title?: string
          bio?: string
          avatar_url?: string
          profile_color?: string
          strength?: number
          agility?: number
          endurance?: number
          focus?: number
          cunning?: number
          stamina?: number
          max_stamina?: number
          gold?: number
          stamina_updated_at?: string
          created_at?: string
        }
        Relationships: []
      }
      skills: {
        Row: {
          id: string
          character_id: string
          name: string
          tier: number
          experience: number
          specialization: string | null
        }
        Insert: {
          id?: string
          character_id: string
          name: string
          tier?: number
          experience?: number
          specialization?: string | null
        }
        Update: {
          id?: string
          character_id?: string
          name?: string
          tier?: number
          experience?: number
          specialization?: string | null
        }
        Relationships: []
      }
      items: {
        Row: {
          id: string
          name: string
          type: string
          tier: number
          stats: Json
          recipe_id: string | null
        }
        Insert: {
          id?: string
          name: string
          type: string
          tier?: number
          stats?: Json
          recipe_id?: string | null
        }
        Update: {
          id?: string
          name?: string
          type?: string
          tier?: number
          stats?: Json
          recipe_id?: string | null
        }
        Relationships: []
      }
      inventory: {
        Row: {
          id: string
          character_id: string
          item_id: string
          quantity: number
          equipped: boolean
        }
        Insert: {
          id?: string
          character_id: string
          item_id: string
          quantity?: number
          equipped?: boolean
        }
        Update: {
          id?: string
          character_id?: string
          item_id?: string
          quantity?: number
          equipped?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          username: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          username?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          username?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      clans: {
        Row: {
          id: string
          name: string
          symbol: string
          philosophy: string
          founder_id: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          symbol: string
          philosophy: string
          founder_id: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          symbol?: string
          philosophy?: string
          founder_id?: string
          created_at?: string
        }
        Relationships: []
      }
      clan_members: {
        Row: {
          id: string
          clan_id: string
          character_id: string
          role: string
          joined_at: string
        }
        Insert: {
          id?: string
          clan_id: string
          character_id: string
          role?: string
          joined_at?: string
        }
        Update: {
          id?: string
          clan_id?: string
          character_id?: string
          role?: string
          joined_at?: string
        }
        Relationships: []
      }
      actions: {
        Row: {
          id: string
          character_id: string
          type: string
          duration: number
          started_at: string
          completes_at: string
          result: Json | null
        }
        Insert: {
          id?: string
          character_id: string
          type: string
          duration: number
          started_at?: string
          completes_at: string
          result?: Json | null
        }
        Update: {
          id?: string
          character_id?: string
          type?: string
          duration?: number
          started_at?: string
          completes_at?: string
          result?: Json | null
        }
        Relationships: []
      }
      marketplace_listings: {
        Row: {
          id: string
          seller_id: string
          item_id: string
          quantity: number
          price: number
          created_at: string
        }
        Insert: {
          id?: string
          seller_id: string
          item_id: string
          quantity?: number
          price: number
          created_at?: string
        }
        Update: {
          id?: string
          seller_id?: string
          item_id?: string
          quantity?: number
          price?: number
          created_at?: string
        }
        Relationships: []
      }
      auction_house: {
        Row: {
          id: string
          seller_id: string
          item_id: string
          quantity: number
          starting_price: number
          current_bid: number
          current_bidder_id: string | null
          ends_at: string
          created_at: string
          claimed: boolean
        }
        Insert: {
          id?: string
          seller_id: string
          item_id: string
          quantity?: number
          starting_price: number
          current_bid?: number
          current_bidder_id?: string | null
          ends_at: string
          created_at?: string
          claimed?: boolean
        }
        Update: {
          id?: string
          seller_id?: string
          item_id?: string
          quantity?: number
          starting_price?: number
          current_bid?: number
          current_bidder_id?: string | null
          ends_at?: string
          created_at?: string
          claimed?: boolean
        }
        Relationships: []
      }
      pets: {
        Row: {
          id: string
          character_id: string
          type: string
          name: string
          equipped: boolean
        }
        Insert: {
          id?: string
          character_id: string
          type: string
          name: string
          equipped?: boolean
        }
        Update: {
          id?: string
          character_id?: string
          type?: string
          name?: string
          equipped?: boolean
        }
        Relationships: []
      }
      shrine_donations: {
        Row: {
          id: string
          character_id: string
          item_id: string
          quantity: number
          donated_at: string
        }
        Insert: {
          id?: string
          character_id: string
          item_id: string
          quantity?: number
          donated_at?: string
        }
        Update: {
          id?: string
          character_id?: string
          item_id?: string
          quantity?: number
          donated_at?: string
        }
        Relationships: []
      }
      shrine_prayers: {
        Row: {
          id: string
          character_id: string
          message: string
          blessing: string | null
          prayed_at: string
        }
        Insert: {
          id?: string
          character_id: string
          message: string
          blessing?: string | null
          prayed_at?: string
        }
        Update: {
          id?: string
          character_id?: string
          message?: string
          blessing?: string | null
          prayed_at?: string
        }
        Relationships: []
      }
      shop_items: {
        Row: {
          id: string
          name: string
          type: string
          tier: number
          description: string | null
          buy_price: number
          sell_price: number
          stock: number
          stats: Json
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          type: string
          tier?: number
          description?: string | null
          buy_price: number
          sell_price: number
          stock?: number
          stats?: Json
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          type?: string
          tier?: number
          description?: string | null
          buy_price?: number
          sell_price?: number
          stock?: number
          stats?: Json
          created_at?: string
        }
        Relationships: []
      }
      daily_rewards: {
        Row: {
          id: string
          character_id: string
          last_claimed_at: string
          streak: number
          created_at: string
        }
        Insert: {
          id?: string
          character_id: string
          last_claimed_at: string
          streak?: number
          created_at?: string
        }
        Update: {
          id?: string
          character_id?: string
          last_claimed_at?: string
          streak?: number
          created_at?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          id: string
          character_id: string
          type: string
          amount: number
          description: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          character_id: string
          type: string
          amount: number
          description?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          character_id?: string
          type?: string
          amount?: number
          description?: string | null
          metadata?: Json
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      gather_resource: {
        Args: { p_character_id: string; p_action: string }
        Returns: Json
      }
      purchase_listing: {
        Args: { p_listing_id: string; p_buyer_id: string; p_seller_id: string; p_price: number }
        Returns: void
      }
      refund_bidder: {
        Args: { p_bidder_id: string; p_amount: number }
        Returns: void
      }
      auction_payout: {
        Args: { p_seller_id: string; p_total_bid: number }
        Returns: void
      }
      shrine_bless: {
        Args: { p_character_id: string }
        Returns: string
      }
      deduct_stamina: {
        Args: { p_character_id: string; p_amount: number }
        Returns: void
      }
      rest_character: {
        Args: { p_character_id: string; p_amount: number }
        Returns: void
      }
      resolve_combat_win: {
        Args: { p_character_id: string; p_xp_reward: number }
        Returns: void
      }
      resolve_combat_loss: {
        Args: { p_character_id: string; p_stamina_cost: number }
        Returns: void
      }
      explore_step: {
        Args: { p_character_id: string }
        Returns: Json
      }
      start_action: {
        Args: { p_character_id: string; p_type: string; p_duration: number; p_skill_name: string; p_stamina_cost: number; p_result?: Json }
        Returns: void
      }
      complete_action: {
        Args: { p_character_id: string; p_action_id: string }
        Returns: Json
      }
      craft_item: {
        Args: { p_character_id: string; p_item_name: string; p_item_type: string; p_item_tier: number; p_item_stats: Json; p_duration: number; p_materials: Json }
        Returns: void
      }
      shop_buy: {
        Args: { p_character_id: string; p_item_name: string; p_item_type: string; p_item_tier: number; p_item_stats: Json; p_total_cost: number; p_quantity: number }
        Returns: void
      }
      shop_sell: {
        Args: { p_character_id: string; p_inventory_id: string; p_quantity: number; p_total_value: number; p_item_name: string }
        Returns: void
      }
      create_listing: {
        Args: { p_character_id: string; p_item_id: string; p_quantity: number; p_price: number }
        Returns: void
      }
      cancel_listing: {
        Args: { p_character_id: string; p_listing_id: string }
        Returns: void
      }
      create_auction: {
        Args: { p_character_id: string; p_item_id: string; p_quantity: number; p_starting_price: number; p_duration_seconds: number }
        Returns: void
      }
      claim_auction: {
        Args: { p_character_id: string; p_auction_id: string }
        Returns: string
      }
      shrine_donate: {
        Args: { p_character_id: string; p_inventory_id: string; p_quantity: number }
        Returns: number
      }
      shrine_pray: {
        Args: { p_character_id: string; p_message: string }
        Returns: Json
      }
      claim_daily_reward: {
        Args: { p_character_id: string }
        Returns: Json
      }
      create_clan_rpc: {
        Args: { p_character_id: string; p_name: string; p_philosophy: string }
        Returns: void
      }
      use_consumable: {
        Args: { p_character_id: string; p_inventory_id: string }
        Returns: void
      }
      equip_pet: {
        Args: { p_character_id: string; p_pet_id: string }
        Returns: void
      }
      unequip_pet: {
        Args: { p_character_id: string; p_pet_id: string }
        Returns: void
      }
      buy_pet: {
        Args: { p_character_id: string; p_pet_type: string; p_pet_name: string; p_cost: number }
        Returns: Json
      }
      update_profile: {
        Args: { p_character_id: string; p_title?: string; p_bio?: string; p_avatar_url?: string; p_profile_color?: string }
        Returns: void
      }
      train: {
        Args: { p_character_id: string; p_activity: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
