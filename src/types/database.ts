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
          appearance: Json
          background: string
          strength: number
          agility: number
          endurance: number
          focus: number
          cunning: number
          stamina: number
          max_stamina: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          appearance?: Json
          background?: string
          strength?: number
          agility?: number
          endurance?: number
          focus?: number
          cunning?: number
          stamina?: number
          max_stamina?: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          appearance?: Json
          background?: string
          strength?: number
          agility?: number
          endurance?: number
          focus?: number
          cunning?: number
          stamina?: number
          max_stamina?: number
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
      factions: {
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
      faction_members: {
        Row: {
          id: string
          faction_id: string
          character_id: string
          role: string
          joined_at: string
        }
        Insert: {
          id?: string
          faction_id: string
          character_id: string
          role?: string
          joined_at?: string
        }
        Update: {
          id?: string
          faction_id?: string
          character_id?: string
          role?: string
          joined_at?: string
        }
        Relationships: []
      }
      settlements: {
        Row: {
          id: string
          faction_id: string
          name: string
          tier: number
          created_at: string
        }
        Insert: {
          id?: string
          faction_id: string
          name: string
          tier?: number
          created_at?: string
        }
        Update: {
          id?: string
          faction_id?: string
          name?: string
          tier?: number
          created_at?: string
        }
        Relationships: []
      }
      buildings: {
        Row: {
          id: string
          settlement_id: string
          name: string
          tier: number
          build_time: number
          built_at: string | null
        }
        Insert: {
          id?: string
          settlement_id: string
          name: string
          tier?: number
          build_time?: number
          built_at?: string | null
        }
        Update: {
          id?: string
          settlement_id?: string
          name?: string
          tier?: number
          build_time?: number
          built_at?: string | null
        }
        Relationships: []
      }
      territories: {
        Row: {
          id: string
          hex_x: number
          hex_y: number
          type: string
          faction_id: string | null
          claimed_at: string | null
        }
        Insert: {
          id?: string
          hex_x: number
          hex_y: number
          type: string
          faction_id?: string | null
          claimed_at?: string | null
        }
        Update: {
          id?: string
          hex_x?: number
          hex_y?: number
          type?: string
          faction_id?: string | null
          claimed_at?: string | null
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
      pets: {
        Row: {
          id: string
          character_id: string
          type: string
          name: string
        }
        Insert: {
          id?: string
          character_id: string
          type: string
          name: string
        }
        Update: {
          id?: string
          character_id?: string
          type?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
