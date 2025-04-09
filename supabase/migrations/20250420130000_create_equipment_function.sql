BEGIN;

CREATE OR REPLACE FUNCTION public.get_equipment_data()
RETURNS TABLE (
  panels JSONB[],
  inverters JSONB[],
  structure_types JSONB[],
  bracket_costs JSONB[],
  variable_costs JSONB[]
)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT
    ARRAY(SELECT to_jsonb(p) FROM panels p) AS panels,
    ARRAY(SELECT to_jsonb(i) FROM inverters i) AS inverters,
    ARRAY(SELECT to_jsonb(s) FROM structure_types s) AS structure_types,
    ARRAY(SELECT to_jsonb(b) FROM bracket_costs b) AS bracket_costs,
    ARRAY(SELECT to_jsonb(v) FROM variable_costs v) AS variable_costs
$$;

COMMENT ON FUNCTION public.get_equipment_data() IS 'Returns all equipment data in a single call';

GRANT EXECUTE ON FUNCTION public.get_equipment_data() TO anon;

COMMIT;