// services/quote/quoteTypes.ts
import { Bill } from "@/utils/supabase";

export interface QuoteState {
  // Core quote data
  id: string | null;
  billId: string | null;
  billReference: string | null;
  systemSize: number;
  selectedPanelType: string;
  selectedInverterType: string;
  totalCost: number | null;
  
  // Calculation results
  calculationResults: QuoteCalculationResults | null;
  
  // UI state
  isLoading: boolean;
  isSaving: boolean;
  lastSaved: Date | null;
  error: string | null;
  // Versioning
  version: number;
  
  // Status
  status: QuoteStatus;
}


export interface QuoteCalculationResponse {
  system_size: number;
  costs: CostBreakdown;
  panel: PanelDetails;
  inverter: InverterDetails;
  timestamp: string;
}

export interface QuoteCalculationResults {
  system: {
    size: number;
    panel: PanelDetails;
    inverter: InverterDetails;
    costs: CostBreakdown;
  };
}

export interface PanelDetails {
  brand: string;
  model?: string;
  count: number;
  unit_power: number;
  total_power: number;
  unit_price: number;
  total_price: number;
  efficiency?: number;
}

export interface InverterDetails {
  brand: string;
  model?: string;
  rated_power: number;
  system_requirement: number;
  efficiency?: number;
  warranty?: number;
  price: number;
  margin?: number;
}

export interface CostBreakdown {
  components: {
    net_metering: number;
    installation: number;
    dc_cable: number;
    ac_cable: number;
    accessories: number;
    transport: number;
    safety_cert?: number;
  };
  system_size: number;
  panel_count: number;
  total: number;
}

export interface EnergyDetails {
  monthly_usage: number;
  peak_usage: number;
  offpeak_usage: number;
  estimated_production: number;
  efficiency_score: number;
  comparison_metrics?: {
    regional_average: number;
    efficient_homes: number;
  };
}

export interface WeatherImpact {
  sun_hours: number;
  efficiency_factor: number;
  temperature_impact: number;
  annual_projection: number;
}

export interface RoofRequirements {
  required_area: number;
  layout_efficiency: number;
  optimal_orientation: {
    azimuth: number;
    tilt: number;
  };
  shading_impact: number;
}

export interface BatteryRecommendation {
  recommended_capacity: number;
  autonomy_days: number;
  estimated_cost: number;
  efficiency_rating: number;
  lifespan_years: number;
}

export interface QuoteParams {
  systemSize: number;
  selectedPanelType: string;
  selectedInverterType: string;
  monthlyUsage: number;
}

export type QuoteStatus = 'draft' | 'final';

export interface QuoteServiceOptions {
  onProgress?: (status: string) => void;
}

export interface SaveQuoteResult {
  success: boolean;
  id?: string;
  error?: string;
}