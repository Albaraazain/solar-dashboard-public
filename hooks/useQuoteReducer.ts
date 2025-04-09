// hooks/useQuoteReducer.ts
import { useReducer, useEffect, useCallback } from 'react';
import { QuoteState, QuoteCalculationResults, QuoteParams, QuoteStatus } from '@/services/quote/quoteTypes';
import { quoteService } from '@/services/quote/quoteService';

// Local state for retry management
let saveRetryCount = 0;

// Update initial state type

// Define action types
type QuoteAction =
  | { type: 'INIT_QUOTE'; billId: string; billReference: string }
  | { type: 'SET_LOADING'; isLoading: boolean }
  | { type: 'SET_SAVING'; isSaving: boolean }
  | { type: 'SET_ERROR'; error: string | null }
  | { type: 'UPDATE_SYSTEM_SIZE'; size: number }
  | { type: 'UPDATE_PANEL_TYPE'; panelId: string }
  | { type: 'UPDATE_INVERTER_TYPE'; inverterId: string }
  | { type: 'SET_CALCULATION_RESULTS'; results: QuoteCalculationResults }
  | { type: 'SET_QUOTE_ID'; id: string }
  | { type: 'SET_SAVED'; timestamp: Date }
  | { type: 'SET_STATUS'; status: QuoteStatus }
  | { type: 'LOAD_QUOTE'; quote: any }
  | { type: 'INCREMENT_VERSION' };

// Initial state
const initialState: QuoteState = {
  id: null,
  billId: null,
  billReference: null,
  systemSize: 7.5, // Default system size
  selectedPanelType: '',
  selectedInverterType: '',
  totalCost: null,
  calculationResults: null,
  isLoading: false,
  isSaving: false,
  lastSaved: null,
  error: null,
  version: 1,
  status: 'draft'
};

// Reducer function
function quoteReducer(state: QuoteState, action: QuoteAction): QuoteState {
  switch (action.type) {
    case 'INIT_QUOTE':
      return {
        ...state,
        billId: action.billId,
        billReference: action.billReference
      };
    case 'SET_LOADING':
      return {
        ...state,
        isLoading: action.isLoading
      };
    case 'SET_SAVING':
      return {
        ...state,
        isSaving: action.isSaving
      };
    case 'SET_ERROR':
      return {
        ...state,
        error: action.error
      };
    case 'UPDATE_SYSTEM_SIZE':
      return {
        ...state,
        systemSize: action.size
      };
    case 'UPDATE_PANEL_TYPE':
      return {
        ...state,
        selectedPanelType: action.panelId
      };
    case 'UPDATE_INVERTER_TYPE':
      return {
        ...state,
        selectedInverterType: action.inverterId
      };
    case 'SET_CALCULATION_RESULTS':
      return {
        ...state,
        calculationResults: action.results,
        totalCost: action.results.system.costs.total,
        // Update system size if it came from calculation
        systemSize: action.results.system.size,
        // Auto-increment version on calculation update
        version: state.version + 1
      };
    case 'SET_QUOTE_ID':
      return {
        ...state,
        id: action.id
      };
    case 'SET_SAVED':
      return {
        ...state,
        lastSaved: action.timestamp,
        isSaving: false
      };
    case 'LOAD_QUOTE':
      return {
        ...state,
        id: action.quote.id,
        billId: action.quote.bill_id,
        systemSize: action.quote.system_size,
        totalCost: action.quote.total_cost,
        calculationResults: action.quote.calculations,
        lastSaved: new Date(action.quote.updated_at),
        version: action.quote.version || 1,
        status: action.quote.status || 'draft'
      };
    case 'SET_STATUS':
      return {
        ...state,
        status: action.status,
        // Auto-increment version on status change
        version: state.version + 1
      };
    case 'INCREMENT_VERSION':
      return {
        ...state,
        version: state.version + 1
      };
    default:
      return state;
  }
}

