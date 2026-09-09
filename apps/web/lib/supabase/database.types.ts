export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
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
  public: {
    Tables: {
      album_exports: {
        Row: {
          attempt_count: number
          byte_size: number | null
          completed_at: string | null
          created_at: string
          estimated_bytes: number
          event_id: string
          expires_at: string | null
          id: string
          last_error_code: string | null
          locked_at: string | null
          locked_until: string | null
          missing_count: number
          next_attempt_at: string | null
          notified_at: string | null
          notify_attempts: number
          photo_count: number
          source_hash: string
          started_at: string | null
          status: string
          storage_path: string | null
          tus_upload_url: string | null
        }
        Insert: {
          attempt_count?: number
          byte_size?: number | null
          completed_at?: string | null
          created_at?: string
          estimated_bytes?: number
          event_id: string
          expires_at?: string | null
          id?: string
          last_error_code?: string | null
          locked_at?: string | null
          locked_until?: string | null
          missing_count?: number
          next_attempt_at?: string | null
          notified_at?: string | null
          notify_attempts?: number
          photo_count: number
          source_hash: string
          started_at?: string | null
          status?: string
          storage_path?: string | null
          tus_upload_url?: string | null
        }
        Update: {
          attempt_count?: number
          byte_size?: number | null
          completed_at?: string | null
          created_at?: string
          estimated_bytes?: number
          event_id?: string
          expires_at?: string | null
          id?: string
          last_error_code?: string | null
          locked_at?: string | null
          locked_until?: string | null
          missing_count?: number
          next_attempt_at?: string | null
          notified_at?: string | null
          notify_attempts?: number
          photo_count?: number
          source_hash?: string
          started_at?: string | null
          status?: string
          storage_path?: string | null
          tus_upload_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "album_exports_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      early_couple_applications: {
        Row: {
          agreement_accepted_at: string
          created_at: string
          email: string
          event_id: string | null
          first_call_at: string | null
          first_call_status: string
          founder_notes: string | null
          guest_count_range: string
          id: string
          locale: string
          name: string
          partner_name: string | null
          referrer: string | null
          retention_until: string
          second_call_at: string | null
          second_call_status: string
          status: string
          updated_at: string
          user_id: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          wedding_date: string
          wedding_location: string
          why_interested: string
        }
        Insert: {
          agreement_accepted_at?: string
          created_at?: string
          email: string
          event_id?: string | null
          first_call_at?: string | null
          first_call_status?: string
          founder_notes?: string | null
          guest_count_range: string
          id?: string
          locale: string
          name: string
          partner_name?: string | null
          referrer?: string | null
          retention_until?: string
          second_call_at?: string | null
          second_call_status?: string
          status?: string
          updated_at?: string
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          wedding_date: string
          wedding_location: string
          why_interested: string
        }
        Update: {
          agreement_accepted_at?: string
          created_at?: string
          email?: string
          event_id?: string | null
          first_call_at?: string | null
          first_call_status?: string
          founder_notes?: string | null
          guest_count_range?: string
          id?: string
          locale?: string
          name?: string
          partner_name?: string | null
          referrer?: string | null
          retention_until?: string
          second_call_at?: string | null
          second_call_status?: string
          status?: string
          updated_at?: string
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          wedding_date?: string
          wedding_location?: string
          why_interested?: string
        }
        Relationships: [
          {
            foreignKeyName: "early_couple_applications_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_grants: {
        Row: {
          event_id: string
          granted_at: string
          granted_by: string | null
          id: string
          note: string | null
          reason: string
          revoked_at: string | null
        }
        Insert: {
          event_id: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          note?: string | null
          reason: string
          revoked_at?: string | null
        }
        Update: {
          event_id?: string
          granted_at?: string
          granted_by?: string | null
          id?: string
          note?: string | null
          reason?: string
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_grants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          capture_end_at: string
          capture_start_at: string
          cover_path: string | null
          created_at: string
          creation_key: string | null
          event_name: string
          guests_can_view: boolean
          id: string
          locale: string
          owner_id: string
          reveal_at: string
          reveal_mode: Database["public"]["Enums"]["reveal_mode"]
          shots_per_participant: number
          slug: string
          time_zone: string
          updated_at: string
        }
        Insert: {
          capture_end_at: string
          capture_start_at: string
          cover_path?: string | null
          created_at?: string
          creation_key?: string | null
          event_name: string
          guests_can_view?: boolean
          id?: string
          locale?: string
          owner_id: string
          reveal_at: string
          reveal_mode?: Database["public"]["Enums"]["reveal_mode"]
          shots_per_participant?: number
          slug: string
          time_zone?: string
          updated_at?: string
        }
        Update: {
          capture_end_at?: string
          capture_start_at?: string
          cover_path?: string | null
          created_at?: string
          creation_key?: string | null
          event_name?: string
          guests_can_view?: boolean
          id?: string
          locale?: string
          owner_id?: string
          reveal_at?: string
          reveal_mode?: Database["public"]["Enums"]["reveal_mode"]
          shots_per_participant?: number
          slug?: string
          time_zone?: string
          updated_at?: string
        }
        Relationships: []
      }
      participants: {
        Row: {
          display_name: string
          event_id: string
          id: string
          joined_at: string
          last_seen_at: string
          session_token_hash: string
          user_id: string | null
        }
        Insert: {
          display_name: string
          event_id: string
          id?: string
          joined_at?: string
          last_seen_at?: string
          session_token_hash: string
          user_id?: string | null
        }
        Update: {
          display_name?: string
          event_id?: string
          id?: string
          joined_at?: string
          last_seen_at?: string
          session_token_hash?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "participants_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      photos: {
        Row: {
          byte_size: number | null
          created_at: string
          deleted_at: string | null
          event_id: string
          height: number | null
          hidden_at: string | null
          id: string
          idempotency_key: string | null
          mime_type: string | null
          participant_id: string
          status: Database["public"]["Enums"]["photo_status"]
          storage_path: string
          taken_at: string | null
          thumb_path: string
          view_path: string | null
          width: number | null
        }
        Insert: {
          byte_size?: number | null
          created_at?: string
          deleted_at?: string | null
          event_id: string
          height?: number | null
          hidden_at?: string | null
          id?: string
          idempotency_key?: string | null
          mime_type?: string | null
          participant_id: string
          status?: Database["public"]["Enums"]["photo_status"]
          storage_path: string
          taken_at?: string | null
          thumb_path: string
          view_path?: string | null
          width?: number | null
        }
        Update: {
          byte_size?: number | null
          created_at?: string
          deleted_at?: string | null
          event_id?: string
          height?: number | null
          hidden_at?: string | null
          id?: string
          idempotency_key?: string | null
          mime_type?: string | null
          participant_id?: string
          status?: Database["public"]["Enums"]["photo_status"]
          storage_path?: string
          taken_at?: string | null
          thumb_path?: string
          view_path?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "photos_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "photos_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          id: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      purchases: {
        Row: {
          amount_minor: number | null
          billing_address: string | null
          billing_city: string | null
          billing_country_code: string | null
          billing_email: string | null
          billing_name: string | null
          billing_post_code: string | null
          billing_tax_number: string | null
          billing_type: string | null
          billingo_cancellation_document_id: number | null
          billingo_document_id: number | null
          billingo_invoice_number: string | null
          billingo_partner_id: number | null
          created_at: string
          currency: string | null
          early_performance_consent_at: string | null
          event_id: string | null
          expired_at: string | null
          failed_at: string | null
          id: string
          invoice_attempts: number
          invoice_cancelled_at: string | null
          invoice_issued_at: string | null
          invoice_last_error: string | null
          invoice_next_attempt_at: string | null
          invoice_sent_at: string | null
          invoice_status: Database["public"]["Enums"]["invoice_status"]
          invoicing_started_at: string | null
          owner_id: string | null
          paid_at: string | null
          refunded_at: string | null
          settlement: string
          status: Database["public"]["Enums"]["purchase_status"]
          stripe_checkout_session_id: string
          stripe_customer_id: string | null
          stripe_payment_intent_id: string | null
          terms_accepted_at: string | null
          terms_version: string | null
        }
        Insert: {
          amount_minor?: number | null
          billing_address?: string | null
          billing_city?: string | null
          billing_country_code?: string | null
          billing_email?: string | null
          billing_name?: string | null
          billing_post_code?: string | null
          billing_tax_number?: string | null
          billing_type?: string | null
          billingo_cancellation_document_id?: number | null
          billingo_document_id?: number | null
          billingo_invoice_number?: string | null
          billingo_partner_id?: number | null
          created_at?: string
          currency?: string | null
          early_performance_consent_at?: string | null
          event_id?: string | null
          expired_at?: string | null
          failed_at?: string | null
          id?: string
          invoice_attempts?: number
          invoice_cancelled_at?: string | null
          invoice_issued_at?: string | null
          invoice_last_error?: string | null
          invoice_next_attempt_at?: string | null
          invoice_sent_at?: string | null
          invoice_status?: Database["public"]["Enums"]["invoice_status"]
          invoicing_started_at?: string | null
          owner_id?: string | null
          paid_at?: string | null
          refunded_at?: string | null
          settlement?: string
          status?: Database["public"]["Enums"]["purchase_status"]
          stripe_checkout_session_id: string
          stripe_customer_id?: string | null
          stripe_payment_intent_id?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
        }
        Update: {
          amount_minor?: number | null
          billing_address?: string | null
          billing_city?: string | null
          billing_country_code?: string | null
          billing_email?: string | null
          billing_name?: string | null
          billing_post_code?: string | null
          billing_tax_number?: string | null
          billing_type?: string | null
          billingo_cancellation_document_id?: number | null
          billingo_document_id?: number | null
          billingo_invoice_number?: string | null
          billingo_partner_id?: number | null
          created_at?: string
          currency?: string | null
          early_performance_consent_at?: string | null
          event_id?: string | null
          expired_at?: string | null
          failed_at?: string | null
          id?: string
          invoice_attempts?: number
          invoice_cancelled_at?: string | null
          invoice_issued_at?: string | null
          invoice_last_error?: string | null
          invoice_next_attempt_at?: string | null
          invoice_sent_at?: string | null
          invoice_status?: Database["public"]["Enums"]["invoice_status"]
          invoicing_started_at?: string | null
          owner_id?: string | null
          paid_at?: string | null
          refunded_at?: string | null
          settlement?: string
          status?: Database["public"]["Enums"]["purchase_status"]
          stripe_checkout_session_id?: string
          stripe_customer_id?: string | null
          stripe_payment_intent_id?: string | null
          terms_accepted_at?: string | null
          terms_version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchases_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          key: string
          request_count: number
          updated_at: string
          window_started_at: string
        }
        Insert: {
          key: string
          request_count: number
          updated_at?: string
          window_started_at: string
        }
        Update: {
          key?: string
          request_count?: number
          updated_at?: string
          window_started_at?: string
        }
        Relationships: []
      }
      stripe_checkout_attempts: {
        Row: {
          attempt_id: string
          created_at: string
          event_id: string
          expires_at: string
          terms_accepted_at: string
        }
        Insert: {
          attempt_id?: string
          created_at?: string
          event_id: string
          expires_at: string
          terms_accepted_at: string
        }
        Update: {
          attempt_id?: string
          created_at?: string
          event_id?: string
          expires_at?: string
          terms_accepted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_checkout_attempts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      stripe_webhook_events: {
        Row: {
          id: string
          processed_at: string | null
          received_at: string
          type: string
        }
        Insert: {
          id: string
          processed_at?: string | null
          received_at?: string
          type: string
        }
        Update: {
          id?: string
          processed_at?: string | null
          received_at?: string
          type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      album_export_cron_jobs: {
        Args: never
        Returns: {
          active: boolean
          jobname: string
          schedule: string
        }[]
      }
      album_export_status: {
        Args: { p_event_id: string }
        Returns: {
          attempt_count: number
          byte_size: number | null
          completed_at: string | null
          created_at: string
          estimated_bytes: number
          event_id: string
          expires_at: string | null
          id: string
          last_error_code: string | null
          locked_at: string | null
          locked_until: string | null
          missing_count: number
          next_attempt_at: string | null
          notified_at: string | null
          notify_attempts: number
          photo_count: number
          source_hash: string
          started_at: string | null
          status: string
          storage_path: string | null
          tus_upload_url: string | null
        }
        SetofOptions: {
          from: "*"
          to: "album_exports"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      checkout_attempt_rotate_before: { Args: never; Returns: string }
      claim_album_export: {
        Args: { p_lease?: string }
        Returns: {
          attempt_count: number
          byte_size: number | null
          completed_at: string | null
          created_at: string
          estimated_bytes: number
          event_id: string
          expires_at: string | null
          id: string
          last_error_code: string | null
          locked_at: string | null
          locked_until: string | null
          missing_count: number
          next_attempt_at: string | null
          notified_at: string | null
          notify_attempts: number
          photo_count: number
          source_hash: string
          started_at: string | null
          status: string
          storage_path: string | null
          tus_upload_url: string | null
        }
        SetofOptions: {
          from: "*"
          to: "album_exports"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_purchase_invoice: {
        Args: { p_purchase_id: string }
        Returns: boolean
      }
      claim_purchase_invoice_cancellation: {
        Args: { p_purchase_id: string }
        Returns: boolean
      }
      commit_shot: {
        Args: {
          p_byte_size: number
          p_height: number
          p_photo_id: string
          p_taken_at: string
          p_token_hash: string
          p_width: number
        }
        Returns: {
          committed: boolean
          shots_remaining: number
        }[]
      }
      complete_album_export: {
        Args: {
          p_byte_size: number
          p_id: string
          p_missing_count?: number
          p_storage_path: string
        }
        Returns: {
          attempt_count: number
          byte_size: number | null
          completed_at: string | null
          created_at: string
          estimated_bytes: number
          event_id: string
          expires_at: string | null
          id: string
          last_error_code: string | null
          locked_at: string | null
          locked_until: string | null
          missing_count: number
          next_attempt_at: string | null
          notified_at: string | null
          notify_attempts: number
          photo_count: number
          source_hash: string
          started_at: string | null
          status: string
          storage_path: string | null
          tus_upload_url: string | null
        }
        SetofOptions: {
          from: "*"
          to: "album_exports"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      consume_rate_limit: {
        Args: { p_key: string; p_limit: number; p_window_seconds: number }
        Returns: boolean
      }
      event_gallery_by_slug: {
        Args: { p_slug: string }
        Returns: {
          created_at: string
          height: number
          id: string
          storage_path: string
          thumb_path: string
          uploader_name: string
          view_path: string
          width: number
        }[]
      }
      event_guest_state: {
        Args: { p_slug: string; p_token_hash: string }
        Returns: {
          can_capture: boolean
          can_guest_view_gallery: boolean
          capture_end_at: string
          capture_start_at: string
          cover_path: string
          display_name: string
          event_name: string
          guests_can_view: boolean
          host_name: string
          id: string
          locale: string
          participant_id: string
          participant_limit_reached: boolean
          photo_count: number
          reveal_at: string
          reveal_mode: Database["public"]["Enums"]["reveal_mode"]
          shots_per_participant: number
          shots_remaining: number
          slug: string
          time_zone: string
        }[]
      }
      event_is_full_plan: { Args: { p_event_id: string }; Returns: boolean }
      event_participant_count_capped: {
        Args: { p_cap: number; p_event_id: string }
        Returns: number
      }
      event_participant_quota: {
        Args: { p_event_id: string }
        Returns: {
          participant_count: number
          participant_limit: number
          plan_source: string
          unlimited: boolean
        }[]
      }
      event_plan_source: { Args: { p_event_id: string }; Returns: string }
      event_ready_photo_bytes: { Args: { p_event_id: string }; Returns: number }
      fail_album_export: {
        Args: { p_code: string; p_id: string; p_retry: boolean }
        Returns: {
          attempt_count: number
          byte_size: number | null
          completed_at: string | null
          created_at: string
          estimated_bytes: number
          event_id: string
          expires_at: string | null
          id: string
          last_error_code: string | null
          locked_at: string | null
          locked_until: string | null
          missing_count: number
          next_attempt_at: string | null
          notified_at: string | null
          notify_attempts: number
          photo_count: number
          source_hash: string
          started_at: string | null
          status: string
          storage_path: string | null
          tus_upload_url: string | null
        }
        SetofOptions: {
          from: "*"
          to: "album_exports"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      free_participant_limit: { Args: never; Returns: number }
      grant_event_plan: {
        Args: {
          p_event_slug: string
          p_granted_by?: string
          p_note?: string
          p_reason: string
        }
        Returns: {
          already_active: boolean
          grant_id: string
          granted_event_id: string
        }[]
      }
      heartbeat_album_export: {
        Args: { p_id: string; p_lease?: string; p_tus_upload_url?: string }
        Returns: boolean
      }
      host_participant: {
        Args: {
          p_event_id: string
          p_name: string
          p_token_hash: string
          p_user_id: string
        }
        Returns: {
          participant_id: string
          token_hash: string
        }[]
      }
      invoice_cron_jobs: {
        Args: never
        Returns: {
          active: boolean
          jobname: string
          schedule: string
        }[]
      }
      is_admin: { Args: never; Returns: boolean }
      join_event: {
        Args: { p_name: string; p_slug: string; p_token_hash: string }
        Returns: {
          cap_reached: boolean
          display_name: string
          participant_id: string
        }[]
      }
      my_frames: {
        Args: { p_event_id: string; p_token_hash: string }
        Returns: {
          frame_index: number
          photo_id: string
          thumb_path: string
        }[]
      }
      owned_events_with_previews: {
        Args: never
        Returns: {
          capture_end_at: string
          capture_start_at: string
          cover_path: string
          created_at: string
          event_name: string
          guests_can_view: boolean
          id: string
          is_full_plan: boolean
          locale: string
          participant_count: number
          photo_count: number
          previews: string[]
          reveal_at: string
          reveal_mode: Database["public"]["Enums"]["reveal_mode"]
          shots_per_participant: number
          slug: string
          time_zone: string
        }[]
      }
      participant_shots_used: {
        Args: { p_participant_id: string }
        Returns: number
      }
      release_shot: {
        Args: { p_photo_id: string; p_token_hash: string }
        Returns: undefined
      }
      request_album_export: {
        Args: {
          p_estimated_bytes: number
          p_event_id: string
          p_photo_count: number
          p_source_hash: string
        }
        Returns: {
          attempt_count: number
          byte_size: number | null
          completed_at: string | null
          created_at: string
          estimated_bytes: number
          event_id: string
          expires_at: string | null
          id: string
          last_error_code: string | null
          locked_at: string | null
          locked_until: string | null
          missing_count: number
          next_attempt_at: string | null
          notified_at: string | null
          notify_attempts: number
          photo_count: number
          source_hash: string
          started_at: string | null
          status: string
          storage_path: string | null
          tus_upload_url: string | null
        }
        SetofOptions: {
          from: "*"
          to: "album_exports"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reserve_event_checkout: {
        Args: {
          p_event_id: string
          p_terms_accepted_at: string
          p_ttl_seconds?: number
        }
        Returns: {
          attempt_id: string
          expires_at: string
          terms_accepted_at: string
        }[]
      }
      reserve_shot: {
        Args: {
          p_event_id: string
          p_idempotency_key: string
          p_token_hash: string
        }
        Returns: {
          photo_id: string
          refusal: string
          shots_remaining: number
          storage_path: string
          thumb_path: string
          view_path: string
        }[]
      }
      revoke_event_plan: {
        Args: { p_event_slug: string; p_note?: string }
        Returns: boolean
      }
      shot_reservation_ttl: { Args: never; Returns: string }
      sweep_album_exports: {
        Args: never
        Returns: {
          expired: number
          failed: number
          released: number
        }[]
      }
    }
    Enums: {
      app_role: "user" | "admin"
      invoice_status:
        | "not_started"
        | "pending"
        | "processing"
        | "issued"
        | "send_failed"
        | "failed"
        | "blocked"
        | "cancellation_pending"
        | "cancelled"
      photo_status: "pending" | "ready"
      purchase_status: "pending" | "paid" | "refunded" | "failed" | "expired"
      reveal_mode: "instant" | "event_end" | "custom"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      app_role: ["user", "admin"],
      invoice_status: [
        "not_started",
        "pending",
        "processing",
        "issued",
        "send_failed",
        "failed",
        "blocked",
        "cancellation_pending",
        "cancelled",
      ],
      photo_status: ["pending", "ready"],
      purchase_status: ["pending", "paid", "refunded", "failed", "expired"],
      reveal_mode: ["instant", "event_end", "custom"],
    },
  },
} as const

