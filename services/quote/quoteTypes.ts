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
  system: {
    size: number;
    panel: PanelInfo;
    inverter: InverterInfo;
    costs: CostBreakdown;
  };
  energy: EnergyDetails;
  weather: WeatherImpact;
  roof: RoofRequirements;
  battery: BatteryRecommendation;
  metadata: QuoteMetadata;
}

export interface QuoteCalculationResults {
  system: {
    size: number;
    panel: PanelInfo;
    inverter: InverterInfo;
    costs: CostBreakdown;
  };
  energy: EnergyDetails;
  weather: WeatherImpact;
  roof: RoofRequirements;
  battery: BatteryRecommendation;
  metadata: QuoteMetadata;
}

export interface PanelInfo {
  id?: string;
  brand: string;
  power: number;
  price: number;
  count: number;
  total_price?: number; // Computed from price * count
}

export interface InverterInfo {
  id?: string;
  brand: string;
  power: number;
  price: number;
}

export interface CostBreakdown {
  total: number;
  summary: {
    hardware: number;
    per_watt: number;
    services: number;
  };
  components: {
    labor: number;
    panels: {
      cost: number;
      details: {
        brand: string;
        count: number;
        power: number;
        unit_price: number;
      };
    };
    wiring: {
      ac_cable: number;
      dc_cable: number;
    };
    inverter: {
      cost: number;
      details: {
        brand: string;
        power: number;
      };
    };
    structure: {
      cost: number;
      details: {
        rate: number;
        type: string;
      };
    };
    transport: number;
    accessories: number;
    installation: number;
    net_metering: number;
  };
}

export interface EnergyDetails {
  peak_usage: number;
  monthly_usage: number;
  offpeak_usage: number;
  efficiency_score: number;
  comparison_metrics: {
    efficient_homes: number;
    regional_average: number;
  };
  estimated_production: number;
}

export interface WeatherImpact {
  region: string;
  solar_intensity: number;
  seasonal_variation: {
    fall: number;
    spring: number;
    summer: number;
    winter: number;
  };
  annual_sunshine_hours: number;
}

export interface RoofRequirements {
  panel_count: number;
  panel_power: number;
  required_area: number;
  shading_impact: number;
  layout_efficiency: number;
  optimal_orientation: {
    tilt: number;
    azimuth: number;
  };
}

export interface BatteryRecommendation {
  efficiency: number;
  cost_estimate: {
    total: number;
    per_kwh: number;
  };
  specifications: {
    amp_hours: number;
    batteries_count: number;
    parallel_strings: number;
  };
  system_voltage: number;
  backup_duration: {
    days: number;
    hours: number;
  };
  daily_usage_kwh: number;
  recommended_type: string;
  recommended_capacity: number;
}

export interface QuoteMetadata {
  currency: string;
  valid_until: string;
  generated_at: string;
}

export interface QuoteParams {
  bill_id: string;
  override_system_size?: number;
  override_panel_id?: string;
  override_inverter_id?: string;
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