-- Smart Incubator Room – Hospital Access Management System
-- Run this SQL in your Supabase SQL Editor to initialize the PostgreSQL schema and Row Level Security.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Employees Table
CREATE TABLE IF NOT EXISTS public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id text NOT NULL UNIQUE,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('Doctor', 'Nurse', 'Admin', 'Staff')),
  password_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_employees_employee_id ON public.employees (employee_id);
CREATE INDEX IF NOT EXISTS idx_employees_is_active ON public.employees (is_active);

-- 2. Access Logs Table
CREATE TABLE IF NOT EXISTS public.access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_ref uuid REFERENCES public.employees(id) ON DELETE SET NULL,
  employee_id text NOT NULL,
  employee_name text NOT NULL,
  role text NOT NULL,
  auth_method text NOT NULL DEFAULT 'Password' CHECK (auth_method = 'Password'),
  status text NOT NULL CHECK (status IN ('Granted', 'Denied')),
  reason text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_access_logs_created_at ON public.access_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_status ON public.access_logs (status);
CREATE INDEX IF NOT EXISTS idx_access_logs_employee_id ON public.access_logs (employee_id);

-- 3. Automatic updated_at Trigger on employees
CREATE OR REPLACE FUNCTION public.set_employees_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_employees_updated_at ON public.employees;
CREATE TRIGGER trg_employees_updated_at
  BEFORE UPDATE ON public.employees
  FOR EACH ROW
  EXECUTE FUNCTION public.set_employees_updated_at();

-- 4. Row Level Security (RLS)
-- Enable RLS on both tables so anon/public keys cannot directly read password_hash
-- or mutate employee records and audit logs. All verified backend API operations
-- run server-side using the SUPABASE_SERVICE_ROLE_KEY.
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_logs ENABLE ROW LEVEL SECURITY;

-- Backend grants: service_role is the only browser-excluded database role used
-- by this application. Browser roles receive no table privileges.
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.employees, public.access_logs TO service_role;
REVOKE ALL ON TABLE public.employees, public.access_logs FROM anon;
REVOKE ALL ON TABLE public.employees, public.access_logs FROM authenticated;

-- Deny all direct anon/authenticated browser access by default (service_role bypasses RLS).
DROP POLICY IF EXISTS "Deny public access to employees" ON public.employees;
CREATE POLICY "Deny public access to employees"
  ON public.employees
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "Deny public access to access_logs" ON public.access_logs;
CREATE POLICY "Deny public access to access_logs"
  ON public.access_logs
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);
