 
DECLARE 
    peak_split FLOAT := 0.42; -- From historical data analysis 
BEGIN 
    PERFORM validate_energy_input(monthly_units); 
    
    RETURN jsonb_build_object( 
        'monthly_usage', monthly_units, 
        'peak_usage', ROUND((monthly_units * peak_split)::numeric, 1), 
        'offpeak_usage', ROUND((monthly_units * (1 - peak_split))::numeric, 1), 
        'estimated_production', ROUND((monthly_units * 1.2)::numeric, 1), -- 20% overproduction 
        'efficiency_score', GREATEST(0.75, LEAST(0.95, (monthly_units / 1000)::numeric)), 
        'comparison_metrics', jsonb_build_object( 
            'regional_average', monthly_units * 0.85, 
            'efficient_homes', monthly_units * 0.6 
        ) 
    ); 
END; 
