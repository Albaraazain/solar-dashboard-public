
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
