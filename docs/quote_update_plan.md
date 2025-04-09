# Quote Generation Update Plan

## Overview
This document outlines the plan to update our frontend application to work with the new `generate_full_quote` database function. The changes will ensure our application correctly handles the new response format and provides all necessary data to the function.

## Current vs New Implementation

### Database Function Changes
```diff
- Function expects: yearly_units
+ Function expects: bill_id, override_system_size?, override_panel_id?, override_inverter_id?
```

### Response Format Changes
```typescript
// New response format includes additional sections:
{
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
```

## Implementation Steps

```mermaid
graph TD
    A[Update Type Definitions] --> B[Update Quote Service]
    B --> C[Update Quote Provider]
    C --> D[Test Integration]
    
    A1[Update QuoteCalculationResponse] --> A
    A2[Update QuoteCalculationResults] --> A
    A3[Add New Interfaces] --> A
    
    B1[Update calculateQuote params] --> B
    B2[Update response handling] --> B
    B3[Update error handling] --> B
    
    C1[Update state management] --> C
    C2[Update reducers] --> C
    C3[Handle new fields] --> C
</mermaid>

### 1. Type Definition Updates (services/quote/quoteTypes.ts)

```typescript
// New interfaces needed
export interface QuoteMetadata {
  currency: string;
  valid_until: string;
  generated_at: string;
}

// Update existing interfaces
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

// Update QuoteState to include new data
export interface QuoteState {
  // Existing fields...
  weatherImpact: WeatherImpact | null;
  roofRequirements: RoofRequirements | null;
  batteryRecommendation: BatteryRecommendation | null;
  metadata: QuoteMetadata | null;
}
```

### 2. Quote Service Updates (services/quote/quoteService.ts)

```typescript
class QuoteService {
  async calculateQuote(
    billId: string, 
    overrides?: {
      systemSize?: number;
      panelId?: string;
      inverterId?: string;
    }
  ): Promise<QuoteCalculationResponse | null> {
    const { data, error } = await supabase.rpc('generate_full_quote', {
      bill_id: billId,
      override_system_size: overrides?.systemSize,
      override_panel_id: overrides?.panelId,
      override_inverter_id: overrides?.inverterId
    });
    
    // Error handling and response processing...
  }
}
```

### 3. State Management Updates

#### Quote Provider (app/quote/QuoteProvider.tsx)
- Update initial state to include new fields
- Add new actions for weather, roof, and battery data
- Update data processing to handle new response format

#### Quote Reducer (hooks/useQuoteReducer.ts)
- Add new action types for additional data sections
- Update reducer cases to handle new actions
- Ensure proper state updates for new fields

## Testing Plan

1. Unit Tests:
   - Test type compatibility with new response format
   - Test service method with different parameter combinations
   - Test reducer with new actions

2. Integration Tests:
   - Test full quote generation flow
   - Verify all new data sections are properly stored
   - Test override functionality

3. UI Tests:
   - Verify new data is properly displayed
   - Test error states
   - Verify proper loading states

## Migration Considerations

1. Backwards Compatibility:
   - Keep support for older quote formats temporarily
   - Add version checking in quote processing
   - Implement fallbacks for missing data

2. Error Handling:
   - Add specific error handling for new failure cases
   - Implement proper validation for new fields
   - Add logging for migration-related issues

## Implementation Timeline

1. Phase 1 (Day 1):
   - Update type definitions
   - Implement basic service changes
   - Add new state management

2. Phase 2 (Day 2):
   - Implement UI updates
   - Add error handling
   - Write tests

3. Phase 3 (Day 3):
   - Testing and bug fixes
   - Documentation updates
   - Deploy and monitor

## Risks and Mitigation

1. Data Consistency:
   - Risk: Existing quotes might not have new fields
   - Mitigation: Implement fallback values and validation

2. Performance:
   - Risk: Larger response payload
   - Mitigation: Implement lazy loading for detailed views

3. Error Handling:
   - Risk: New error cases from function
   - Mitigation: Comprehensive error handling update