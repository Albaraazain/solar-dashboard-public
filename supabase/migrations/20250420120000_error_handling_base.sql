BEGIN;

ALTER TABLE quotes 
ADD COLUMN calculation_version INT NOT NULL DEFAULT 1,
ADD COLUMN calculation_status VARCHAR(32) NOT NULL DEFAULT 'pending',
ADD COLUMN last_error JSONB;

CREATE TABLE calculation_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quote_id UUID REFERENCES quotes(id),
    attempt_number INT NOT NULL,
    status VARCHAR(32) NOT NULL,
    error_details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    calculation_version INT NOT NULL
);

CREATE INDEX idx_calculation_audit_quote_id ON calculation_audit(quote_id);
CREATE INDEX idx_calculation_audit_version ON calculation_audit(calculation_version);

COMMIT;