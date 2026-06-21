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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      profiles: {
        Row: {
          cohort: string | null
          created_at: string
          full_name: string | null
          id: string
          status: string
          updated_at: string
        }
        Insert: {
          cohort?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          status?: string
          updated_at?: string
        }
        Update: {
          cohort?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          choices: Json
          content_area: Database["public"]["Enums"]["content_area"]
          correct_index: number
          created_at: string
          created_by: string | null
          difficulty: number
          id: string
          rationale: string
          source: string | null
          status: Database["public"]["Enums"]["question_status"]
          stem: string
          sub_topic: string | null
          updated_at: string
        }
        Insert: {
          choices: Json
          content_area: Database["public"]["Enums"]["content_area"]
          correct_index: number
          created_at?: string
          created_by?: string | null
          difficulty?: number
          id?: string
          rationale: string
          source?: string | null
          status?: Database["public"]["Enums"]["question_status"]
          stem: string
          sub_topic?: string | null
          updated_at?: string
        }
        Update: {
          choices?: Json
          content_area?: Database["public"]["Enums"]["content_area"]
          correct_index?: number
          created_at?: string
          created_by?: string | null
          difficulty?: number
          id?: string
          rationale?: string
          source?: string | null
          status?: Database["public"]["Enums"]["question_status"]
          stem?: string
          sub_topic?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      review_queue: {
        Row: {
          due_at: string
          ease: number
          id: string
          interval_days: number
          last_reviewed_at: string | null
          question_id: string
          user_id: string
        }
        Insert: {
          due_at?: string
          ease?: number
          id?: string
          interval_days?: number
          last_reviewed_at?: string | null
          question_id: string
          user_id: string
        }
        Update: {
          due_at?: string
          ease?: number
          id?: string
          interval_days?: number
          last_reviewed_at?: string | null
          question_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_queue_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      session_responses: {
        Row: {
          answered_at: string
          chosen_index: number | null
          id: string
          is_correct: boolean
          ms_spent: number | null
          question_id: string
          session_id: string
          user_id: string
        }
        Insert: {
          answered_at?: string
          chosen_index?: number | null
          id?: string
          is_correct?: boolean
          ms_spent?: number | null
          question_id: string
          session_id: string
          user_id: string
        }
        Update: {
          answered_at?: string
          chosen_index?: number | null
          id?: string
          is_correct?: boolean
          ms_spent?: number | null
          question_id?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_responses_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_responses_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "study_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      study_sessions: {
        Row: {
          content_area: Database["public"]["Enums"]["content_area"] | null
          correct_count: number
          finished_at: string | null
          id: string
          mode: Database["public"]["Enums"]["session_mode"]
          started_at: string
          total_questions: number
          user_id: string
        }
        Insert: {
          content_area?: Database["public"]["Enums"]["content_area"] | null
          correct_count?: number
          finished_at?: string | null
          id?: string
          mode: Database["public"]["Enums"]["session_mode"]
          started_at?: string
          total_questions?: number
          user_id: string
        }
        Update: {
          content_area?: Database["public"]["Enums"]["content_area"] | null
          correct_count?: number
          finished_at?: string | null
          id?: string
          mode?: Database["public"]["Enums"]["session_mode"]
          started_at?: string
          total_questions?: number
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
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
    }
    Enums: {
      app_role:
        | "admin"
        | "student"
        | "super_admin"
        | "tenant_admin"
        | "instructor"
        | "learner"
        | "mentor"
      content_area:
        | "human_development"
        | "assessment_diagnosis"
        | "psychotherapy_interventions"
        | "ethics_values"
      question_status: "draft" | "published"
      session_mode: "practice" | "mock" | "review"
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
      app_role: [
        "admin",
        "student",
        "super_admin",
        "tenant_admin",
        "instructor",
        "learner",
        "mentor",
      ],
      content_area: [
        "human_development",
        "assessment_diagnosis",
        "psychotherapy_interventions",
        "ethics_values",
      ],
      question_status: ["draft", "published"],
      session_mode: ["practice", "mock", "review"],
    },
  },
} as const
