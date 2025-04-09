-- File: supabase/migrations/20250411000000_add_quote_status.sql
ALTER TABLE quotes ADD COLUMN status TEXT NOT NULL DEFAULT 'draft';
CREATE INDEX idx_quotes_status ON quotes(status);
COMMENT ON COLUMN quotes.status IS 'Status of the quote: draft or final';

-- Function to ensure calculations are synced
CREATE OR REPLACE FUNCTION sync_quote_calculations()
RETURNS TRIGGER AS $$
BEGIN
  -- If calculations are empty but we have system size and bill_id
  IF (NEW.calculations IS NULL OR NEW.calculations = '{}'::jsonb) AND NEW.bill_id IS NOT NULL THEN
    -- Get yearly energy usage from bill
    DECLARE
      yearly_units FLOAT;
    BEGIN
      SELECT units_consumed * 12 INTO yearly_units
      FROM bills
      WHERE id = NEW.bill_id;
      
      IF yearly_units IS NOT NULL THEN
        -- Calculate quote details
        NEW.calculations := (SELECT generate_full_quote(yearly_units));
        
        -- Update system size and total cost from calculations
        NEW.system_size := (NEW.calculations->'system'->>'size')::float;
        NEW.total_cost := (NEW.calculations->'system'->'costs'->>'total')::float;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error calculating quote: %', SQLERRM;
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS before_quote_insert_update ON quotes;
CREATE TRIGGER before_quote_insert_update
BEFORE INSERT OR UPDATE ON quotes
FOR EACH ROW
EXECUTE FUNCTION sync_quote_calculations();