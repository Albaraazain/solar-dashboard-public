import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.8';

// Database models
interface Panel {
  brand: string;
  power: number;
  price: number;
  default_choice: boolean;
}

interface Inverter {
  brand: string;
  power: number;
  price: number;
}

// Response models
interface PanelOption {
  brand: string;
  power: number;
  count: number;
  roofArea: number;
  totalCost: number;
  defaultChoice: boolean;
}

interface InverterOption {
  brand: string;
  power: number;
  count: number;
  totalCost: number;
}

interface SystemSizingResponse {
  systemSize: number;
  recommendedRange: {
    minimum: number;
    recommended: number;
    maximum: number;
  };
  efficiencyFactors: {
    systemEfficiency: number;
    irradiance: number;
    direction: number;
    roofType: number;
    shading: number;
    temperature: number;
    inverter: number;
  };
  equipment: {
    panelOptions: PanelOption[];
    inverters: InverterOption[];
    selectedInverter: InverterOption;
  };
  costs: {
    panels: number;
    inverter: number;
    dcCable: number;
    acCable: number;
    mounting: number;
    installation: number;
    netMetering: number;
    transport: number;
    total: number;
  };
  roof: {
    required_area: number;
    layout_efficiency: number;
    optimal_orientation: string;
    shading_impact: number;
  };
  battery: {
    recommended_capacity: number;
    autonomy_days: number;
    estimated_cost: number;
    efficiency_rating: number;
    lifespan_years: number;
  };
  production: {
    daily: number;
    monthly: number;
    annual: number;
    byMonth: number[];
    peakSunHours: number;
  };
  consumption: {
    monthly: number;
    peak: {
      percentage: number;
      kWh: number;
      time: string;
    };
    offPeak: number;
  };
  weather: {
    sunHours: number;
    efficiency: number;
    temperatureImpact: number;
    annualProduction: number;
  };
  metadata: {
    calculationVersion: string;
    calculationDate: string;
    location: string;
    roofDirection: string;
    roofType: string;
    shading: string;
  };
}

// Custom error types
class SolarSizingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SolarSizingError';
  }
}

class DatabaseError extends SolarSizingError {
  constructor(message: string) {
    super(`Database error: ${message}`);
    this.name = 'DatabaseError';
  }
}
// Validation types and utilities
interface SystemSizingInput {
  monthlyUsage: number;
  location?: LocationType;
  roofDirection?: DirectionType;
  roofType?: RoofType;
  shading?: ShadingType;
  forceSize?: number;
}

// Utility functions for calculations
function roundToHalf(value: number): number {
  return Math.ceil(value * 2) / 2;
}

function calculatePanelCount(systemSizeKW: number, panelPowerW: number): number {
  return Math.ceil(systemSizeKW * 1000 / panelPowerW);
}

function calculateRoofArea(panelCount: number): number {
  return Math.round(panelCount * AREA_PER_PANEL);
}

function calculateCableLength(roofArea: number): number {
  return Math.ceil(Math.sqrt(roofArea) * 4);
class ValidationError extends SolarSizingError {
  constructor(message: string) {
    super(`Validation error: ${message}`);
    this.name = 'ValidationError';
  }
}

// Types for configuration constants
type LocationType = keyof typeof LOCATION_IRRADIANCE;
type DirectionType = keyof typeof DIRECTION_EFFICIENCY;
type RoofType = keyof typeof ROOF_TYPE_EFFICIENCY;
type ShadingType = keyof typeof SHADING_FACTOR;

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') || '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
);