export function useQuoteReducer(initialBillId?: string, initialBillReference?: string) {
  const [state, dispatch] = useReducer(quoteReducer, {
    ...initialState,
    billId: initialBillId || null,
    billReference: initialBillReference || null
  });
  
  // Initialize when bill ID is provided
  useEffect(() => {
    if (initialBillId && initialBillReference) {
      dispatch({ 
        type: 'INIT_QUOTE', 
        billId: initialBillId,
        billReference: initialBillReference
      });
      
      // Try to load existing quote
      loadQuoteForBill(initialBillId);
    }
  }, [initialBillId, initialBillReference]);
  
  // Load quote for a bill
  const loadQuoteForBill = useCallback(async (billId: string) => {
    try {
      dispatch({ type: 'SET_LOADING', isLoading: true });
      const quote = await quoteService.fetchQuoteByBillId(billId);
      
      if (quote) {
        dispatch({ type: 'LOAD_QUOTE', quote });
      }
    } catch (error) {
      console.error('Error loading quote for bill:', error);
    } finally {
      dispatch({ type: 'SET_LOADING', isLoading: false });
    }
  }, []);
  
  // Calculate quote
  const calculateQuote = useCallback(async (monthlyUsage: number) => {
    try {
      dispatch({ type: 'SET_LOADING', isLoading: true });
      dispatch({ type: 'SET_ERROR', error: null });
      
      const yearlyUsage = monthlyUsage * 12;
      const results = await quoteService.calculateQuote(yearlyUsage);
      
      if (results) {
        dispatch({ type: 'SET_CALCULATION_RESULTS', results });
      } else {
        dispatch({ type: 'SET_ERROR', error: 'Failed to calculate quote' });
      }
    } catch (error: any) {
      dispatch({ type: 'SET_ERROR', error: error.message || 'Error calculating quote' });
    } finally {
      dispatch({ type: 'SET_LOADING', isLoading: false });
    }
  }, []);
  
  // Save quote (auto-save)
  const saveQuote = useCallback(async () => {
    if (!state.billId || !state.calculationResults) {
      return;
    }

    if (saveRetryCount >= 3) {
      dispatch({ type: 'SET_ERROR', error: 'Auto-save failed after multiple attempts' });
      saveRetryCount = 0; // Reset for next time
      return;
    }
    
    try {
      dispatch({ type: 'SET_SAVING', isSaving: true });
      
      const saveResult = await quoteService.saveQuote(
        state.billId,
        state.systemSize,
        state.totalCost || 0,
        state.calculationResults,
        state.status,
        state.id || undefined
      );
      
      if (saveResult.success) {
        if (saveResult.id && !state.id) {
          dispatch({ type: 'SET_QUOTE_ID', id: saveResult.id });
        }
        dispatch({ type: 'SET_SAVED', timestamp: new Date() });
        dispatch({ type: 'INCREMENT_VERSION' });
        
        // Reset retry count on successful save
        saveRetryCount = 0;
      } else {
        // Increment retry count and attempt retry after delay
        saveRetryCount++;
        setTimeout(() => saveQuote(), 2000 * saveRetryCount);
        dispatch({ type: 'SET_ERROR', error: saveResult.error || 'Failed to save quote' });
      }
    } catch (error: any) {
      saveRetryCount++;
      setTimeout(() => saveQuote(), 2000 * saveRetryCount);
      dispatch({ type: 'SET_ERROR', error: error.message || 'Error saving quote' });
    }
  }, [state.billId, state.systemSize, state.totalCost, state.calculationResults, state.id]);
  
  // Debounced save for auto-saving
  const debouncedSave = useCallback(
    debounce(saveQuote, 2000),
    [saveQuote]
  );
  
  // Update functions
  const updateSystemSize = useCallback((size: number) => {
    dispatch({ type: 'UPDATE_SYSTEM_SIZE', size });
    debouncedSave();
  }, [debouncedSave]);
  
  const updatePanelType = useCallback((panelId: string) => {
    dispatch({ type: 'UPDATE_PANEL_TYPE', panelId });
    debouncedSave();
  }, [debouncedSave]);
  
  const updateInverterType = useCallback((inverterId: string) => {
    dispatch({ type: 'UPDATE_INVERTER_TYPE', inverterId });
    debouncedSave();
  }, [debouncedSave]);
  
  return {
    state,
    calculateQuote,
    saveQuote,
    updateSystemSize,
    updatePanelType,
    updateInverterType
  };
}

// Helper function for debouncing
function debounce<F extends (...args: any[]) => any>(
  func: F,
  waitFor: number
) {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  const debounced = (...args: Parameters<F>) => {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
    }
    timeout = setTimeout(() => func(...args), waitFor);
  };

  return debounced as (...args: Parameters<F>) => void;
}