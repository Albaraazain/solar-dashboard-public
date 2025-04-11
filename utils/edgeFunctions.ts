import { supabase } from './supabase';

/**
 * Input for the system-sizing edge function
 */
export interface SystemSizingInput {
  monthlyUsage: number;
  location?: "Northern Pakistan" | "Central Pakistan" | "Southern Pakistan" | "Islamabad" | "Lahore" | "Karachi" | "Peshawar" | "Quetta";
  roofDirection?: "south" | "southeast" | "southwest" | "east" | "west" | "north" | "northeast" | "northwest";
  roofType?: "flat" | "standard" | "steep" | "optimal";
  shading?: "none" | "minimal" | "moderate" | "significant";
  forceSize?: number;
}

/**
 * Panel option in the system-sizing response
 */
export interface PanelOption {
  brand: string;
  power: number;
  count: number;
  roofArea: number;
  totalCost: number;
  defaultChoice: boolean;
}

/**
 * Inverter option in the system-sizing response
 */
export interface InverterOption {
  brand: string;
  power: number;
  count: number;
  totalCost: number;
  efficiencyRating?: number;
}

/**
 * Full response from the system-sizing edge function
 */
export interface SystemSizingResponse {
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
    accessories?: number;
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

/**
 * Calls the system-sizing edge function with the provided input
 * @param input Parameters for the solar system sizing calculation
 * @returns Detailed system sizing response with equipment, costs, and production estimates
 */
export async function calculateSystemSizing(input: SystemSizingInput): Promise<SystemSizingResponse> {
  try {
    console.log('Calling system-sizing edge function with input:', input);
    
    const { data, error } = await supabase.functions.invoke('system-sizing', {
      body: input
    });
    
    if (error) {
      console.error('Error invoking system-sizing function:', error);
      throw new Error(`Failed to calculate system sizing: ${error.message}`);
    }
    
    console.log('Received response from system-sizing edge function');
    return data as SystemSizingResponse;
  } catch (err) {
    console.error('Error in calculateSystemSizing:', err);
    throw err;
  }
}