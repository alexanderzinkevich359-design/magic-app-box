export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      athlete_goals: {
        Row: {
          athlete_id: string
          coach_id: string | null
          completed_at: string | null
          created_at: string
          deadline: string | null
          id: string
          progress: number
          target: string
          title: string
        }
        Insert: {
          athlete_id: string
          coach_id?: string | null
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          id?: string
          progress?: number
          target: string
          title: string
        }
        Update: {
          athlete_id?: string
          coach_id?: string | null
          completed_at?: string | null
          created_at?: string
          deadline?: string | null
          id?: string
          progress?: number
          target?: string
          title?: string
        }
        Relationships: []
      }
      athlete_metrics: {
        Row: {
          athlete_id: string
          id: string
          metric_category: string
          metric_type: string
          notes: string | null
          recorded_at: string
          recorded_by: string | null
          sport_id: string
          unit: string | null
          value: number
        }
        Insert: {
          athlete_id: string
          id?: string
          metric_category: string
          metric_type: string
          notes?: string | null
          recorded_at?: string
          recorded_by?: string | null
          sport_id: string
          unit?: string | null
          value: number
        }
        Update: {
          athlete_id?: string
          id?: string
          metric_category?: string
          metric_type?: string
          notes?: string | null
          recorded_at?: string
          recorded_by?: string | null
          sport_id?: string
          unit?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "athlete_metrics_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      athlete_programs: {
        Row: {
          assigned_by: string
          athlete_id: string
          completed_at: string | null
          id: string
          program_id: string
          started_at: string
          status: string
        }
        Insert: {
          assigned_by: string
          athlete_id: string
          completed_at?: string | null
          id?: string
          program_id: string
          started_at?: string
          status?: string
        }
        Update: {
          assigned_by?: string
          athlete_id?: string
          completed_at?: string | null
          id?: string
          program_id?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "athlete_programs_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_alerts: {
        Row: {
          alert_type: string
          athlete_id: string
          coach_id: string
          created_at: string
          id: string
          is_read: boolean
          message: string
          severity: string
          title: string
        }
        Insert: {
          alert_type: string
          athlete_id: string
          coach_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          severity?: string
          title: string
        }
        Update: {
          alert_type?: string
          athlete_id?: string
          coach_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          severity?: string
          title?: string
        }
        Relationships: []
      }
      coach_athlete_links: {
        Row: {
          athlete_user_id: string
          coach_user_id: string
          created_at: string
          id: string
          position: string | null
          sport_id: string | null
        }
        Insert: {
          athlete_user_id: string
          coach_user_id: string
          created_at?: string
          id?: string
          position?: string | null
          sport_id?: string | null
        }
        Update: {
          athlete_user_id?: string
          coach_user_id?: string
          created_at?: string
          id?: string
          position?: string | null
          sport_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coach_athlete_links_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      coach_notes: {
        Row: {
          athlete_id: string
          coach_id: string
          created_at: string
          id: string
          is_private: boolean
          note: string
          tag: string | null
        }
        Insert: {
          athlete_id: string
          coach_id: string
          created_at?: string
          id?: string
          is_private?: boolean
          note: string
          tag?: string | null
        }
        Update: {
          athlete_id?: string
          coach_id?: string
          created_at?: string
          id?: string
          is_private?: boolean
          note?: string
          tag?: string | null
        }
        Relationships: []
      }
      coach_schedule: {
        Row: {
          athlete_id: string
          coach_id: string
          color: string | null
          created_at: string
          end_time: string | null
          id: string
          notes: string | null
          scheduled_date: string
          start_time: string | null
          title: string
          updated_at: string
        }
        Insert: {
          athlete_id: string
          coach_id: string
          color?: string | null
          created_at?: string
          end_time?: string | null
          id?: string
          notes?: string | null
          scheduled_date: string
          start_time?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          coach_id?: string
          color?: string | null
          created_at?: string
          end_time?: string | null
          id?: string
          notes?: string | null
          scheduled_date?: string
          start_time?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      drills: {
        Row: {
          coaching_cues: string | null
          created_at: string
          difficulty: string
          equipment: string | null
          id: string
          instructions: string | null
          name: string
          order_index: number
          rep_scheme: string | null
          skill_category: string | null
          video_url: string | null
          workout_id: string
        }
        Insert: {
          coaching_cues?: string | null
          created_at?: string
          difficulty?: string
          equipment?: string | null
          id?: string
          instructions?: string | null
          name: string
          order_index?: number
          rep_scheme?: string | null
          skill_category?: string | null
          video_url?: string | null
          workout_id: string
        }
        Update: {
          coaching_cues?: string | null
          created_at?: string
          difficulty?: string
          equipment?: string | null
          id?: string
          instructions?: string | null
          name?: string
          order_index?: number
          rep_scheme?: string | null
          skill_category?: string | null
          video_url?: string | null
          workout_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drills_workout_id_fkey"
            columns: ["workout_id"]
            isOneToOne: false
            referencedRelation: "workouts"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_athlete_links: {
        Row: {
          athlete_user_id: string
          created_at: string
          id: string
          parent_user_id: string
        }
        Insert: {
          athlete_user_id: string
          created_at?: string
          id?: string
          parent_user_id: string
        }
        Update: {
          athlete_user_id?: string
          created_at?: string
          id?: string
          parent_user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          date_of_birth: string | null
          first_name: string
          id: string
          last_name: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          first_name?: string
          id?: string
          last_name?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          date_of_birth?: string | null
          first_name?: string
          id?: string
          last_name?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      programs: {
        Row: {
          coach_id: string
          created_at: string
          description: string | null
          duration_weeks: number | null
          id: string
          is_published: boolean
          name: string
          position_type: string | null
          skill_level: string
          sport_id: string
          updated_at: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          description?: string | null
          duration_weeks?: number | null
          id?: string
          is_published?: boolean
          name: string
          position_type?: string | null
          skill_level?: string
          sport_id: string
          updated_at?: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          description?: string | null
          duration_weeks?: number | null
          id?: string
          is_published?: boolean
          name?: string
          position_type?: string | null
          skill_level?: string
          sport_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programs_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      sports: {
        Row: {
          created_at: string
          icon: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          icon?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
        }
        Relationships: []
      }
      training_sessions: {
        Row: {
          athlete_id: string
          coach_id: string
          created_at: string
          drill_reps: number | null
          duration_min: number | null
          id: string
          injury_note: string | null
          intensity: string | null
          notes: string | null
          pitch_count: number | null
          session_date: string
          session_type: string
          soreness_flag: boolean
          sport_id: string
          status: string
          throw_count: number | null
          updated_at: string
        }
        Insert: {
          athlete_id: string
          coach_id: string
          created_at?: string
          drill_reps?: number | null
          duration_min?: number | null
          id?: string
          injury_note?: string | null
          intensity?: string | null
          notes?: string | null
          pitch_count?: number | null
          session_date: string
          session_type?: string
          soreness_flag?: boolean
          sport_id: string
          status?: string
          throw_count?: number | null
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          coach_id?: string
          created_at?: string
          drill_reps?: number | null
          duration_min?: number | null
          id?: string
          injury_note?: string | null
          intensity?: string | null
          notes?: string | null
          pitch_count?: number | null
          session_date?: string
          session_type?: string
          soreness_flag?: boolean
          sport_id?: string
          status?: string
          throw_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_sessions_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      video_feedback: {
        Row: {
          coach_id: string
          created_at: string
          feedback_text: string
          id: string
          timestamp_seconds: number | null
          video_submission_id: string
        }
        Insert: {
          coach_id: string
          created_at?: string
          feedback_text: string
          id?: string
          timestamp_seconds?: number | null
          video_submission_id: string
        }
        Update: {
          coach_id?: string
          created_at?: string
          feedback_text?: string
          id?: string
          timestamp_seconds?: number | null
          video_submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_feedback_video_submission_id_fkey"
            columns: ["video_submission_id"]
            isOneToOne: false
            referencedRelation: "video_submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      video_submissions: {
        Row: {
          athlete_id: string
          description: string | null
          drill_id: string | null
          id: string
          submitted_at: string
          video_url: string
        }
        Insert: {
          athlete_id: string
          description?: string | null
          drill_id?: string | null
          id?: string
          submitted_at?: string
          video_url: string
        }
        Update: {
          athlete_id?: string
          description?: string | null
          drill_id?: string | null
          id?: string
          submitted_at?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_submissions_drill_id_fkey"
            columns: ["drill_id"]
            isOneToOne: false
            referencedRelation: "drills"
            referencedColumns: ["id"]
          },
        ]
      }
      workload_tracking: {
        Row: {
          athlete_id: string
          id: string
          intensity_level: string | null
          notes: string | null
          pitch_count: number | null
          recorded_at: string
          recorded_by: string | null
          session_duration_min: number | null
          sport_id: string
          throw_count: number | null
        }
        Insert: {
          athlete_id: string
          id?: string
          intensity_level?: string | null
          notes?: string | null
          pitch_count?: number | null
          recorded_at?: string
          recorded_by?: string | null
          session_duration_min?: number | null
          sport_id: string
          throw_count?: number | null
        }
        Update: {
          athlete_id?: string
          id?: string
          intensity_level?: string | null
          notes?: string | null
          pitch_count?: number | null
          recorded_at?: string
          recorded_by?: string | null
          session_duration_min?: number | null
          sport_id?: string
          throw_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "workload_tracking_sport_id_fkey"
            columns: ["sport_id"]
            isOneToOne: false
            referencedRelation: "sports"
            referencedColumns: ["id"]
          },
        ]
      }
      workouts: {
        Row: {
          created_at: string
          description: string | null
          estimated_duration_min: number | null
          id: string
          order_index: number
          program_id: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          estimated_duration_min?: number | null
          id?: string
          order_index?: number
          program_id: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          estimated_duration_min?: number | null
          id?: string
          order_index?: number
          program_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "workouts_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_coach_of_athlete: {
        Args: { _athlete_id: string; _coach_id: string }
        Returns: boolean
      }
      is_parent_of_athlete: {
        Args: { _athlete_id: string; _parent_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "coach" | "athlete" | "parent"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["coach", "athlete", "parent"],
    },
  },
} as const
