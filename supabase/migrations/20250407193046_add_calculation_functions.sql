-- Core calculation functions
CREATE OR REPLACE FUNCTION calculate_system_size(yearly_units FLOAT)
RETURNS FLOAT AS $$
DECLARE
    PEAK_SUN_HOURS CONSTANT FLOAT := 4.5;
    PERFORMANCE_RATIO CONSTANT FLOAT := 0.75;
BEGIN
    RETURN CEIL(
        (yearly_units / 365) / 
        (PEAK_SUN_HOURS * PERFORMANCE_RATIO) * 1.5
    );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calculate_panel_details(system_size FLOAT)
RETURNS JSONB AS $$
DECLARE
    panel RECORD;
BEGIN
    SELECT * INTO panel 
    FROM panels 
    WHERE default_choice = TRUE 
    AND availability = TRUE
    LIMIT 1;

    RETURN jsonb_build_object(
        'brand', panel.brand,
        'count', CEIL((system_size * 1000) / panel.power),
        'power', panel.power,
        'price', panel.price
    );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_inverter_details(system_size FLOAT)
RETURNS JSONB AS $$
DECLARE
    inverter RECORD;
BEGIN
    SELECT * INTO inverter
    FROM inverters
    WHERE power >= system_size
    AND availability = TRUE
    ORDER BY power
    LIMIT 1;

    RETURN jsonb_build_object(
        'brand', inverter.brand,
        'power', inverter.power,
        'price', inverter.price
    );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calculate_costs(
    system_size FLOAT, 
    panel_count INT
) RETURNS JSONB AS $$
DECLARE
    bracket RECORD;
    net_metering_cost FLOAT;
    installation_cost FLOAT;
BEGIN
    SELECT * INTO bracket 
    FROM bracket_costs 
    WHERE system_size BETWEEN min_size AND max_size
    LIMIT 1;

    SELECT cost INTO net_metering_cost 
    FROM variable_costs 
    WHERE cost_name = 'Net Metering';

    SELECT cost INTO installation_cost 
    FROM variable_costs 
    WHERE cost_name = 'Installation Cost per Watt';

    RETURN jsonb_build_object(
        'net_metering', COALESCE(net_metering_cost, 15000),
        'installation', COALESCE(installation_cost, 25) * system_size * 1000,
        'dc_cable', COALESCE(bracket.dc_cable, 15000),
        'ac_cable', COALESCE(bracket.ac_cable, 10000),
        'accessories', COALESCE(bracket.accessories, 20000),
        'transport', COALESCE(
            (SELECT cost FROM variable_costs WHERE cost_name = 'Transport Cost' LIMIT 1), 
            5000
        )
    );
END;
$$ LANGUAGE plpgsql;

-- Composite quote generation function
CREATE OR REPLACE FUNCTION generate_full_quote(yearly_units FLOAT)
RETURNS JSONB AS $$
DECLARE
    system_size FLOAT;
    panel_info JSONB;
    inverter_info JSONB;
    cost_breakdown JSONB;
BEGIN
    PERFORM validate_quote_input(yearly_units);
    
    system_size := calculate_system_size(yearly_units);
    panel_info := calculate_panel_details(system_size);
    inverter_info := get_inverter_details(system_size);
    cost_breakdown := calculate_costs(system_size, (panel_info->>'count')::INT);

    RETURN jsonb_build_object(
        'system_size', system_size,
        'panel', panel_info,
        'inverter', inverter_info,
        'costs', cost_breakdown,
        'timestamp', NOW()
    );
END;
$$ LANGUAGE plpgsql;

-- Validation functions
CREATE OR REPLACE FUNCTION validate_quote_input(yearly_units FLOAT) 
RETURNS VOID AS $$
BEGIN
    IF yearly_units <= 0 THEN
        RAISE EXCEPTION 'Invalid yearly units: %', yearly_units
        USING HINT = 'Value must be greater than 0';
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION validate_system_size(size FLOAT) 
RETURNS VOID AS $$
BEGIN
    IF size < 1 OR size > 100 THEN
        RAISE EXCEPTION 'System size out of range: % kW', size
        USING HINT = 'Must be between 1-100 kW';
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger for price updates
CREATE OR REPLACE FUNCTION update_quote_costs()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE quotes
    SET cost_breakdown = calculate_costs(
        system_size, 
        (calculations->'panel'->>'count')::INT
    ),
    updated_at = NOW()
    WHERE panel_id = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER panel_price_update
AFTER UPDATE OF price ON panels
FOR EACH ROW EXECUTE FUNCTION update_quote_costs();
