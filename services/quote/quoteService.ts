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
  async calculateQuote(billId: string): Promise<QuoteCalculationResponse | null> {
    const MAX_RETRIES = 3;
    const BASE_DELAY = 1000;
    let attempt = 0;
    let lastError: any;

    while (attempt < MAX_RETRIES) {
      try {
        attempt++;
        console.log(`Calculation attempt ${attempt} for bill ${billId}`);
        
        const { data, error } = await supabase.rpc('generate_full_quote', {
          bill_id: billId
        });
        console.log('Raw RPC response:', {
          data: data,
          error: error,
          fullResponse: JSON.stringify({data, error}, null, 2)
        });

        if (error) throw error;

        await this.logCalculationAttempt({
          quoteId: data.id,
          status: 'success',
          attemptNumber: attempt,
          version: data.version
        });

        return data as QuoteCalculationResponse;
      } catch (error) {
        lastError = error;
        console.error(`Attempt ${attempt} failed:`, error);
        
        await this.logCalculationAttempt({
          quoteId: null,
          status: 'failed',
          attemptNumber: attempt,
          errorDetails: {
            message: error instanceof Error ? error.message : String(error),
            code: (error as any)?.code,
            details: (error as any)?.details
          }
        });

        if (attempt < MAX_RETRIES) {
          const delay = BASE_DELAY * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(`Calculation failed after ${MAX_RETRIES} attempts: ${lastError?.message}`);
  }

  private async logCalculationAttempt(params: {
    quoteId: string | null;
    status: 'success' | 'failed';
    attemptNumber: number;
    version?: number;
    errorDetails?: any;
  }): Promise<void> {
    const auditData: Record<string, any> = {
      attempt_number: params.attemptNumber,
      status: params.status,
      calculation_version: params.version || 1
    };
    
    if (params.quoteId) {
      auditData.quote_id = params.quoteId;
    }
    if (params.errorDetails) {
      auditData.error_details = params.errorDetails;
    }

    try {
      const { error } = await supabase
        .from('calculation_audit')
        .insert(auditData);

      if (error) {
        console.error('Failed to log calculation attempt:', {
          message: error.message,
          code: error.code,
          details: error.details,
          auditData
        });
      }
    } catch (err) {
      console.error('Critical failure logging attempt:', {
        error: err instanceof Error ? err.message : String(err),
        auditData
      });
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