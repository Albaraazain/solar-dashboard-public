// app/quote/page.tsx
"use client";

import { useState, useEffect } from "react";
import {
  Camera,
  MapPin,
  Plus,
  Minus,
  Info,
  Sun,
  Home,
  DollarSign,
  Zap,
  ArrowRight,
  ChevronRight,
  Cloud,
  CloudSun,
  Wind,
  ThermometerSun,
  Droplets,
} from "lucide-react";
import Link from "next/link";
import { fetchBillByReference } from "@/utils/supabase";
import { QuoteProvider } from "./QuoteProvider";
import QuoteContent from "./QuoteContent";

export default function SizingPage() {
  const [billReference, setBillReference] = useState<string | null>(null);
  const [billId, setBillId] = useState<string | null>(null);
  const [monthlyUsage, setMonthlyUsage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch bill data on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Get bill reference from localStorage
        const storedBillRef = localStorage.getItem('billReference');
        setBillReference(storedBillRef);
        
        // Get bill data if available
        if (storedBillRef) {
          const billRecord = await fetchBillByReference(storedBillRef);
            
          if (billRecord) {
            setBillId(billRecord.id);
            
            // Set monthly usage based on bill data
            setMonthlyUsage(billRecord.units_consumed);
          } else {
            throw new Error("Bill not found. Please try again with a valid reference.");
          }
        } else {
          throw new Error("No bill reference found. Please go back to the home page and enter your bill details.");
        }
        
        setLoading(false);
      } catch (err: any) {
        console.error('Error fetching data:', err);
        setError(err.message || 'Failed to load data. Please try again.');
        setLoading(false);
      }
    };
    
    fetchData();
  }, []);

  // Custom scrollbar hiding styles
  const scrollbarHideStyles = `
    .scrollbar-hide::-webkit-scrollbar {
      display: none;
    }
    .scrollbar-hide {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
  `;

  // Render loading state
  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 text-gray-800 items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow-lg">
          <div className="animate-spin w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-center text-gray-600">Loading system configuration...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="flex flex-col min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 text-gray-800 items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md">
          <div className="text-red-500 text-center mb-4">
            <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-center text-gray-800 mb-4">{error}</p>
          <div className="flex gap-4">
            <Link
              href="/"
              className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 transition-colors text-center"
            >
              Go Home
            </Link>
            <button 
              className="flex-1 bg-emerald-500 text-white py-2 rounded-lg hover:bg-emerald-600 transition-colors"
              onClick={() => window.location.reload()}
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 text-gray-800">
      <style jsx>{scrollbarHideStyles}</style>
      
      <QuoteProvider 
        billId={billId || undefined}
        billReference={billReference || undefined}
        initialMonthlyUsage={monthlyUsage}
      >
        <QuoteContent monthlyUsage={monthlyUsage} />
      </QuoteProvider>
    </div>
  );
}