// Cost constants
const BASE_COSTS = {
  dcCablePerMeter: 300,
  acCablePerMeter: 400,
  mountingPerPanel: 8000,
  netMetering: 50000,
  installation: 25000,
  transport: 15000
};
// Constants for solar calculations
const LOCATION_IRRADIANCE = {
  "Northern Pakistan": 4.8,
  "Central Pakistan": 5.3,
  "Southern Pakistan": 5.7,
  "Islamabad": 5.3,
  "Lahore": 5.2,
  "Karachi": 5.6,
  "Peshawar": 5.4,
  "Quetta": 5.8
};
const DIRECTION_EFFICIENCY = {
  "south": 1.00,
  "southeast": 0.96,
  "southwest": 0.96,
  "east": 0.88,
  "west": 0.88,
  "north": 0.75,
  "northeast": 0.78,
  "northwest": 0.78
};
const ROOF_TYPE_EFFICIENCY = {
  "flat": 0.90,
  "standard": 0.96,
  "steep": 0.93,
  "optimal": 1.00 // 25-30° pitch for Pakistan latitudes
};
const SHADING_FACTOR = {
  "none": 1.00,
  "minimal": 0.95,
  "moderate": 0.85,
  "significant": 0.70 // >25% shading during peak hours
};
const SYSTEM_LOSSES = {
  inverterEfficiency: 0.96,
  wiringLosses: 0.98,
  dustSoilingLosses: 0.95,
  temperatureLosses: 0.91,
  mismatchLosses: 0.97
};
const MONTHLY_VARIATION = [
  0.85,
  0.90,
  1.00,
  1.10,
  1.15,
  1.15,
  1.05,
  0.95,
  1.05,
  1.00,
  0.90,
  0.85 // December - Winter
];
const GRID_RELIABILITY_FACTOR = 1.05;
const AREA_PER_PANEL = 1.8; // m²
const DAYS_PER_MONTH = 30.5;
const DAYS_PER_YEAR = 365;
serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Origin': req.headers.get('origin') || '*'
      }
    });
  }
  try {
    // Parse and validate input
    const rawInput = await req.json();
    
    // Validate monthly usage
    if (!rawInput.monthlyUsage || isNaN(Number(rawInput.monthlyUsage)) || Number(rawInput.monthlyUsage) <= 0) {
      throw new ValidationError("Valid monthly usage in kWh is required");
    }

    // Validate forceSize if provided
    if (rawInput.forceSize !== undefined) {
      if (isNaN(Number(rawInput.forceSize)) || Number(rawInput.forceSize) < 1 || Number(rawInput.forceSize) > 15) {
        throw new ValidationError("Force size must be between 1 and 15 kW");
      }
    }

    // Validate location
    if (rawInput.location && !LOCATION_IRRADIANCE[rawInput.location]) {
      throw new ValidationError(`Invalid location. Must be one of: ${Object.keys(LOCATION_IRRADIANCE).join(', ')}`);
    }

    // Validate roof direction
    if (rawInput.roofDirection && !DIRECTION_EFFICIENCY[rawInput.roofDirection]) {
      throw new ValidationError(`Invalid roof direction. Must be one of: ${Object.keys(DIRECTION_EFFICIENCY).join(', ')}`);
    }

    // Validate roof type
    if (rawInput.roofType && !ROOF_TYPE_EFFICIENCY[rawInput.roofType]) {
      throw new ValidationError(`Invalid roof type. Must be one of: ${Object.keys(ROOF_TYPE_EFFICIENCY).join(', ')}`);
    }

    // Validate shading
    if (rawInput.shading && !SHADING_FACTOR[rawInput.shading]) {
      throw new ValidationError(`Invalid shading. Must be one of: ${Object.keys(SHADING_FACTOR).join(', ')}`);
    }

    // Create validated input object with defaults
    const input: SystemSizingInput = {
      monthlyUsage: Number(rawInput.monthlyUsage),
      location: rawInput.location || "Central Pakistan",
      roofDirection: rawInput.roofDirection || "south",
      roofType: rawInput.roofType || "standard",
      shading: rawInput.shading || "minimal",
      forceSize: rawInput.forceSize !== undefined ? Number(rawInput.forceSize) : undefined
    };
    
    // Get efficiency factors from validated input
    const solarIrradiance = LOCATION_IRRADIANCE[input.location];
    const directionEfficiency = DIRECTION_EFFICIENCY[input.roofDirection];
    const roofEfficiency = ROOF_TYPE_EFFICIENCY[input.roofType];
    const shadingFactor = SHADING_FACTOR[input.shading];
    // Calculate combined system efficiency
    const systemEfficiency = SYSTEM_LOSSES.inverterEfficiency * SYSTEM_LOSSES.wiringLosses * SYSTEM_LOSSES.dustSoilingLosses * SYSTEM_LOSSES.temperatureLosses * SYSTEM_LOSSES.mismatchLosses * directionEfficiency * roofEfficiency * shadingFactor;
    // Calculate production metrics
    const dailyProductionPerKW = solarIrradiance * systemEfficiency;
    const monthlyProductionPerKW = dailyProductionPerKW * DAYS_PER_MONTH;
    const annualProductionPerKW = dailyProductionPerKW * DAYS_PER_YEAR;

    // Determine system size based on monthly usage or forced size
    let systemSize: number;
    if (input.forceSize !== undefined) {
      systemSize = input.forceSize;
    } else {
      // Calculate required size based on monthly usage and apply rounding to nearest 0.5 kW
      systemSize = input.monthlyUsage / monthlyProductionPerKW;
      systemSize = Math.ceil(systemSize * 2) / 2;
    }

    // Apply grid reliability factor for non-forced sizes
    const adjustedSystemSize = input.forceSize !== undefined
      ? systemSize
      : Math.ceil(systemSize * GRID_RELIABILITY_FACTOR * 2) / 2;
    // Fallback values if database queries fail
    const FALLBACK_PANELS = [
      { brand: "Default Panel", power: 450, price: 45000, default_choice: true },
    ];

    // Fetch available panels from database
    let panels;
    try {
      const { data: panelsData, error: panelsError } = await supabase
        .from('panels')
        .select('brand, power, price, default_choice')
        .eq('availability', true)
        .order('power', { ascending: true });

      if (panelsError) throw panelsError;
      panels = panelsData;

      if (!panels?.length) {
        console.warn('No panels found in database, using fallback values');
        panels = FALLBACK_PANELS;
      }
    } catch (err) {
      console.error('Error fetching panels:', err);
      panels = FALLBACK_PANELS;
    }

    // Calculate panel options with type safety
    const panelOptions = panels.map<PanelOption>(panel => {
      const count = calculatePanelCount(adjustedSystemSize, panel.power);
      const roofArea = calculateRoofArea(count);
      return {
        brand: panel.brand,
        power: panel.power,
        count,
        roofArea,
        totalCost: count * panel.price,
        defaultChoice: panel.default_choice || false
      };
    });

    // Sort panels by total cost and find default panel
    const defaultPanel = panelOptions.find(p => p.defaultChoice) ||
                        panelOptions.sort((a, b) => a.totalCost - b.totalCost)[0];

    // Calculate production estimates
    const monthlyProduction = Math.round(adjustedSystemSize * monthlyProductionPerKW);
    const annualProduction = Math.round(adjustedSystemSize * annualProductionPerKW);
    
    // Generate monthly production profile
    const monthlyProductionProfile = MONTHLY_VARIATION.map((factor) =>
      Math.round(adjustedSystemSize * monthlyProductionPerKW * factor)
    );

    // Calculate min and max recommended system sizes
    const minimumSystemSize = Math.max(1, Math.floor(systemSize * 0.8 * 2) / 2);
    const maximumSystemSize = Math.ceil(systemSize * 1.2 * 2) / 2;
    
    // Calculate peak and off-peak usage based on typical Pakistani usage patterns
    const peakUsagePercent = 42; // 42% during peak hours (6:00 PM - 9:00 PM)
    const peakUsage = Math.round(input.monthlyUsage * (peakUsagePercent / 100));
    const offPeakUsage = input.monthlyUsage - peakUsage;
    // Fallback values for inverters
    const FALLBACK_INVERTERS = [
      { brand: "Default Inverter", power: 5, price: 120000 },
      { brand: "Default Inverter", power: 10, price: 180000 },
      { brand: "Default Inverter", power: 15, price: 250000 },
    ];

    // Fetch suitable inverters from database
    let inverters;
    try {
      const { data: invertersData, error: invertersError } = await supabase
        .from('inverters')
        .select('brand, power, price')
        .eq('availability', true)
        .gte('power', adjustedSystemSize)
        .order('price', { ascending: true });

      if (invertersError) throw invertersError;
      inverters = invertersData;

      if (!inverters?.length) {
        console.warn('No suitable inverters found in database, using fallback values');
        inverters = FALLBACK_INVERTERS.filter(inv => inv.power >= adjustedSystemSize);
      }
    } catch (err) {
      console.error('Error fetching inverters:', err);
      inverters = FALLBACK_INVERTERS.filter(inv => inv.power >= adjustedSystemSize);
    }

    if (!inverters?.length) {
      throw new ValidationError(`No suitable inverter found for ${adjustedSystemSize}kW system`);
    }

    // Map inverters to options with type safety and calculations
    const inverterOptions = inverters.map<InverterOption>(inverter => {
      const count = Math.ceil(adjustedSystemSize / inverter.power);
      return {
        brand: inverter.brand,
        power: inverter.power,
        count,
        totalCost: count * inverter.price,
        efficiencyRating: SYSTEM_LOSSES.inverterEfficiency
      };
    });

    // Find the most cost-effective inverter option with type safety
    const selectedInverter = inverterOptions.reduce<InverterOption>((best, current) => (
      !best || current.totalCost < best.totalCost ? current : best
    ));

    // This should never happen since we checked inverters.length, but TypeScript doesn't know that
    if (!selectedInverter) {
      throw new ValidationError('No suitable inverter found for the system size');
    }

    // Calculate cable and mounting costs based on the selected panel option
    const selectedPanelOption = panelOptions[0]; // Use the first panel option as default
    const cableLength = calculateCableLength(selectedPanelOption.roofArea);
    const dcCableCost = cableLength * BASE_COSTS.dcCablePerMeter;
    const acCableCost = cableLength * BASE_COSTS.acCablePerMeter;
    const mountingCost = selectedPanelOption.count * BASE_COSTS.mountingPerPanel;
    const installationCost = BASE_COSTS.installation;
    const netMeteringCost = BASE_COSTS.netMetering;
    const transportCost = BASE_COSTS.transport;
    // Calculate total system cost using default panel option (450W)
    const totalCost = defaultPanel.totalCost + selectedInverter.totalCost + dcCableCost + acCableCost +
                     mountingCost + installationCost + netMeteringCost + transportCost;
    const response = {
      systemSize: adjustedSystemSize,
      recommendedRange: {
        minimum: minimumSystemSize,
        recommended: adjustedSystemSize,
        maximum: maximumSystemSize
      },
      efficiencyFactors: {
        systemEfficiency: Math.round(systemEfficiency * 100),
        irradiance: solarIrradiance,
        direction: Math.round(directionEfficiency * 100),
        roofType: Math.round(roofEfficiency * 100),
        shading: Math.round(shadingFactor * 100),
        temperature: Math.round(SYSTEM_LOSSES.temperatureLosses * 100),
        inverter: Math.round(SYSTEM_LOSSES.inverterEfficiency * 100)
      },
      equipment: {
        panelOptions,
        inverters: inverterOptions,
        selectedInverter // Include all options but highlight the selected one
      },
      costs: {
        panels: defaultPanel.totalCost,
        inverter: selectedInverter.totalCost,
        dcCable: dcCableCost,
        acCable: acCableCost,
        mounting: mountingCost,
        installation: installationCost,
        netMetering: netMeteringCost,
        transport: transportCost,
        total: totalCost
      },
      roof: {
        required_area: selectedPanelOption.roofArea,
        layout_efficiency: roofEfficiency * 100,
        optimal_orientation: roofDirection,
        shading_impact: (1 - shadingFactor) * 100
      },
      battery: {
        recommended_capacity: input.monthlyUsage * 0.3, // 30% of monthly usage
        autonomy_days: 1, // Standard backup duration
        estimated_cost: input.monthlyUsage * 200, // Cost scaling factor
        efficiency_rating: 0.95, // Standard lithium battery efficiency
        lifespan_years: 10 // Average battery lifespan
      },
      production: {
        daily: Math.round(adjustedSystemSize * dailyProductionPerKW),
        monthly: monthlyProduction,
        annual: annualProduction,
        byMonth: monthlyProductionProfile,
        peakSunHours: solarIrradiance
      },
      consumption: {
        monthly: input.monthlyUsage,
        peak: {
          percentage: peakUsagePercent,
          kWh: peakUsage,
          time: "6:00 PM - 9:00 PM" // Pakistani peak hours
        },
        offPeak: offPeakUsage
      },
      weather: {
        sunHours: solarIrradiance,
        efficiency: Math.round(systemEfficiency * 100),
        temperatureImpact: Math.round((1 - SYSTEM_LOSSES.temperatureLosses) * 100),
        annualProduction
      },
      metadata: {
        calculationVersion: "1.0",
        calculationDate: new Date().toISOString(),
        location: input.location,
        roofDirection: input.roofDirection,
        roofType: input.roofType,
        shading: input.shading
      }
    };
    return new Response(JSON.stringify(response), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        'Access-Control-Allow-Origin': req.headers.get('origin') || '*'
      }
    });
  } catch (error) {
    console.error('System sizing calculation error:', error);

    // Handle different error types
    const errorResponse = {
      error: error instanceof SolarSizingError ? error.message : "Failed to calculate system size",
      errorType: error instanceof Error ? error.name : 'UnknownError'
    };

    return new Response(JSON.stringify(errorResponse), {
      status: error instanceof ValidationError ? 400 : 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        'Access-Control-Allow-Origin': req.headers.get('origin') || '*'
      }
    });
  }
});
