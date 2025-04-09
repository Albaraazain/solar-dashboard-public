// services/quote/quoteService.ts
import { supabase, Bill } from '@/utils/supabase';
import { 
  QuoteParams, 
  QuoteCalculationResults, 
  QuoteStatus,
  SaveQuoteResult,
  QuoteCalculationResponse
} from './quoteTypes';

// Debounce helper function
const debounce = <F extends (...args: any[]) => any>(
  func: F,
  waitFor: number
): ((...args: Parameters<F>) => Promise<ReturnType<F>>) => {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<F>): Promise<ReturnType<F>> => {
    return new Promise((resolve) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      
      timeout = setTimeout(() => {
        resolve(func(...args));
      }, waitFor);
    });
  };
};

class QuoteService {
  /**
   * Calculate a quote using RPC to the database function
   */
  async calculateQuote(yearlyUnits: number): Promise<QuoteCalculationResponse | null> {
    try {
      console.log('Calculating quote for yearly units:', yearlyUnits);
      
      // Call the Supabase RPC function
      const { data, error } = await supabase.rpc('generate_full_quote', {
        yearly_units: yearlyUnits
      });
      
      if (error) {
        console.error('Error calculating quote:', error);
        throw error;
      }
      
      console.log('Quote calculation result:', data);
      return data as QuoteCalculationResponse;
    } catch (err) {
      console.error('Error in quote calculation:', err);
      return null;
    }
  }
  
  /**
   * Fetch a quote by ID
   */
  async fetchQuote(quoteId: string): Promise<any | null> {
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', quoteId)
        .single();
      
      if (error) {
        console.error('Error fetching quote:', error);
        throw error;
      }
      
      return data;
    } catch (err) {
      console.error('Error fetching quote:', err);
      return null;
    }
  }
  
  /**
   * Fetch a quote by bill ID (gets the latest quote)
   */
  async fetchQuoteByBillId(billId: string): Promise<any | null> {
    try {
      const { data, error } = await supabase
        .from('quotes')
        .select('*')
        .eq('bill_id', billId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (error) {
        // Not finding a quote is not an error in this context
        if (error.code === 'PGRST116') {
          return null;
        }
        console.error('Error fetching quote by bill ID:', error);
        throw error;
      }
      
      return data;
    } catch (err) {
      console.error('Error fetching quote by bill ID:', err);
      return null;
    }
  }
  
  /**
   * Create or update a quote
   */
  async saveQuote(
    billId: string, 
    systemSize: number, 
    totalCost: number,
    calculationResults: QuoteCalculationResults,
    status: QuoteStatus = 'draft',
    quoteId?: string
  ): Promise<SaveQuoteResult> {
    try {
      console.log('Saving quote:', {
        billId,
        systemSize, 
        totalCost,
        status,
        quoteId: quoteId || 'new quote'
      });
      
      const quoteData = {
        bill_id: billId,
        system_size: systemSize,
        total_cost: totalCost,
        calculations: calculationResults,
        status
      };
      
      let result;
      
      if (quoteId) {
        // Update existing quote
        result = await supabase
          .from('quotes')
          .update(quoteData)
          .eq('id', quoteId)
          .select('id')
          .single();
      } else {
        // Create new quote
        result = await supabase
          .from('quotes')
          .insert(quoteData)
          .select('id')
          .single();
      }
      
      if (result.error) {
        console.error('Error saving quote:', result.error);
        return {
          success: false,
          error: result.error.message
        };
      }
      
      return {
        success: true,
        id: result.data.id
      };
    } catch (err: any) {
      console.error('Error saving quote:', err);
      return {
        success: false,
        error: err.message || 'Unknown error'
      };
    }
  }
  
  /**
   * Debounced version of saveQuote for auto-saving
   */
  debouncedSaveQuote = debounce(
    this.saveQuote.bind(this),
    1000
  );
}

// Export a singleton instance
export const quoteService = new QuoteService();