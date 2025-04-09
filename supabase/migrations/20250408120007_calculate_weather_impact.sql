
DECLARE
    customer_address TEXT;
    region TEXT := 'Central Pakistan'; -- Default region
BEGIN
    -- Get the customer's address
    SELECT address INTO customer_address
    FROM customers
    WHERE id = customer_id;
    
    -- If we have an address, attempt to determine which region of Pakistan
    IF customer_address IS NOT NULL THEN
        -- Basic region detection based on keywords in address
        -- This would need to be enhanced with more comprehensive mapping
        IF customer_address ILIKE '%karachi%' OR customer_address ILIKE '%hyderabad%' THEN
            region := 'Southern Pakistan';
        ELSIF customer_address ILIKE '%lahore%' OR customer_address ILIKE '%faisalabad%' OR 
              customer_address ILIKE '%gujranwala%' OR customer_address ILIKE '%sialkot%' THEN
            region := 'Eastern Pakistan';
        ELSIF customer_address ILIKE '%islamabad%' OR customer_address ILIKE '%rawalpindi%' THEN
            region := 'Northern Pakistan';
        ELSIF customer_address ILIKE '%peshawar%' OR customer_address ILIKE '%quetta%' THEN
            region := 'Western Pakistan';
        END IF;
    END IF;
    
    -- Return solar data based on region in Pakistan
    -- Values here are examples and should be replaced with actual data for each region
    CASE region
        WHEN 'Northern Pakistan' THEN
            RETURN jsonb_build_object(
                'solar_intensity', 4.7,
                'annual_sunshine_hours', 2800,
                'seasonal_variation', jsonb_build_object(
                    'summer', 1.2,
                    'winter', 0.6,
                    'spring', 0.9,
                    'fall', 0.8
                ),
                'region', region
            );
        WHEN 'Southern Pakistan' THEN
            RETURN jsonb_build_object(
                'solar_intensity', 5.4,
                'annual_sunshine_hours', 3300,
                'seasonal_variation', jsonb_build_object(
                    'summer', 1.3,
                    'winter', 0.85,
                    'spring', 1.0,
                    'fall', 0.95
                ),
                'region', region
            );
        WHEN 'Eastern Pakistan' THEN
            RETURN jsonb_build_object(
                'solar_intensity', 5.0,
                'annual_sunshine_hours', 3000,
                'seasonal_variation', jsonb_build_object(
                    'summer', 1.25,
                    'winter', 0.7,
                    'spring', 0.95,
                    'fall', 0.9
                ),
                'region', region
            );
        WHEN 'Western Pakistan' THEN
            RETURN jsonb_build_object(
                'solar_intensity', 5.2,
                'annual_sunshine_hours', 3200,
                'seasonal_variation', jsonb_build_object(
                    'summer', 1.3,
                    'winter', 0.75,
                    'spring', 1.0,
                    'fall', 0.9
                ),
                'region', region
            );
        ELSE -- Central Pakistan (default)
            RETURN jsonb_build_object(
                'solar_intensity', 5.1,
                'annual_sunshine_hours', 3100,
                'seasonal_variation', jsonb_build_object(
                    'summer', 1.25,
                    'winter', 0.7,
                    'spring', 0.95,
                    'fall', 0.9
                ),
                'region', region
            );
    END CASE;
END;
