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
          defence: number
          speed: number
          vitality: number
          stamina: number
          max_stamina: number
          gold: number
          level: number
          stamina_updated_at: string
          treasure_coins: number
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
          defence?: number
          speed?: number
          vitality?: number
          stamina?: number
          max_stamina?: number
          gold?: number
          level?: number
          stamina_updated_at?: string
          treasure_coins?: number
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
          defence?: number
          speed?: number
          vitality?: number
          stamina?: number
          max_stamina?: number
          gold?: number
          level?: number
          stamina_updated_at?: string
          treasure_coins?: number
          created_at?: string
        }
        Relationships: []
      }
      skills: {
        Row: {
          id: string
          character_id: string
          name: string
          level: number
          experience: number
          specialization: string | null
        }
        Insert: {
          id?: string
          character_id: string
          name: string
          level?: number
          experience?: number
          specialization?: string | null
        }
        Update: {
          id?: string
          character_id?: string
          name?: string
          level?: number
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
          rarity: number
          stats: Json
          recipe_id: string | null
          market_value: number
        }
        Insert: {
          id?: string
          name: string
          type: string
          rarity?: number
          stats?: Json
          recipe_id?: string | null
          market_value?: number
        }
        Update: {
          id?: string
          name?: string
          type?: string
          rarity?: number
          stats?: Json
          recipe_id?: string | null
          market_value?: number
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
          durability: number | null
          max_durability: number | null
        }
        Insert: {
          id?: string
          character_id: string
          item_id: string
          quantity?: number
          equipped?: boolean
          durability?: number | null
          max_durability?: number | null
        }
        Update: {
          id?: string
          character_id?: string
          item_id?: string
          quantity?: number
          equipped?: boolean
          durability?: number | null
          max_durability?: number | null
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
          description: string
          symbol: string
          banner_url: string | null
          philosophy: string
          founder_id: string
          food: number
          wood: number
          stone: number
          morale: number
          spirit_favor: number
          population: number
          tax_rate: number
          donation_policy: string
          pvp_policy: string
          recruitment_policy: string
          leader_elections: boolean
          level: number
          xp: number
          vault_gold: number
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string
          symbol: string
          banner_url?: string | null
          philosophy: string
          founder_id: string
          food?: number
          wood?: number
          stone?: number
          morale?: number
          spirit_favor?: number
          population?: number
          tax_rate?: number
          donation_policy?: string
          pvp_policy?: string
          recruitment_policy?: string
          leader_elections?: boolean
          level?: number
          xp?: number
          vault_gold?: number
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string
          symbol?: string
          banner_url?: string | null
          philosophy?: string
          founder_id?: string
          food?: number
          wood?: number
          stone?: number
          morale?: number
          spirit_favor?: number
          population?: number
          tax_rate?: number
          donation_policy?: string
          pvp_policy?: string
          recruitment_policy?: string
          leader_elections?: boolean
          level?: number
          xp?: number
          vault_gold?: number
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
          total_donated_wood: number
          total_donated_stone: number
          total_donated_food: number
          total_donated_gold: number
          combat_wins: number
          resources_gathered: number
          items_crafted: number
        }
        Insert: {
          id?: string
          clan_id: string
          character_id: string
          role?: string
          joined_at?: string
          total_donated_wood?: number
          total_donated_stone?: number
          total_donated_food?: number
          total_donated_gold?: number
          combat_wins?: number
          resources_gathered?: number
          items_crafted?: number
        }
        Update: {
          id?: string
          clan_id?: string
          character_id?: string
          role?: string
          joined_at?: string
          total_donated_wood?: number
          total_donated_stone?: number
          total_donated_food?: number
          total_donated_gold?: number
          combat_wins?: number
          resources_gathered?: number
          items_crafted?: number
        }
        Relationships: []
      }
      clan_projects: {
        Row: {
          id: string
          clan_id: string
          name: string
          description: string | null
          icon: string
          total_wood: number
          total_stone: number
          total_food: number
          contributed_wood: number
          contributed_stone: number
          contributed_food: number
          reward_description: string | null
          reward_type: string | null
          reward_value: string | null
          status: string
          created_at: string
          completed_at: string | null
        }
        Insert: {
          id?: string
          clan_id: string
          name: string
          description?: string | null
          icon?: string
          total_wood?: number
          total_stone?: number
          total_food?: number
          contributed_wood?: number
          contributed_stone?: number
          contributed_food?: number
          reward_description?: string | null
          reward_type?: string | null
          reward_value?: string | null
          status?: string
          created_at?: string
          completed_at?: string | null
        }
        Update: {
          id?: string
          clan_id?: string
          name?: string
          description?: string | null
          icon?: string
          total_wood?: number
          total_stone?: number
          total_food?: number
          contributed_wood?: number
          contributed_stone?: number
          contributed_food?: number
          reward_description?: string | null
          reward_type?: string | null
          reward_value?: string | null
          status?: string
          created_at?: string
          completed_at?: string | null
        }
        Relationships: []
      }
      clan_project_contributions: {
        Row: {
          id: string
          project_id: string
          character_id: string
          wood_contributed: number
          stone_contributed: number
          food_contributed: number
          contributed_at: string
        }
        Insert: {
          id?: string
          project_id: string
          character_id: string
          wood_contributed?: number
          stone_contributed?: number
          food_contributed?: number
          contributed_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          character_id?: string
          wood_contributed?: number
          stone_contributed?: number
          food_contributed?: number
          contributed_at?: string
        }
        Relationships: []
      }
      clan_buildings: {
        Row: {
          id: string
          clan_id: string
          building_type: string
          level: number
          contributed_wood: number
          contributed_stone: number
          contributed_food: number
          created_at: string
        }
        Insert: {
          id?: string
          clan_id: string
          building_type: string
          level?: number
          contributed_wood?: number
          contributed_stone?: number
          contributed_food?: number
          created_at?: string
        }
        Update: {
          id?: string
          clan_id?: string
          building_type?: string
          level?: number
          contributed_wood?: number
          contributed_stone?: number
          contributed_food?: number
          created_at?: string
        }
        Relationships: []
      }
      clan_vault_items: {
        Row: {
          id: string
          clan_id: string
          item_id: string
          quantity: number
          deposited_by: string | null
          deposited_at: string
        }
        Insert: {
          id?: string
          clan_id: string
          item_id: string
          quantity?: number
          deposited_by?: string | null
          deposited_at?: string
        }
        Update: {
          id?: string
          clan_id?: string
          item_id?: string
          quantity?: number
          deposited_by?: string | null
          deposited_at?: string
        }
        Relationships: []
      }
      clan_vault_log: {
        Row: {
          id: string
          clan_id: string
          character_id: string
          action: string
          item_name: string | null
          quantity: number
          gold_amount: number
          created_at: string
        }
        Insert: {
          id?: string
          clan_id: string
          character_id: string
          action: string
          item_name?: string | null
          quantity?: number
          gold_amount?: number
          created_at?: string
        }
        Update: {
          id?: string
          clan_id?: string
          character_id?: string
          action?: string
          item_name?: string | null
          quantity?: number
          gold_amount?: number
          created_at?: string
        }
        Relationships: []
      }
      building_contributions: {
        Row: {
          id: string
          building_id: string
          character_id: string
          wood_contributed: number
          stone_contributed: number
          food_contributed: number
          contributed_at: string
        }
        Insert: {
          id?: string
          building_id: string
          character_id: string
          wood_contributed?: number
          stone_contributed?: number
          food_contributed?: number
          contributed_at?: string
        }
        Update: {
          id?: string
          building_id?: string
          character_id?: string
          wood_contributed?: number
          stone_contributed?: number
          food_contributed?: number
          contributed_at?: string
        }
        Relationships: []
      }
      clan_events: {
        Row: {
          id: string
          clan_id: string
          event_type: string
          description: string
          character_id: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string
          clan_id: string
          event_type: string
          description: string
          character_id?: string | null
          metadata?: Json
          created_at?: string
        }
        Update: {
          id?: string
          clan_id?: string
          event_type?: string
          description?: string
          character_id?: string | null
          metadata?: Json
          created_at?: string
        }
        Relationships: []
      }
      achievements: {
        Row: {
          id: string
          character_id: string
          achievement_type: string
          title: string
          description: string | null
          awarded_at: string
        }
        Insert: {
          id?: string
          character_id: string
          achievement_type: string
          title: string
          description?: string | null
          awarded_at?: string
        }
        Update: {
          id?: string
          character_id?: string
          achievement_type?: string
          title?: string
          description?: string | null
          awarded_at?: string
        }
        Relationships: []
      }
      world_events: {
        Row: {
          id: string
          name: string
          description: string
          event_type: string
          modifiers: Json
          progress: number
          target: number | null
          reward_description: string | null
          reward_value: string | null
          started_at: string
          ends_at: string | null
          status: string
        }
        Insert: {
          id?: string
          name: string
          description: string
          event_type: string
          modifiers?: Json
          progress?: number
          target?: number | null
          reward_description?: string | null
          reward_value?: string | null
          started_at?: string
          ends_at?: string | null
          status?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string
          event_type?: string
          modifiers?: Json
          progress?: number
          target?: number | null
          reward_description?: string | null
          reward_value?: string | null
          started_at?: string
          ends_at?: string | null
          status?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          id: string
          character_id: string
          notification_type: string
          title: string
          description: string | null
          link: string | null
          read: boolean
          created_at: string
        }
        Insert: {
          id?: string
          character_id: string
          notification_type: string
          title: string
          description?: string | null
          link?: string | null
          read?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          character_id?: string
          notification_type?: string
          title?: string
          description?: string | null
          link?: string | null
          read?: boolean
          created_at?: string
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
          rarity: number
          description: string | null
          buy_price: number
          sell_price: number
          stock: number
          stats: Json
          created_at: string
          buy_rate: number
        }
        Insert: {
          id?: string
          name: string
          type: string
          rarity?: number
          description?: string | null
          buy_price: number
          sell_price: number
          stock?: number
          stats?: Json
          created_at?: string
          buy_rate?: number
        }
        Update: {
          id?: string
          name?: string
          type?: string
          rarity?: number
          description?: string | null
          buy_price?: number
          sell_price?: number
          stock?: number
          stats?: Json
          created_at?: string
          buy_rate?: number
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
      npcs: {
        Row: {
          id: string
          name: string
          description: string
          level: number
          base_strength: number
          base_defence: number
          base_speed: number
          base_vitality: number
          hp: number
          gold_min: number
          gold_max: number
          xp_reward: number
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string
          level?: number
          base_strength?: number
          base_defence?: number
          base_speed?: number
          base_vitality?: number
          hp?: number
          gold_min?: number
          gold_max?: number
          xp_reward?: number
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string
          level?: number
          base_strength?: number
          base_defence?: number
          base_speed?: number
          base_vitality?: number
          hp?: number
          gold_min?: number
          gold_max?: number
          xp_reward?: number
          created_at?: string
        }
        Relationships: []
      }
      npc_equipment: {
        Row: {
          id: string
          npc_id: string
          item_id: string
          slot: string
        }
        Insert: {
          id?: string
          npc_id: string
          item_id: string
          slot: string
        }
        Update: {
          id?: string
          npc_id?: string
          item_id?: string
          slot?: string
        }
        Relationships: []
      }
      npc_loot: {
        Row: {
          id: string
          npc_id: string
          item_name: string
          chance: number
          min_qty: number
          max_qty: number
        }
        Insert: {
          id?: string
          npc_id: string
          item_name: string
          chance: number
          min_qty?: number
          max_qty?: number
        }
        Update: {
          id?: string
          npc_id?: string
          item_name?: string
          chance?: number
          min_qty?: number
          max_qty?: number
        }
        Relationships: []
      }
      collections: {
        Row: {
          id: string
          name: string
          description: string
          icon: string
          sort_order: number
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string
          icon?: string
          sort_order?: number
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string
          icon?: string
          sort_order?: number
          created_at?: string
        }
        Relationships: []
      }
      collection_items: {
        Row: {
          id: string
          collection_id: string
          item_name: string
          item_type: string
          item_rarity: number
        }
        Insert: {
          id?: string
          collection_id: string
          item_name: string
          item_type?: string
          item_rarity?: number
        }
        Update: {
          id?: string
          collection_id?: string
          item_name?: string
          item_type?: string
          item_rarity?: number
        }
        Relationships: []
      }
      character_collections: {
        Row: {
          id: string
          character_id: string
          collection_id: string
          completed_at: string
        }
        Insert: {
          id?: string
          character_id: string
          collection_id: string
          completed_at?: string
        }
        Update: {
          id?: string
          character_id?: string
          collection_id?: string
          completed_at?: string
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
        Returns: Json
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
        Args: { p_character_id: string; p_item_name: string; p_item_type: string; p_item_rarity: number; p_item_stats: Json; p_duration: number; p_materials: Json }
        Returns: void
      }
      shop_buy: {
        Args: { p_character_id: string; p_item_name: string; p_item_type: string; p_item_rarity: number; p_item_stats: Json; p_total_cost: number; p_quantity: number }
        Returns: void
      }
      shop_sell: {
        Args: { p_character_id: string; p_inventory_id: string; p_quantity: number }
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
        Args: { p_character_id: string }
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
      give_item: {
        Args: { p_character_id: string; p_item_name: string; p_quantity: number }
        Returns: void
      }
      join_clan: {
        Args: { p_character_id: string; p_clan_id: string }
        Returns: void
      }
      leave_clan: {
        Args: { p_character_id: string }
        Returns: void
      }
      kick_clan_member: {
        Args: { p_chieftain_id: string; p_target_id: string }
        Returns: void
      }
      promote_clan_member: {
        Args: { p_chieftain_id: string; p_target_id: string }
        Returns: void
      }
      demote_clan_member: {
        Args: { p_chieftain_id: string; p_target_id: string }
        Returns: void
      }
      transfer_chieftain: {
        Args: { p_chieftain_id: string; p_target_id: string }
        Returns: void
      }
      place_bid: {
        Args: { p_character_id: string; p_auction_id: string; p_bid_amount: number }
        Returns: void
      }
      craft_item_rpc: {
        Args: { p_character_id: string; p_item_name: string; p_item_type: string; p_item_rarity: number; p_item_stats: Json; p_duration: number; p_materials: Json }
        Returns: Json
      }
      donate_to_clan: {
        Args: { p_character_id: string; p_food?: number; p_wood?: number; p_stone?: number; p_gold?: number }
        Returns: void
      }
      contribute_to_project: {
        Args: { p_character_id: string; p_project_id: string; p_wood?: number; p_stone?: number; p_food?: number }
        Returns: Json
      }
      create_clan_project: {
        Args: { p_character_id: string; p_name: string; p_description?: string; p_total_wood?: number; p_total_stone?: number; p_total_food?: number; p_reward_description?: string; p_reward_type?: string; p_reward_value?: string; p_icon?: string }
        Returns: void
      }
      add_clan_event: {
        Args: { p_clan_id: string; p_event_type: string; p_description: string; p_character_id?: string; p_metadata?: Json }
        Returns: void
      }
      award_achievement: {
        Args: { p_character_id: string; p_achievement_type: string; p_title: string; p_description?: string }
        Returns: void
      }
      create_world_event: {
        Args: { p_name: string; p_description: string; p_event_type: string; p_modifiers?: Json; p_target?: number; p_reward_description?: string; p_reward_value?: string; p_duration_hours?: number }
        Returns: void
      }
      reward_npc_kill: {
        Args: { p_character_id: string; p_npc_id: string }
        Returns: Json
      }
      get_npc_effective_stats: {
        Args: { p_npc_id: string }
        Returns: Json
      }
      roll_npc_loot: {
        Args: { p_npc_id: string }
        Returns: Json
      }
      check_collection_progress: {
        Args: { p_character_id: string; p_collection_id: string }
        Returns: Json
      }
      claim_collection_reward: {
        Args: { p_character_id: string; p_collection_id: string }
        Returns: Json
      }
      get_character_collections: {
        Args: { p_character_id: string }
        Returns: Json
      }
      hunt: {
        Args: { p_character_id: string }
        Returns: Json
      }
      compute_player_level: {
        Args: { p_character_id: string }
        Returns: number
      }
      assert_character_owner: {
        Args: { p_character_id: string }
        Returns: void
      }
      beg: {
        Args: { p_character_id: string }
        Returns: Json
      }
      tame: {
        Args: { p_character_id: string }
        Returns: Json
      }
      check_skill_xp: {
        Args: { p_character_id: string; p_skill_name: string; p_xp_gain: number }
        Returns: void
      }
      contribute_to_building: {
        Args: { p_character_id: string; p_building_id: string; p_wood?: number; p_stone?: number; p_food?: number }
        Returns: Json
      }
      vault_deposit_gold: {
        Args: { p_character_id: string; p_amount: number }
        Returns: Json
      }
      vault_withdraw_gold: {
        Args: { p_character_id: string; p_amount: number }
        Returns: Json
      }
      vault_deposit_item: {
        Args: { p_character_id: string; p_item_name: string; p_quantity: number }
        Returns: Json
      }
      vault_withdraw_item: {
        Args: { p_character_id: string; p_item_name: string; p_quantity: number }
        Returns: Json
      }
      get_clan_buildings_with_progress: {
        Args: { p_clan_id: string }
        Returns: Json
      }
      get_clan_vault_contents: {
        Args: { p_clan_id: string }
        Returns: Json
      }
      add_clan_xp: {
        Args: { p_clan_id: string; p_amount: number }
        Returns: void
      }
      get_building_cost: {
        Args: { p_level: number }
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
