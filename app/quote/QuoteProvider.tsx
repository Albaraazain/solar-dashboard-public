// app/quote/QuoteProvider.tsx
"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { useQuoteReducer } from '@/hooks/useQuoteReducer';
import { useAutoSave } from '@/hooks/useAutoSave';
import { X } from 'lucide-react';
import { supabase } from '@/utils/supabase';
import {
  Panel,
  Inverter,
  StructureType,
  BracketCost,
  VariableCost
} from '@/utils/supabase';

// Define the context types
interface QuoteContextType {
  state: ReturnType<typeof useQuoteReducer>['state'];
  calculateQuote: (monthlyUsage: number) => Promise<void>;
  saveQuote: () => Promise<void>;
  saveNow: () => Promise<{ success: boolean, error?: any }>;
  updateSystemSize: (size: number) => void;
  updatePanelType: (panelId: string) => void;
  updateInverterType: (inverterId: string) => void;
  
  // Equipment data
  panels: Panel[];
  inverters: Inverter[];
  structureTypes: StructureType[];
  equipmentLoading: boolean;
  selectedPanel: Panel | undefined;
  selectedInverter: Inverter | undefined;
}

// Create the context
const QuoteContext = createContext<QuoteContextType | undefined>(undefined);

// Provider component
export const QuoteProvider: React.FC<{
  children: React.ReactNode;
  billId?: string;
  billReference?: string;
  initialMonthlyUsage?: number;
}> = ({ children, billId, billReference, initialMonthlyUsage }) => {
  // Quote reducer
  const {
    state,
    calculateQuote,
    saveQuote,
    updateSystemSize,
    updatePanelType,
    updateInverterType
  } = useQuoteReducer(billId, billReference);
   
  // Equipment state
  const [panels, setPanels] = useState<Panel[]>([]);
  const [inverters, setInverters] = useState<Inverter[]>([]);
  const [structureTypes, setStructureTypes] = useState<StructureType[]>([]);
  const [bracketCosts, setBracketCosts] = useState<BracketCost[]>([]);
  const [variableCosts, setVariableCosts] = useState<VariableCost[]>([]);
  const [equipmentLoading, setEquipmentLoading] = useState(true);
  
  // Calculate selected equipment
  const selectedPanel = panels.find(panel => panel.id === state.selectedPanelType) || panels[0];
  const selectedInverter = inverters.find(inverter => inverter.id === state.selectedInverterType) || inverters[0];
  
  // First render reference
  const isFirstRenderRef = useRef(true);
  
  // Show toast notification
  // Set up auto-save
  const { saveNow } = useAutoSave({
    onSave: async () => {
      if (isFirstRenderRef.current) {
        isFirstRenderRef.current = false;
        return;
      }
      
      if (!state.billId || !state.calculationResults) {
        console.log('Skipping auto-save: missing bill ID or calculation results');
        return;
      }
      
      await saveQuote();
    },
    dependencies: [
      state.calculationResults?.system.size,
      state.selectedPanelType,
      state.selectedInverterType,
      state.calculationResults?.system.costs.total
    ],
    debounceTime: 2000,
    onSaveStart: () => console.log('Auto-save started'),
    onSaveComplete: () => {
      console.log('Auto-save completed');
      // Only show toast on significant changes to avoid spamming
      if (!isFirstRenderRef.current && state.lastSaved) {
      }
    },
    onSaveError: (err) => {
      console.error('Auto-save error:', err);
    }
  });
  
  // Load equipment data
  useEffect(() => {
    const loadEquipment = async () => {
      setEquipmentLoading(true);
      try {
        // Single RPC call to get all equipment data
        const { data, error } = await supabase.rpc('get_equipment_data');
        console.log('Equipment data response:', { data, error });
        
        if (error || !data) {
          throw new Error(error?.message || 'Failed to fetch equipment data');
        }
        
        // RPC returns array of rows - take first result
        const equipmentData = data?.[0] || {};
        
        const {
          panels: panelsData = [],
          inverters: invertersData = [],
          structure_types: structureTypesData = [],
          bracket_costs: bracketCostsData = [],
          variable_costs: variableCostsData = []
        } = equipmentData;
        
        // Validate required equipment data
        if (panelsData.length === 0 || invertersData.length === 0) {
          throw new Error('Missing required equipment data');
        }
        
        // Validate and ensure array types
        const safePanels = Array.isArray(panelsData) ? panelsData : [];
        const safeInverters = Array.isArray(invertersData) ? invertersData : [];
        const safeStructureTypes = Array.isArray(structureTypesData) ? structureTypesData : [];
        const safeBracketCosts = Array.isArray(bracketCostsData) ? bracketCostsData : [];
        const safeVariableCosts = Array.isArray(variableCostsData) ? variableCostsData : [];
        
        // Only update state if data actually changed
        if (JSON.stringify(safePanels) !== JSON.stringify(panels)) {
          console.log('Updating panels state');
          setPanels(safePanels);
        }
        
        if (JSON.stringify(safeInverters) !== JSON.stringify(inverters)) {
          console.log('Updating inverters state');
          setInverters(safeInverters);
        }

        if (JSON.stringify(safeStructureTypes) !== JSON.stringify(structureTypes)) {
          console.log('Updating structureTypes state');
          setStructureTypes(safeStructureTypes);
        }

        // Bracket and variable costs likely static - only update if changed
        if (JSON.stringify(safeBracketCosts) !== JSON.stringify(bracketCosts)) {
          console.log('Updating bracketCosts state');
          setBracketCosts(safeBracketCosts);
        }

        if (JSON.stringify(safeVariableCosts) !== JSON.stringify(variableCosts)) {
          console.log('Updating variableCosts state');
          setVariableCosts(safeVariableCosts);
        }
        
        // Set default panel and inverter if not already set
        if (!state.selectedPanelType) {
          const defaultPanel = panelsData.find((p: Panel) => p.default_choice);
          if (defaultPanel) {
            updatePanelType(defaultPanel.id);
          }
        }
        
        if (!state.selectedInverterType && invertersData.length > 0) {
          // Find appropriate inverter for system size
          const appropriateInverter = invertersData.find(
            (inv: Inverter) => inv.power >= state.systemSize
          ) || invertersData[0];
          updateInverterType(appropriateInverter.id);
        }
      } catch (error) {
        console.error('Error loading equipment data:', error);
        
      } finally {
        setEquipmentLoading(false);
      }
    };
    
    loadEquipment();
  }, [state.systemSize, state.selectedPanelType, state.selectedInverterType, updatePanelType, updateInverterType]);
  
  // Initial calculation
  useEffect(() => {
    if (initialMonthlyUsage && !state.calculationResults && !state.isLoading) {
      calculateQuote(initialMonthlyUsage);
    }
  }, [initialMonthlyUsage, state.calculationResults, state.isLoading, calculateQuote]);
  
  // Save quote when leaving page
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (state.billId && state.calculationResults && !state.isSaving) {
        saveNow();
      }
    };
    
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [state.billId, state.calculationResults, state.isSaving, saveNow]);

  // Debug render cycles
  const renderCount = useRef(0);
  renderCount.current++;
  console.log(`QuoteProvider render #${renderCount.current}`);

  const contextValue: QuoteContextType = {
    state,
    calculateQuote,
    saveQuote,
    saveNow,
    updateSystemSize,
    updatePanelType,
    updateInverterType,
    panels,
    inverters,
    structureTypes,
    equipmentLoading,
    selectedPanel,
    selectedInverter
  };
  
  return (
    <QuoteContext.Provider value={contextValue}>
      {children}
      
    </QuoteContext.Provider>
  );
};

// Hook for using the context
export const useQuote = () => {
  const context = useContext(QuoteContext);
  if (context === undefined) {
    throw new Error('useQuote must be used within a QuoteProvider');
  }
  return context;
};