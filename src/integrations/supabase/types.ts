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
      activities: {
        Row: {
          course_id: string
          created_at: string
          id: string
          module_ids: string[] | null
          placement: string
          prompt: string | null
          schema: Json
          title: string
          work_product_ids: string[] | null
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          module_ids?: string[] | null
          placement?: string
          prompt?: string | null
          schema?: Json
          title: string
          work_product_ids?: string[] | null
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          module_ids?: string[] | null
          placement?: string
          prompt?: string | null
          schema?: Json
          title?: string
          work_product_ids?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "activities_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      activity_responses: {
        Row: {
          activity_id: string
          ai_output: Json | null
          enrollment_id: string
          id: string
          response: Json
          submitted_at: string
          user_id: string
        }
        Insert: {
          activity_id: string
          ai_output?: Json | null
          enrollment_id: string
          id?: string
          response?: Json
          submitted_at?: string
          user_id: string
        }
        Update: {
          activity_id?: string
          ai_output?: Json | null
          enrollment_id?: string
          id?: string
          response?: Json
          submitted_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_responses_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_responses_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_generations: {
        Row: {
          course_id: string | null
          created_at: string
          id: string
          input: Json | null
          kind: string
          model: string | null
          output: Json | null
          tenant_id: string | null
          user_id: string | null
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          id?: string
          input?: Json | null
          kind: string
          model?: string | null
          output?: Json | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Update: {
          course_id?: string | null
          created_at?: string
          id?: string
          input?: Json | null
          kind?: string
          model?: string | null
          output?: Json | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_generations_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_generations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      apprenticeship_programs: {
        Row: {
          created_at: string
          id: string
          name: string
          required_rti_hours: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          required_rti_hours?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          required_rti_hours?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "apprenticeship_programs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_requests: {
        Row: {
          confirmed_at: string | null
          confirmed_by_email: string | null
          created_at: string
          email_token: string
          id: string
          kind: string
          payload: Json
          requested_by: string
          status: string
          target_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          confirmed_at?: string | null
          confirmed_by_email?: string | null
          created_at?: string
          email_token?: string
          id?: string
          kind: string
          payload?: Json
          requested_by: string
          status?: string
          target_id?: string | null
          tenant_id: string
          updated_at?: string
        }
        Update: {
          confirmed_at?: string | null
          confirmed_by_email?: string | null
          created_at?: string
          email_token?: string
          id?: string
          kind?: string
          payload?: Json
          requested_by?: string
          status?: string
          target_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_items: {
        Row: {
          assessment_id: string
          choices: Json
          correct: Json | null
          id: string
          item_type: string
          legacy_question_id: string | null
          objective_id: string | null
          rationale: string | null
          sort_order: number
          stem: string
        }
        Insert: {
          assessment_id: string
          choices?: Json
          correct?: Json | null
          id?: string
          item_type?: string
          legacy_question_id?: string | null
          objective_id?: string | null
          rationale?: string | null
          sort_order?: number
          stem: string
        }
        Update: {
          assessment_id?: string
          choices?: Json
          correct?: Json | null
          id?: string
          item_type?: string
          legacy_question_id?: string | null
          objective_id?: string | null
          rationale?: string | null
          sort_order?: number
          stem?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_items_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_items_objective_id_fkey"
            columns: ["objective_id"]
            isOneToOne: false
            referencedRelation: "learning_objectives"
            referencedColumns: ["id"]
          },
        ]
      }
      assessments: {
        Row: {
          course_id: string
          created_at: string
          id: string
          kind: string
          module_id: string | null
          objective_ids: string[] | null
          pass_threshold: number
          time_limit_minutes: number | null
          title: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          kind: string
          module_id?: string | null
          objective_ids?: string[] | null
          pass_threshold?: number
          time_limit_minutes?: number | null
          title: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          kind?: string
          module_id?: string | null
          objective_ids?: string[] | null
          pass_threshold?: number
          time_limit_minutes?: number | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessments_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      boost_agent_conversations: {
        Row: {
          created_at: string
          id: string
          messages: Json
          module_key: string
          tenant_id: string
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          messages?: Json
          module_key: string
          tenant_id: string
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          messages?: Json
          module_key?: string
          tenant_id?: string
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "boost_agent_conversations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      boost_modules: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          name: string
          tagline: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          name: string
          tagline?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          name?: string
          tagline?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      course_needs_assessments: {
        Row: {
          citations: Json
          course_id: string
          created_at: string
          generated_by: string | null
          id: string
          inputs: Json
          output: Json
          version: number
        }
        Insert: {
          citations?: Json
          course_id: string
          created_at?: string
          generated_by?: string | null
          id?: string
          inputs?: Json
          output?: Json
          version?: number
        }
        Update: {
          citations?: Json
          course_id?: string
          created_at?: string
          generated_by?: string | null
          id?: string
          inputs?: Json
          output?: Json
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "course_needs_assessments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_publications: {
        Row: {
          course_id: string
          created_at: string
          id: string
          published_at: string
          published_by: string | null
          source: string
          status: string
          target_id: string | null
          target_type: string
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          published_at?: string
          published_by?: string | null
          source?: string
          status?: string
          target_id?: string | null
          target_type: string
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          published_at?: string
          published_by?: string | null
          source?: string
          status?: string
          target_id?: string | null
          target_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_publications_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          audience: string | null
          branding: Json
          certifier_group_id: string | null
          ceu_value: number | null
          contact_hours: number | null
          cover_image_url: string | null
          created_at: string
          created_by: string | null
          currency: string
          delivery_modes: string[]
          dependency_mode: string
          description: string | null
          id: string
          instructor_id: string | null
          language: string
          price_cents: number
          requires_needs_assessment: boolean
          rti_hours: number
          slug: string
          source: string
          status: string
          stripe_price_id: string | null
          tenant_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          audience?: string | null
          branding?: Json
          certifier_group_id?: string | null
          ceu_value?: number | null
          contact_hours?: number | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          delivery_modes?: string[]
          dependency_mode?: string
          description?: string | null
          id?: string
          instructor_id?: string | null
          language?: string
          price_cents?: number
          requires_needs_assessment?: boolean
          rti_hours?: number
          slug: string
          source?: string
          status?: string
          stripe_price_id?: string | null
          tenant_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          audience?: string | null
          branding?: Json
          certifier_group_id?: string | null
          ceu_value?: number | null
          contact_hours?: number | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          delivery_modes?: string[]
          dependency_mode?: string
          description?: string | null
          id?: string
          instructor_id?: string | null
          language?: string
          price_cents?: number
          requires_needs_assessment?: boolean
          rti_hours?: number
          slug?: string
          source?: string
          status?: string
          stripe_price_id?: string | null
          tenant_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_instructor_id_fkey"
            columns: ["instructor_id"]
            isOneToOne: false
            referencedRelation: "instructors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      eligibility_screenings: {
        Row: {
          course_id: string | null
          created_at: string
          id: string
          public_assistance: boolean
          qualified: boolean
          tenant_id: string
          underemployed: boolean
          unemployed: boolean
          user_id: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          id?: string
          public_assistance?: boolean
          qualified?: boolean
          tenant_id: string
          underemployed?: boolean
          unemployed?: boolean
          user_id: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          id?: string
          public_assistance?: boolean
          qualified?: boolean
          tenant_id?: string
          underemployed?: boolean
          unemployed?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "eligibility_screenings_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eligibility_screenings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      employees: {
        Row: {
          created_at: string
          department: string | null
          email: string | null
          full_name: string
          hire_date: string | null
          id: string
          job_title: string | null
          manager_user_id: string | null
          tenant_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          department?: string | null
          email?: string | null
          full_name: string
          hire_date?: string | null
          id?: string
          job_title?: string | null
          manager_user_id?: string | null
          tenant_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          department?: string | null
          email?: string | null
          full_name?: string
          hire_date?: string | null
          id?: string
          job_title?: string | null
          manager_user_id?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          certifier_badge_image_url: string | null
          certifier_credential_id: string | null
          certifier_verify_url: string | null
          ceu_awarded: number | null
          completed_at: string | null
          course_id: string
          created_at: string
          funding_source: string | null
          id: string
          payment_status: string
          started_at: string
          status: string
          stripe_session_id: string | null
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          certifier_badge_image_url?: string | null
          certifier_credential_id?: string | null
          certifier_verify_url?: string | null
          ceu_awarded?: number | null
          completed_at?: string | null
          course_id: string
          created_at?: string
          funding_source?: string | null
          id?: string
          payment_status?: string
          started_at?: string
          status?: string
          stripe_session_id?: string | null
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          certifier_badge_image_url?: string | null
          certifier_credential_id?: string | null
          certifier_verify_url?: string | null
          ceu_awarded?: number | null
          completed_at?: string | null
          course_id?: string
          created_at?: string
          funding_source?: string | null
          id?: string
          payment_status?: string
          started_at?: string
          status?: string
          stripe_session_id?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      external_courses: {
        Row: {
          ceu_value: number | null
          created_at: string
          deep_link_token: string | null
          external_id: string
          id: string
          metadata: Json
          provider: string
          tenant_id: string
          title: string
        }
        Insert: {
          ceu_value?: number | null
          created_at?: string
          deep_link_token?: string | null
          external_id: string
          id?: string
          metadata?: Json
          provider: string
          tenant_id: string
          title: string
        }
        Update: {
          ceu_value?: number | null
          created_at?: string
          deep_link_token?: string | null
          external_id?: string
          id?: string
          metadata?: Json
          provider?: string
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_courses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      gosprout_links: {
        Row: {
          created_at: string
          gosprout_program_url: string | null
          gosprout_username: string | null
          id: string
          last_launched_at: string | null
          notes: string | null
          status: string
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          gosprout_program_url?: string | null
          gosprout_username?: string | null
          id?: string
          last_launched_at?: string | null
          notes?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          gosprout_program_url?: string | null
          gosprout_username?: string | null
          id?: string
          last_launched_at?: string | null
          notes?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "gosprout_links_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      instructors: {
        Row: {
          bio: string | null
          certifications: Json
          created_at: string
          credentials: string | null
          display_name: string
          id: string
          photo_url: string | null
          tenant_id: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          bio?: string | null
          certifications?: Json
          created_at?: string
          credentials?: string | null
          display_name: string
          id?: string
          photo_url?: string | null
          tenant_id: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          bio?: string | null
          certifications?: Json
          created_at?: string
          credentials?: string | null
          display_name?: string
          id?: string
          photo_url?: string | null
          tenant_id?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "instructors_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_accounts: {
        Row: {
          created_at: string
          credentials_ref: string | null
          enabled: boolean
          id: string
          provider: string
          settings: Json
          tenant_id: string
        }
        Insert: {
          created_at?: string
          credentials_ref?: string | null
          enabled?: boolean
          id?: string
          provider: string
          settings?: Json
          tenant_id: string
        }
        Update: {
          created_at?: string
          credentials_ref?: string | null
          enabled?: boolean
          id?: string
          provider?: string
          settings?: Json
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_accounts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      job_descriptions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          qualifications: string | null
          responsibilities: string | null
          status: string
          summary: string | null
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          qualifications?: string | null
          responsibilities?: string | null
          status?: string
          summary?: string | null
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          qualifications?: string | null
          responsibilities?: string | null
          status?: string
          summary?: string | null
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_descriptions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      learners: {
        Row: {
          apprenticeship_program_id: string | null
          created_at: string
          id: string
          is_apprentice: boolean
          tenant_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          apprenticeship_program_id?: string | null
          created_at?: string
          id?: string
          is_apprentice?: boolean
          tenant_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          apprenticeship_program_id?: string | null
          created_at?: string
          id?: string
          is_apprentice?: boolean
          tenant_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learners_apprenticeship_program_id_fkey"
            columns: ["apprenticeship_program_id"]
            isOneToOne: false
            referencedRelation: "apprenticeship_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "learners_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_objectives: {
        Row: {
          bloom_verb: string | null
          course_id: string
          id: string
          sort_order: number
          text: string
        }
        Insert: {
          bloom_verb?: string | null
          course_id: string
          id?: string
          sort_order?: number
          text: string
        }
        Update: {
          bloom_verb?: string | null
          course_id?: string
          id?: string
          sort_order?: number
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_objectives_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          content: Json
          created_at: string
          duration_minutes: number | null
          id: string
          kind: string
          module_id: string
          objective_ids: string[] | null
          sort_order: number
          title: string
        }
        Insert: {
          content?: Json
          created_at?: string
          duration_minutes?: number | null
          id?: string
          kind: string
          module_id: string
          objective_ids?: string[] | null
          sort_order?: number
          title: string
        }
        Update: {
          content?: Json
          created_at?: string
          duration_minutes?: number | null
          id?: string
          kind?: string
          module_id?: string
          objective_ids?: string[] | null
          sort_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "lessons_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      live_attendance: {
        Row: {
          duration_seconds: number | null
          enrollment_id: string
          id: string
          joined_at: string | null
          left_at: string | null
          live_session_id: string
        }
        Insert: {
          duration_seconds?: number | null
          enrollment_id: string
          id?: string
          joined_at?: string | null
          left_at?: string | null
          live_session_id: string
        }
        Update: {
          duration_seconds?: number | null
          enrollment_id?: string
          id?: string
          joined_at?: string | null
          left_at?: string | null
          live_session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_attendance_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_attendance_live_session_id_fkey"
            columns: ["live_session_id"]
            isOneToOne: false
            referencedRelation: "live_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      live_sessions: {
        Row: {
          created_at: string
          end_at: string | null
          id: string
          lesson_id: string
          recording_url: string | null
          start_at: string
          zoom_meeting_id: string | null
        }
        Insert: {
          created_at?: string
          end_at?: string | null
          id?: string
          lesson_id: string
          recording_url?: string | null
          start_at: string
          zoom_meeting_id?: string | null
        }
        Update: {
          created_at?: string
          end_at?: string | null
          id?: string
          lesson_id?: string
          recording_url?: string | null
          start_at?: string
          zoom_meeting_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "live_sessions_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      module_prerequisites: {
        Row: {
          id: string
          min_quiz_score: number | null
          module_id: string
          required_module_id: string
        }
        Insert: {
          id?: string
          min_quiz_score?: number | null
          module_id: string
          required_module_id: string
        }
        Update: {
          id?: string
          min_quiz_score?: number | null
          module_id?: string
          required_module_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_prerequisites_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_prerequisites_required_module_id_fkey"
            columns: ["required_module_id"]
            isOneToOne: false
            referencedRelation: "modules"
            referencedColumns: ["id"]
          },
        ]
      }
      modules: {
        Row: {
          course_id: string
          created_at: string
          id: string
          sort_order: number
          summary: string | null
          title: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          sort_order?: number
          summary?: string | null
          title: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          sort_order?: number
          summary?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      org_chart_nodes: {
        Row: {
          created_at: string
          employee_id: string | null
          id: string
          parent_id: string | null
          sort_order: number
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          employee_id?: string | null
          id?: string
          parent_id?: string | null
          sort_order?: number
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          employee_id?: string | null
          id?: string
          parent_id?: string | null
          sort_order?: number
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_chart_nodes_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_chart_nodes_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "org_chart_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "org_chart_nodes_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      perform_goal_categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          tenant_id: string
          updated_at: string
          weight: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          tenant_id: string
          updated_at?: string
          weight?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          tenant_id?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "perform_goal_categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      perform_goals: {
        Row: {
          category_id: string | null
          created_at: string
          description: string | null
          due_date: string | null
          employee_id: string | null
          id: string
          owner_user_id: string | null
          status: string
          tenant_id: string
          title: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          employee_id?: string | null
          id?: string
          owner_user_id?: string | null
          status?: string
          tenant_id: string
          title: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          description?: string | null
          due_date?: string | null
          employee_id?: string | null
          id?: string
          owner_user_id?: string | null
          status?: string
          tenant_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "perform_goals_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "perform_goal_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perform_goals_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "perform_goals_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      perform_review_cycles: {
        Row: {
          created_at: string
          ends_at: string | null
          id: string
          name: string
          starts_at: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          ends_at?: string | null
          id?: string
          name: string
          starts_at?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          ends_at?: string | null
          id?: string
          name?: string
          starts_at?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "perform_review_cycles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
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
      progress: {
        Row: {
          attendance_seconds: number | null
          completed_at: string | null
          enrollment_id: string
          id: string
          lesson_id: string
          score: number | null
          status: string
        }
        Insert: {
          attendance_seconds?: number | null
          completed_at?: string | null
          enrollment_id: string
          id?: string
          lesson_id: string
          score?: number | null
          status?: string
        }
        Update: {
          attendance_seconds?: number | null
          completed_at?: string | null
          enrollment_id?: string
          id?: string
          lesson_id?: string
          score?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "progress_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      pulse_cadences: {
        Row: {
          active: boolean
          cadence: string
          created_at: string
          id: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          cadence?: string
          created_at?: string
          id?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          cadence?: string
          created_at?: string
          id?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pulse_cadences_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
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
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      review_queue: {
        Row: {
          due_at: string
          ease: number
          id: string
          interval_days: number
          last_reviewed_at: string | null
          question_id: string
          tenant_id: string | null
          user_id: string
        }
        Insert: {
          due_at?: string
          ease?: number
          id?: string
          interval_days?: number
          last_reviewed_at?: string | null
          question_id: string
          tenant_id?: string | null
          user_id: string
        }
        Update: {
          due_at?: string
          ease?: number
          id?: string
          interval_days?: number
          last_reviewed_at?: string | null
          question_id?: string
          tenant_id?: string | null
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
          {
            foreignKeyName: "review_queue_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      rti_completions: {
        Row: {
          completed_at: string
          course_id: string
          created_at: string
          id: string
          learner_id: string
          rti_hours: number
        }
        Insert: {
          completed_at?: string
          course_id: string
          created_at?: string
          id?: string
          learner_id: string
          rti_hours?: number
        }
        Update: {
          completed_at?: string
          course_id?: string
          created_at?: string
          id?: string
          learner_id?: string
          rti_hours?: number
        }
        Relationships: [
          {
            foreignKeyName: "rti_completions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rti_completions_learner_id_fkey"
            columns: ["learner_id"]
            isOneToOne: false
            referencedRelation: "learners"
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
      state_appointments: {
        Row: {
          created_at: string
          eligibility_id: string
          id: string
          scheduled_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          eligibility_id: string
          id?: string
          scheduled_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          eligibility_id?: string
          id?: string
          scheduled_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "state_appointments_eligibility_id_fkey"
            columns: ["eligibility_id"]
            isOneToOne: false
            referencedRelation: "eligibility_screenings"
            referencedColumns: ["id"]
          },
        ]
      }
      state_authorizations: {
        Row: {
          created_at: string
          etpl_status: string | null
          funding_notes: string | null
          id: string
          occupation: string
          state_code: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          etpl_status?: string | null
          funding_notes?: string | null
          id?: string
          occupation: string
          state_code: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          etpl_status?: string | null
          funding_notes?: string | null
          id?: string
          occupation?: string
          state_code?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "state_authorizations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      state_vouchers: {
        Row: {
          code: string
          course_id: string | null
          created_at: string
          id: string
          notes: string | null
          redeemed_at: string | null
          redeemed_by: string | null
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          code: string
          course_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          code?: string
          course_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          redeemed_at?: string | null
          redeemed_by?: string | null
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "state_vouchers_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "state_vouchers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      student_vault_items: {
        Row: {
          created_at: string
          file_url: string | null
          id: string
          kind: string
          metadata: Json
          source_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_url?: string | null
          id?: string
          kind: string
          metadata?: Json
          source_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_url?: string | null
          id?: string
          kind?: string
          metadata?: Json
          source_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      study_sessions: {
        Row: {
          content_area: Database["public"]["Enums"]["content_area"] | null
          correct_count: number
          finished_at: string | null
          id: string
          mode: Database["public"]["Enums"]["session_mode"]
          started_at: string
          tenant_id: string | null
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
          tenant_id?: string | null
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
          tenant_id?: string | null
          total_questions?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_sessions_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      survey_responses: {
        Row: {
          enrollment_id: string
          id: string
          responses: Json
          submitted_at: string
          survey_id: string
          user_id: string
        }
        Insert: {
          enrollment_id: string
          id?: string
          responses?: Json
          submitted_at?: string
          survey_id: string
          user_id: string
        }
        Update: {
          enrollment_id?: string
          id?: string
          responses?: Json
          submitted_at?: string
          survey_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_responses_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      surveys: {
        Row: {
          course_id: string
          created_at: string
          id: string
          kind: string
          schema: Json
          title: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          kind: string
          schema?: Json
          title: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          kind?: string
          schema?: Json
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "surveys_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_boost_modules: {
        Row: {
          boost_module_id: string
          created_at: string
          id: string
          status: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          boost_module_id: string
          created_at?: string
          id?: string
          status?: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          boost_module_id?: string
          created_at?: string
          id?: string
          status?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_boost_modules_boost_module_id_fkey"
            columns: ["boost_module_id"]
            isOneToOne: false
            referencedRelation: "boost_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_boost_modules_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_member_modules: {
        Row: {
          assigned_by: string | null
          boost_module_id: string
          created_at: string
          id: string
          tenant_member_id: string
        }
        Insert: {
          assigned_by?: string | null
          boost_module_id: string
          created_at?: string
          id?: string
          tenant_member_id: string
        }
        Update: {
          assigned_by?: string | null
          boost_module_id?: string
          created_at?: string
          id?: string
          tenant_member_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_member_modules_boost_module_id_fkey"
            columns: ["boost_module_id"]
            isOneToOne: false
            referencedRelation: "boost_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tenant_member_modules_tenant_member_id_fkey"
            columns: ["tenant_member_id"]
            isOneToOne: false
            referencedRelation: "tenant_members"
            referencedColumns: ["id"]
          },
        ]
      }
      tenant_members: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tenant_members_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          brand_primary: string | null
          brand_secondary: string | null
          created_at: string
          custom_domain: string | null
          id: string
          kind: string
          logo_asset_url: string | null
          logo_url: string | null
          name: string
          powered_by_boost_footer: boolean
          primary_color: string | null
          settings: Json
          slug: string
          tenant_type: string
          updated_at: string
          welcome_copy: string | null
        }
        Insert: {
          brand_primary?: string | null
          brand_secondary?: string | null
          created_at?: string
          custom_domain?: string | null
          id?: string
          kind?: string
          logo_asset_url?: string | null
          logo_url?: string | null
          name: string
          powered_by_boost_footer?: boolean
          primary_color?: string | null
          settings?: Json
          slug: string
          tenant_type?: string
          updated_at?: string
          welcome_copy?: string | null
        }
        Update: {
          brand_primary?: string | null
          brand_secondary?: string | null
          created_at?: string
          custom_domain?: string | null
          id?: string
          kind?: string
          logo_asset_url?: string | null
          logo_url?: string | null
          name?: string
          powered_by_boost_footer?: boolean
          primary_color?: string | null
          settings?: Json
          slug?: string
          tenant_type?: string
          updated_at?: string
          welcome_copy?: string | null
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
      webhook_deliveries: {
        Row: {
          delivered_at: string
          event: string
          id: string
          payload: Json
          response_body: string | null
          response_status: number | null
          webhook_id: string
        }
        Insert: {
          delivered_at?: string
          event: string
          id?: string
          payload: Json
          response_body?: string | null
          response_status?: number | null
          webhook_id: string
        }
        Update: {
          delivered_at?: string
          event?: string
          id?: string
          payload?: Json
          response_body?: string | null
          response_status?: number | null
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_deliveries_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "webhooks_outbound"
            referencedColumns: ["id"]
          },
        ]
      }
      webhooks_outbound: {
        Row: {
          created_at: string
          enabled: boolean
          events: string[]
          id: string
          secret: string
          target_url: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          events?: string[]
          id?: string
          secret: string
          target_url: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          events?: string[]
          id?: string
          secret?: string
          target_url?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhooks_outbound_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      work_products: {
        Row: {
          course_id: string
          id: string
          kind: string
          template: Json
          title: string
        }
        Insert: {
          course_id: string
          id?: string
          kind: string
          template?: Json
          title: string
        }
        Update: {
          course_id?: string
          id?: string
          kind?: string
          template?: Json
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_products_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_tenant_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _tenant_id: string
          _user_id: string
        }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      is_tenant_member: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
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
