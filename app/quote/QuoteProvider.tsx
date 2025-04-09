// app/quote/QuoteProvider.tsx
"use client";

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/ui/use-toast';
import { useQuoteReducer } from '@/hooks/useQuoteReducer';
import { useAutoSave } from '@/hooks/useAutoSave';
import { X } from 'lucide-react';
import {
  Panel,
  Inverter, 
  StructureType,
  BracketCost,
  VariableCost,
  fetchPanels,
  fetchInverters,
  fetchStructureTypes,
  fetchBracketCosts,
  fetchVariableCosts 
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
      state.systemSize,
      state.selectedPanelType,
      state.selectedInverterType,
      state.calculationResults
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
        // Load all equipment data in parallel
        const [
          panelsData,
          invertersData,
          structureTypesData,
          bracketCostsData,
          variableCostsData
        ] = await Promise.all([
          fetchPanels(),
          fetchInverters(),
          fetchStructureTypes(),
          fetchBracketCosts(),
          fetchVariableCosts()
        ]);
        
        setPanels(panelsData);
        setInverters(invertersData);
        setStructureTypes(structureTypesData);
        setBracketCosts(bracketCostsData);
        setVariableCosts(variableCostsData);
        
        // Set default panel and inverter if not already set
        if (!state.selectedPanelType && panelsData.length > 0) {
          const defaultPanel = panelsData.find(p => p.default_choice) || panelsData[0];
          updatePanelType(defaultPanel.id);
        }
        
        if (!state.selectedInverterType && invertersData.length > 0) {
          // Find appropriate inverter for system size
          const appropriateInverter = invertersData.find(
            inv => inv.power >= state.systemSize
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
  
  // Provide context
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