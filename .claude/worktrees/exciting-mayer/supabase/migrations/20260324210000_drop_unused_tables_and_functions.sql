-- =============================================================
-- Migration: Drop unused tables, triggers, and functions
-- Tables all have 0 rows and no active frontend usage
-- =============================================================

-- 1. Drop produced_vehicles family (0 rows, frontend uses quality_inspections)
DROP TRIGGER IF EXISTS handle_produced_vehicles_updated_at ON public.produced_vehicles;
DROP TRIGGER IF EXISTS vehicle_history_trigger ON public.produced_vehicles;

DROP TABLE IF EXISTS public.vehicle_faults CASCADE;
DROP TABLE IF EXISTS public.vehicle_history CASCADE;
DROP TABLE IF EXISTS public.produced_vehicles CASCADE;

DROP FUNCTION IF EXISTS public.update_produced_vehicles_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.log_vehicle_history() CASCADE;
DROP FUNCTION IF EXISTS public.update_vehicle_status(uuid, text, text) CASCADE;

-- 2. Drop dead log/notification tables (0 rows, no frontend references)
DROP TABLE IF EXISTS public.document_notifications CASCADE;
DROP TABLE IF EXISTS public.document_access_logs CASCADE;
DROP TABLE IF EXISTS public.task_audit_logs CASCADE;
