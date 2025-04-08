-- Comprehensive Quote Generation
CREATE OR REPLACE FUNCTION generate_full_quote(bill_id UUID)
RETURNS JSONB AS $$
DECLARE
    bill_record RECORD;
    system_size FLOAT;
    panel_info JSONB;
    inverter_info JSONB;
    cost_breakdown JSONB;
    energy_details JSONB;
    weather_impact JSONB;
    roof_requirements JSONB;
    battery_recommendation JSONB;
BEGIN
    -- Get bill and customer details
    SELECT * INTO bill_record 
    FROM bills 
    WHERE id = bill_id;
    
    PERFORM validate_quote_input(bill_record.units_consumed * 12);

    -- Core system calculations
    system_size := calculate_system_size(bill_record.units_consumed * 12);
    PERFORM validate_system_size(system_size);
    panel_info := calculate_panel_details(system_size);
    inverter_info := get_inverter_details(system_size);
    cost_breakdown := calculate_costs(system_size, (panel_info->>'count')::INT);

    -- New card-specific calculations
    energy_details := calculate_energy_details(bill_record.units_consumed);
    weather_impact := calculate_weather_impact(bill_record.location_id);
    roof_requirements := calculate_roof_requirements(system_size, (panel_info->>'id')::UUID);
    battery_recommendation := calculate_battery_recommendation(
        bill_record.units_consumed / 30  -- Convert monthly to daily usage
    );

    RETURN jsonb_build_object(
        'system', jsonb_build_object(
            'size', system_size,
            'panel', panel_info,
            'inverter', inverter_info,
            'costs', cost_breakdown
        ),
        'energy', energy_details,
        'weather', weather_impact,
        'roof', roof_requirements,
        'battery', battery_recommendation,
        'metadata', jsonb_build_object(
            'currency', 'EGP',
            'valid_until', NOW() + INTERVAL '7 days',
            'generated_at', NOW()
        )
    );
END;
$$ LANGUAGE plpgsql;

-- Add index for quote performance
CREATE INDEX IF NOT EXISTS idx_quotes_generated_at ON quotes USING btree (created_at);
