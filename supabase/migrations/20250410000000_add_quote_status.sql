-- File: supabase/migrations/20250410000000_add_quote_status.sql
ALTER TABLE quotes ADD COLUMN status TEXT NOT NULL DEFAULT 'draft';
CREATE INDEX idx_quotes_status ON quotes(status);
COMMENT ON COLUMN quotes.status IS 'Status of the quote: draft or final';