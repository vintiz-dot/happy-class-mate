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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_user_id: string | null
          diff: Json | null
          entity: string
          entity_id: string | null
          id: string
          occurred_at: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          diff?: Json | null
          entity: string
          entity_id?: string | null
          id?: string
          occurred_at?: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          diff?: Json | null
          entity?: string
          entity_id?: string | null
          id?: string
          occurred_at?: string
        }
        Relationships: []
      }
      bank_info: {
        Row: {
          account_name: string
          account_number: string
          bank_name: string
          created_at: string
          id: number
          updated_at: string
          vietqr_storage_key: string | null
        }
        Insert: {
          account_name?: string
          account_number?: string
          bank_name?: string
          created_at?: string
          id?: number
          updated_at?: string
          vietqr_storage_key?: string | null
        }
        Update: {
          account_name?: string
          account_number?: string
          bank_name?: string
          created_at?: string
          id?: number
          updated_at?: string
          vietqr_storage_key?: string | null
        }
        Relationships: []
      }
      classes: {
        Row: {
          created_at: string
          created_by: string | null
          default_teacher_id: string | null
          id: string
          is_active: boolean
          name: string
          schedule_template: Json
          session_rate_vnd: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          default_teacher_id?: string | null
          id?: string
          is_active?: boolean
          name: string
          schedule_template?: Json
          session_rate_vnd?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          default_teacher_id?: string | null
          id?: string
          is_active?: boolean
          name?: string
          schedule_template?: Json
          session_rate_vnd?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_default_teacher_id_fkey"
            columns: ["default_teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_assignments: {
        Row: {
          created_at: string
          created_by: string | null
          discount_def_id: string
          effective_from: string
          effective_to: string | null
          id: string
          note: string | null
          student_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          discount_def_id: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          note?: string | null
          student_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          discount_def_id?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          note?: string | null
          student_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "discount_assignments_discount_def_id_fkey"
            columns: ["discount_def_id"]
            isOneToOne: false
            referencedRelation: "discount_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "discount_assignments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      discount_definitions: {
        Row: {
          amortize_yearly: boolean
          cadence: Database["public"]["Enums"]["discount_cadence"]
          created_at: string
          created_by: string | null
          end_month: string | null
          id: string
          is_active: boolean
          name: string
          start_month: string
          type: Database["public"]["Enums"]["discount_type"]
          updated_at: string
          updated_by: string | null
          value: number
        }
        Insert: {
          amortize_yearly?: boolean
          cadence: Database["public"]["Enums"]["discount_cadence"]
          created_at?: string
          created_by?: string | null
          end_month?: string | null
          id?: string
          is_active?: boolean
          name: string
          start_month: string
          type: Database["public"]["Enums"]["discount_type"]
          updated_at?: string
          updated_by?: string | null
          value: number
        }
        Update: {
          amortize_yearly?: boolean
          cadence?: Database["public"]["Enums"]["discount_cadence"]
          created_at?: string
          created_by?: string | null
          end_month?: string | null
          id?: string
          is_active?: boolean
          name?: string
          start_month?: string
          type?: Database["public"]["Enums"]["discount_type"]
          updated_at?: string
          updated_by?: string | null
          value?: number
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          class_id: string
          created_at: string
          created_by: string | null
          discount_cadence:
            | Database["public"]["Enums"]["discount_cadence"]
            | null
          discount_type: Database["public"]["Enums"]["discount_type"] | null
          discount_value: number | null
          end_date: string | null
          id: string
          start_date: string
          student_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          class_id: string
          created_at?: string
          created_by?: string | null
          discount_cadence?:
            | Database["public"]["Enums"]["discount_cadence"]
            | null
          discount_type?: Database["public"]["Enums"]["discount_type"] | null
          discount_value?: number | null
          end_date?: string | null
          id?: string
          start_date?: string
          student_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          class_id?: string
          created_at?: string
          created_by?: string | null
          discount_cadence?:
            | Database["public"]["Enums"]["discount_cadence"]
            | null
          discount_type?: Database["public"]["Enums"]["discount_type"] | null
          discount_value?: number | null
          end_date?: string | null
          id?: string
          start_date?: string
          student_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          address: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          primary_user_id: string | null
          sibling_percent_override: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          primary_user_id?: string | null
          sibling_percent_override?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          primary_user_id?: string | null
          sibling_percent_override?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "families_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "families_primary_user_id_fkey"
            columns: ["primary_user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "families_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          base_amount: number
          created_at: string
          created_by: string | null
          discount_amount: number
          id: string
          month: string
          number: string | null
          paid_amount: number
          pdf_storage_key: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          student_id: string
          total_amount: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          base_amount?: number
          created_at?: string
          created_by?: string | null
          discount_amount?: number
          id?: string
          month: string
          number?: string | null
          paid_amount?: number
          pdf_storage_key?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          student_id: string
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          base_amount?: number
          created_at?: string
          created_by?: string | null
          discount_amount?: number
          id?: string
          month?: string
          number?: string | null
          paid_amount?: number
          pdf_storage_key?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          student_id?: string
          total_amount?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_accounts: {
        Row: {
          code: Database["public"]["Enums"]["account_code"]
          created_at: string
          id: string
          student_id: string
          updated_at: string
        }
        Insert: {
          code: Database["public"]["Enums"]["account_code"]
          created_at?: string
          id?: string
          student_id: string
          updated_at?: string
        }
        Update: {
          code?: Database["public"]["Enums"]["account_code"]
          created_at?: string
          id?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_accounts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_entries: {
        Row: {
          account_id: string
          created_at: string
          created_by: string | null
          credit: number
          debit: number
          id: string
          memo: string | null
          month: string
          occurred_at: string
          tx_id: string
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          created_by?: string | null
          credit?: number
          debit?: number
          id?: string
          memo?: string | null
          month: string
          occurred_at?: string
          tx_id: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          created_by?: string | null
          credit?: number
          debit?: number
          id?: string
          memo?: string | null
          month?: string
          occurred_at?: string
          tx_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ledger_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          id: string
          memo: string | null
          method: string
          occurred_at: string
          student_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          id?: string
          memo?: string | null
          method: string
          occurred_at?: string
          student_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          id?: string
          memo?: string | null
          method?: string
          occurred_at?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll_summaries: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          month: string
          sessions_count: number
          teacher_id: string
          total_amount: number
          total_hours: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          month: string
          sessions_count?: number
          teacher_id: string
          total_amount?: number
          total_hours?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          month?: string
          sessions_count?: number
          teacher_id?: string
          total_amount?: number
          total_hours?: number
        }
        Relationships: [
          {
            foreignKeyName: "payroll_summaries_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_bonuses: {
        Row: {
          cadence: Database["public"]["Enums"]["discount_cadence"]
          created_at: string
          created_by: string | null
          effective_from: string
          effective_to: string | null
          id: string
          note: string | null
          student_id: string
          type: Database["public"]["Enums"]["discount_type"]
          updated_at: string
          updated_by: string | null
          value: number
        }
        Insert: {
          cadence: Database["public"]["Enums"]["discount_cadence"]
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          note?: string | null
          student_id: string
          type: Database["public"]["Enums"]["discount_type"]
          updated_at?: string
          updated_by?: string | null
          value: number
        }
        Update: {
          cadence?: Database["public"]["Enums"]["discount_cadence"]
          created_at?: string
          created_by?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          note?: string | null
          student_id?: string
          type?: Database["public"]["Enums"]["discount_type"]
          updated_at?: string
          updated_by?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "referral_bonuses_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          class_id: string
          created_at: string
          created_by: string | null
          date: string
          end_time: string
          id: string
          notes: string | null
          start_time: string
          status: Database["public"]["Enums"]["session_status"]
          teacher_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          class_id: string
          created_at?: string
          created_by?: string | null
          date: string
          end_time: string
          id?: string
          notes?: string | null
          start_time: string
          status?: Database["public"]["Enums"]["session_status"]
          teacher_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          class_id?: string
          created_at?: string
          created_by?: string | null
          date?: string
          end_time?: string
          id?: string
          notes?: string | null
          start_time?: string
          status?: Database["public"]["Enums"]["session_status"]
          teacher_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          created_at: string
          created_by: string | null
          date_of_birth: string | null
          email: string | null
          family_id: string | null
          full_name: string
          id: string
          is_active: boolean
          linked_user_id: string | null
          notes: string | null
          phone: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          email?: string | null
          family_id?: string | null
          full_name: string
          id?: string
          is_active?: boolean
          linked_user_id?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date_of_birth?: string | null
          email?: string | null
          family_id?: string | null
          full_name?: string
          id?: string
          is_active?: boolean
          linked_user_id?: string | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "students_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_linked_user_id_fkey"
            columns: ["linked_user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          bio: string | null
          created_at: string
          created_by: string | null
          email: string | null
          full_name: string
          hourly_rate_vnd: number
          id: string
          is_active: boolean
          phone: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name: string
          hourly_rate_vnd?: number
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          full_name?: string
          hourly_rate_vnd?: number
          id?: string
          is_active?: boolean
          phone?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teachers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teachers_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teachers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_view_student: {
        Args: { student_id: string; user_id: string }
        Returns: boolean
      }
      check_teacher_availability: {
        Args: {
          p_date: string
          p_end_time: string
          p_exclude_session_id?: string
          p_start_time: string
          p_teacher_id: string
        }
        Returns: boolean
      }
      get_user_role: {
        Args: { user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
    }
    Enums: {
      account_code: "AR" | "REVENUE" | "DISCOUNT" | "CASH" | "BANK" | "CREDIT"
      app_role: "admin" | "teacher" | "family" | "student"
      discount_cadence: "once" | "monthly"
      discount_type: "percent" | "amount"
      invoice_status: "draft" | "issued" | "paid" | "partial" | "credit"
      session_status: "Scheduled" | "Held" | "Canceled"
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
      account_code: ["AR", "REVENUE", "DISCOUNT", "CASH", "BANK", "CREDIT"],
      app_role: ["admin", "teacher", "family", "student"],
      discount_cadence: ["once", "monthly"],
      discount_type: ["percent", "amount"],
      invoice_status: ["draft", "issued", "paid", "partial", "credit"],
      session_status: ["Scheduled", "Held", "Canceled"],
    },
  },
} as const
