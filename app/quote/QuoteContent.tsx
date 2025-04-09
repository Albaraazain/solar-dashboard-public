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
  Check,
} from "lucide-react";
import Link from "next/link";
import { useQuote } from "./QuoteProvider";

interface QuoteContentProps {
  monthlyUsage: number;
}

export default function QuoteContent({ monthlyUsage }: QuoteContentProps) {
  const [activeTab, setActiveTab] = useState("Sizing");
  const {
    state,
    updateSystemSize,
    updatePanelType,
    updateInverterType,
    panels,
    inverters,
    selectedPanel,
    selectedInverter
  } = useQuote();

  // Helper to format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("ur-PK", {
      style: "currency",
      currency: "PKR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
      .format(value)
      .replace("PKR", "Rs.");
  };

  // Adjust system size
  const adjustSystemSize = (increment: boolean) => {
    if (increment) {
      updateSystemSize(Math.min(state.systemSize + 0.5, 15)); // Max 15kW
    } else {
      updateSystemSize(Math.max(state.systemSize - 0.5, 1)); // Min 1kW
    }
  };

  // Calculate total cost from components
  type CostComponents = {
    labor?: number;
    installation?: number;
    net_metering?: number;
    transport?: number;
  };
  const calculateTotalCost = (costs: any) => {
    if (!costs?.components) return 0;
    const c = costs.components;
    
    const breakdown = {
      labor: c.labor ?? 0,
      installation: c.installation ?? 0,
      net_metering: c.net_metering ?? 0,
      transport: c.transport ?? 0
    };
    
    const total = Object.values(breakdown).reduce((sum, value) => sum + value, 0);
    
    const detailedBreakdown = {
      ...breakdown,
      total: total,
      estimatedSavings: total * 1.5,
      monthlyPayment: total / 60, // 5 year financing
      annualSavings: total * 0.11 // 11% annual return
    };
    
    console.log('Cost Breakdown:', detailedBreakdown);
    
    return total;
  };

  // Skip debug logs in production
  if (process.env.NODE_ENV === 'development') {
    console.group('Quote Cost Calculations');
    console.log('Raw calculation results:', state.calculationResults);
    console.groupEnd();
  }

  // Log costs structure
  const rawCosts = state.calculationResults?.system.costs;
  const totalCost = calculateTotalCost(rawCosts);
  
  // Log the calculated total
  useEffect(() => {
    if (totalCost > 0) {
      console.log('Calculated total cost:', totalCost);
    }
  }, [totalCost]);
  console.log('Raw costs structure:', {
    rawCosts,
    components: rawCosts?.components,
    summary: rawCosts?.summary
  });

  // Get quote breakdown from calculation results
  const costs = state.calculationResults?.system.costs || {
    components: {
      labor: 0,
      panels: {
        cost: 0,
        details: {
          brand: "",
          count: 0,
          power: 0,
          unit_price: 0
        }
      },
      wiring: {
        ac_cable: 0,
        dc_cable: 0
      },
      inverter: {
        cost: 0,
        details: {
          brand: "",
          power: 0
        }
      },
      structure: {
        cost: 0,
        details: {
          rate: 0,
          type: ""
        }
      },
      transport: 0,
      accessories: 0,
      installation: 0,
      net_metering: 0
    },
    summary: {
      hardware: 0,
      per_watt: 0,
      services: 0
    },
    total: 0
  };

  // Calculate panel total price
  const panelTotalPrice = state.calculationResults?.system.panel ?
    state.calculationResults.system.panel.price * state.calculationResults.system.panel.count : 0;

  // Get weather impact data
  const weatherData = state.calculationResults?.weather || {
    region: "Central Pakistan",
    solar_intensity: 5.1,
    seasonal_variation: {
      fall: 0.9,
      spring: 0.95,
      summer: 1.25,
      winter: 0.7
    },
    annual_sunshine_hours: 3100
  };

  // Get energy details
  const energyDetails = state.calculationResults?.energy || {
    peak_usage: monthlyUsage * 0.42,
    monthly_usage: monthlyUsage,
    offpeak_usage: monthlyUsage * 0.58,
    efficiency_score: 0.75,
    comparison_metrics: {
      efficient_homes: monthlyUsage * 0.6,
      regional_average: monthlyUsage * 0.85
    },
    estimated_production: monthlyUsage * 1.2
  };

  // Auto-save status message
  const getSaveStatusMessage = () => {
    if (state.isSaving) return "Saving...";
    if (state.lastSaved) {
      const now = new Date();
      const diff = Math.floor((now.getTime() - state.lastSaved.getTime()) / 1000);
      
      if (diff < 60) return "Saved just now";
      if (diff < 3600) return `Saved ${Math.floor(diff / 60)} minutes ago`;
      return `Saved ${Math.floor(diff / 3600)} hours ago`;
    }
    return "Not saved yet";
  };

  return (
    <div className="max-w-[1440px] mx-auto w-full p-4 md:p-6 relative">
      {/* Header */}
      <header className="flex justify-between items-center mb-6 md:mb-8">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white p-2 rounded-lg shadow-md">
            <Sun className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-lg">
              energy
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-emerald-500 to-emerald-600">
                cove
              </span>
            </div>
            <div className="text-xs text-gray-500">Smart Solar Sizing System</div>
          </div>
        </div>
        <div className="flex gap-3 items-center">
          <div className="text-sm text-gray-500 hidden sm:block">
            {state.billReference ? `Ref: ${state.billReference}` : "New Quote"}
          </div>
          <Link href="/" className="h-8 w-8 bg-white rounded-full flex items-center justify-center text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors shadow-md border border-gray-100">
            <Home className="w-4 h-4" />
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <div className="relative mb-8 md:mb-10 bg-gradient-to-r from-emerald-500 to-emerald-700 rounded-2xl overflow-hidden shadow-xl">
        <div className="absolute inset-0 bg-black/10"></div>
        <div className="relative z-10 p-6 md:p-10 flex flex-col md:flex-row items-center gap-6 md:gap-8">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 md:mb-4">
              Your Perfect Solar Solution
            </h1>
            <p className="text-emerald-50 mb-4 md:mb-6 text-base md:text-lg">
              Customized system sizing based on your energy profile and location data.
            </p>
            <div className="flex gap-3 md:gap-4 items-center">
              <div className="text-white/80 text-sm">
                <span className="flex items-center gap-1">
                  {state.isSaving ? (
                    <div className="animate-spin h-3 w-3 border-2 border-white/80 border-t-transparent rounded-full mr-1"></div>
                  ) : state.lastSaved ? (
                    <Check className="w-3 h-3 text-emerald-200" />
                  ) : null}
                  {getSaveStatusMessage()}
                </span>
              </div>
              <Link
                href="/bill"
                className="bg-emerald-800/30 text-white border border-white/30 px-4 md:px-6 py-2 md:py-3 rounded-lg font-medium backdrop-blur-sm hover:bg-emerald-800/40 transition-all"
              >
                Back to Bill
              </Link>
            </div>
          </div>
          <div className="w-32 h-32 md:w-40 md:h-40 lg:w-48 lg:h-48 relative">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-400/20 to-emerald-700/20 rounded-full animate-pulse"></div>
            <div className="absolute inset-4 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center">
              <div className="text-center">
                <div className="text-3xl md:text-5xl font-bold text-white mb-1 md:mb-2">{state.systemSize}</div>
                <div className="text-sm md:text-base text-emerald-100">kW System</div>
              </div>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-emerald-800/40 to-transparent"></div>
      </div>

      {/* Tabs */}
      <div className="flex justify-center mb-8 md:mb-10 overflow-x-auto scrollbar-hide">
        <div className="bg-white rounded-xl flex p-1.5 shadow-lg border border-gray-100">
          {["Sizing", "Equipment", "Installation", "Monitoring"].map((tab) => (
            <button
              key={tab}
              className={`px-4 sm:px-6 py-2 sm:py-2.5 text-sm rounded-lg transition-all whitespace-nowrap ${
                activeTab === tab
                  ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-md"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              }`}
              onClick={() => setActiveTab(tab)}
              title={`Switch to ${tab} tab`}
              aria-label={`Switch to ${tab} tab`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Section Title */}
      <div className="mb-6 md:mb-8 text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Solar System Sizing</h2>
        <p className="text-gray-500 max-w-2xl mx-auto text-sm md:text-base">
          Our AI has analyzed your energy consumption patterns and local weather data to recommend the optimal solar
          system for your needs.
        </p>
      </div>

      {/* Quote Total Summary Card */}
      <div className="bg-white rounded-2xl p-6 shadow-xl border border-gray-100 mb-6 md:mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-gray-800 mb-2">Your Solar Quote</h3>
            <p className="text-gray-600">
              {state.systemSize}kW system with {Math.ceil((state.systemSize * 1000) / (selectedPanel?.power || 1))} {selectedPanel?.brand} panels
            </p>
          </div>
          <div className="text-center md:text-right">
            <div className="text-3xl md:text-4xl font-bold text-emerald-600">
              {totalCost ? formatCurrency(totalCost) : "Calculating..."}
            </div>
            <div className="flex flex-col gap-1">
              <div className="text-xs text-gray-500">
                Installation & Labor: {formatCurrency((costs?.components?.labor ?? 0) + (costs?.components?.installation ?? 0))}
              </div>
              {totalCost > 0 && (
                <div className="text-xs text-emerald-600">
                  Monthly Payment: ~{formatCurrency(totalCost / 60)} (5 year financing)
                </div>
              )}
            </div>
            <div className="text-sm text-gray-500">Estimated savings of {formatCurrency(state.totalCost ? state.totalCost * 1.5 : 0)} over 25 years</div>
          </div>
        </div>
      </div>

      {/* Dashboard Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 auto-rows-auto">
        {/* Energy Usage - 4 columns */}
        <div className="md:col-span-4 bg-white rounded-2xl p-4 md:p-6 shadow-lg border border-gray-100 overflow-hidden relative group hover:shadow-xl transition-all h-full">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-100 to-transparent rounded-bl-full -mr-10 -mt-10 opacity-70"></div>
          <div className="relative">
            <div className="flex justify-between items-center mb-4 md:mb-6">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-100 p-2 rounded-lg">
                  <Zap className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="font-semibold text-gray-800">Monthly Energy Usage</div>
              </div>
              <div className="text-gray-400 group-hover:text-emerald-500 transition-colors">
                <ChevronRight className="w-5 h-5" />
              </div>
            </div>
            <div className="text-4xl md:text-5xl font-bold mb-4 text-gray-900 flex items-end gap-2">
              {monthlyUsage} <span className="text-lg md:text-xl text-gray-500 font-normal">kWh</span>
            </div>
            <div className="space-y-3 mb-6">
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 mr-2"></div>
                  <span className="text-sm">Peak Hours</span>
                </div>
                <span className="text-sm font-medium">{Math.round(monthlyUsage * 0.42)} kWh</span>
              </div>
              <div className="flex justify-between items-center">
                <div className="flex items-center">
                  <div className="w-3 h-3 rounded-full bg-gray-800 mr-2"></div>
                  <span className="text-sm">Off-Peak</span>
                </div>
                <span className="text-sm font-medium">{Math.round(monthlyUsage * 0.58)} kWh</span>
              </div>
            </div>
            <div className="bg-emerald-50 p-3 rounded-lg">
              <div className="text-sm text-emerald-700">
                <span className="font-medium">Solar Production:</span> ~{Math.round(state.systemSize * 120)} kWh/month
              </div>
            </div>
          </div>
        </div>

        {/* Recommended System Size - 4 columns */}
        <div className="md:col-span-4 bg-white rounded-2xl p-4 md:p-6 shadow-lg border border-gray-100 overflow-hidden relative group hover:shadow-xl transition-all h-full">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-100 to-transparent rounded-bl-full -mr-10 -mt-10 opacity-70"></div>
          <div className="relative">
            <div className="flex justify-between items-center mb-4 md:mb-6">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-100 p-2 rounded-lg">
                  <Sun className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="font-semibold text-gray-800">System Size</div>
              </div>
              <div className="text-gray-400 group-hover:text-emerald-500 transition-colors">
                <ChevronRight className="w-5 h-5" />
              </div>
            </div>
            
            <div className="flex items-center justify-between mb-6">
              <button
                onClick={() => adjustSystemSize(false)}
                className="bg-gray-100 p-2 rounded-full hover:bg-gray-200 transition-colors"
                disabled={state.systemSize <= 1}
                title="Decrease system size"
                aria-label="Decrease system size"
              >
                <Minus className="w-5 h-5 text-gray-700" />
              </button>
              
              <div className="text-4xl md:text-5xl font-bold text-gray-900">
                {state.systemSize} <span className="text-lg md:text-xl text-gray-500 font-normal">kW</span>
              </div>
              
              <button
                onClick={() => adjustSystemSize(true)}
                className="bg-gray-100 p-2 rounded-full hover:bg-gray-200 transition-colors"
                disabled={state.systemSize >= 15}
                title="Increase system size"
                aria-label="Increase system size"
              >
                <Plus className="w-5 h-5 text-gray-700" />
              </button>
            </div>

            <div className="space-y-4 md:space-y-5">
              <div>
                <div className="text-xs text-gray-500 mb-1 flex justify-between">
                  <span>Minimum</span>
                  <span>Recommended</span>
                  <span>Maximum</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full mb-1 relative">
                  <div className="h-full w-[60%] bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full"></div>
                  <div className="absolute top-1/2 left-[60%] -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-emerald-500 rounded-full shadow-md"></div>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>5.0 kW</span>
                  <span>10.0 kW</span>
                </div>
              </div>

              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div className="text-sm">Number of Panels</div>
                <div className="text-sm font-medium bg-emerald-100 px-3 py-1 rounded-full text-emerald-700">
                  {Math.ceil((state.systemSize * 1000) / (selectedPanel?.power || 1))} panels
                </div>
              </div>

              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div className="text-sm">Panel Wattage</div>
                <div className="text-sm font-medium bg-emerald-100 px-3 py-1 rounded-full text-emerald-700">
                  {selectedPanel?.power}W
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Weather & Production - 4 columns */}
        <div className="md:col-span-4 bg-white rounded-2xl p-4 md:p-6 shadow-lg border border-gray-100 overflow-hidden relative group hover:shadow-xl transition-all h-full">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-100 to-transparent rounded-bl-full -mr-10 -mt-10 opacity-70"></div>
          <div className="relative">
            <div className="flex justify-between items-center mb-4 md:mb-6">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-100 p-2 rounded-lg">
                  <CloudSun className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="font-semibold text-gray-800">Weather & Production</div>
              </div>
              <div className="text-gray-400 group-hover:text-emerald-500 transition-colors">
                <ChevronRight className="w-5 h-5" />
              </div>
            </div>

            <div className="flex justify-between mb-4 md:mb-6">
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-gray-900">5.2</div>
                <div className="text-sm text-gray-500">Sun hours/day</div>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-gray-900">92%</div>
                <div className="text-sm text-gray-500">Efficiency</div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-4 md:mb-6">
              <div className="bg-gray-50 p-2 md:p-3 rounded-lg text-center">
                <Cloud className="w-4 h-4 md:w-5 md:h-5 text-gray-400 mx-auto mb-1" />
                <div className="text-xs text-gray-500">Cloud Cover</div>
                <div className="text-xs md:text-sm font-medium">12%</div>
              </div>
              <div className="bg-gray-50 p-2 md:p-3 rounded-lg text-center">
                <ThermometerSun className="w-4 h-4 md:w-5 md:h-5 text-orange-400 mx-auto mb-1" />
                <div className="text-xs text-gray-500">Temperature</div>
                <div className="text-xs md:text-sm font-medium">78°F</div>
              </div>
              <div className="bg-gray-50 p-2 md:p-3 rounded-lg text-center">
                <Wind className="w-4 h-4 md:w-5 md:h-5 text-blue-400 mx-auto mb-1" />
                <div className="text-xs text-gray-500">Wind</div>
                <div className="text-xs md:text-sm font-medium">5 mph</div>
              </div>
            </div>

            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
              <div className="text-sm font-medium text-emerald-800 mb-2">Annual Production</div>
              <div className="text-xl md:text-2xl font-bold text-emerald-700">{Math.round(state.systemSize * 1460)} kWh</div>
              <div className="text-xs text-emerald-600 mt-1">+15% above regional average</div>
            </div>
          </div>
        </div>
        
        {/* Panel Type Selection - 6 columns */}
        <div className="md:col-span-6 bg-white rounded-2xl p-4 md:p-6 shadow-lg border border-gray-100 overflow-hidden relative group hover:shadow-xl transition-all h-full">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-100 to-transparent rounded-bl-full -mr-10 -mt-10 opacity-70"></div>
          <div className="relative">
            <div className="flex justify-between items-center mb-4 md:mb-6">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-100 p-2 rounded-lg">
                  <Sun className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="font-semibold text-gray-800">Panel Type</div>
              </div>
              <div className="text-gray-400 group-hover:text-emerald-500 transition-colors">
                <ChevronRight className="w-5 h-5" />
              </div>
            </div>

            <div className="mb-4">
              <div className="text-sm text-gray-500 mb-3">Select your preferred solar panel type:</div>
              <div className="overflow-x-auto pb-2 -mx-2 px-2 scrollbar-hide">
                <div className="flex gap-3 min-w-max pb-1">
                  {panels.map((panel) => (
                    <div
                      key={panel.id}
                      className={`flex-shrink-0 w-40 sm:w-48 p-3 md:p-4 rounded-xl border-2 transition-all cursor-pointer ${
                        state.selectedPanelType === panel.id
                          ? "border-emerald-500 bg-emerald-50"
                          : "border-gray-100 bg-white hover:border-emerald-200"
                      }`}
                      onClick={() => updatePanelType(panel.id)}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div
                          className={`text-sm font-medium ${
                            state.selectedPanelType === panel.id ? "text-emerald-700" : "text-gray-800"
                          }`}
                        >
                          {panel.brand}
                        </div>
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            state.selectedPanelType === panel.id
                              ? "border-emerald-500 bg-emerald-500"
                              : "border-gray-300"
                          }`}
                        >
                          {state.selectedPanelType === panel.id && (
                            <div className="w-2 h-2 rounded-full bg-white"></div>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <div className="text-xs text-gray-500">Power</div>
                          <div className="text-xs font-medium">{panel.power}W</div>
                        </div>
                        <div className="flex justify-between">
                          <div className="text-xs text-gray-500">Price</div>
                          <div className="text-xs font-medium">{formatCurrency(panel.price)}</div>
                        </div>
                        <div className="flex justify-between">
                          <div className="text-xs text-gray-500">Panels</div>
                          <div className="text-xs font-medium">{Math.ceil((state.systemSize * 1000) / panel.power)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
              <div className="flex items-start gap-3">
                <div className="bg-emerald-100 p-2 rounded-lg mt-1">
                  <Info className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <div className="text-sm font-medium text-emerald-800 mb-1">{selectedPanel?.brand} Panels</div>
                  <div className="text-sm text-emerald-700">
                    {selectedPanel?.power}W panels will require {Math.ceil((state.systemSize * 1000) / (selectedPanel?.power || 1))} panels for your {state.systemSize}kW system.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Inverter Type Selection - 6 columns */}
        <div className="md:col-span-6 bg-white rounded-2xl p-4 md:p-6 shadow-lg border border-gray-100 overflow-hidden relative group hover:shadow-xl transition-all h-full">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-100 to-transparent rounded-bl-full -mr-10 -mt-10 opacity-70"></div>
          <div className="relative">
            <div className="flex justify-between items-center mb-4 md:mb-6">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-100 p-2 rounded-lg">
                  <Zap className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="font-semibold text-gray-800">Inverter Type</div>
              </div>
              <div className="text-gray-400 group-hover:text-emerald-500 transition-colors">
                <ChevronRight className="w-5 h-5" />
              </div>
            </div>

            <div className="mb-4">
              <div className="text-sm text-gray-500 mb-3">Select your preferred inverter technology:</div>
              <div className="overflow-x-auto pb-2 -mx-2 px-2 scrollbar-hide">
                <div className="flex gap-3 min-w-max pb-1">
                  {inverters.map((inverter) => (
                    <div
                      key={inverter.id}
                      className={`flex-shrink-0 w-40 sm:w-48 p-3 md:p-4 rounded-xl border-2 transition-all cursor-pointer ${
                        state.selectedInverterType === inverter.id
                          ? "border-emerald-500 bg-emerald-50"
                          : "border-gray-100 bg-white hover:border-emerald-200"
                      }`}
                      onClick={() => updateInverterType(inverter.id)}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div
                          className={`text-sm font-medium ${
                            state.selectedInverterType === inverter.id ? "text-emerald-700" : "text-gray-800"
                          }`}
                        >
                          {inverter.brand}
                        </div>
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            state.selectedInverterType === inverter.id
                              ? "border-emerald-500 bg-emerald-500"
                              : "border-gray-300"
                          }`}
                        >
                          {state.selectedInverterType === inverter.id && (
                            <div className="w-2 h-2 rounded-full bg-white"></div>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <div className="text-xs text-gray-500">Power</div>
                          <div className="text-xs font-medium">{inverter.power}kW</div>
                        </div>
                        <div className="flex justify-between">
                          <div className="text-xs text-gray-500">Price</div>
                          <div className="text-xs font-medium">{formatCurrency(inverter.price)}</div>
                        </div>
                        <div className="flex justify-between">
                          <div className="text-xs text-gray-500">Units</div>
                          <div className="text-xs font-medium">{Math.ceil(state.systemSize / inverter.power)}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
              <div className="flex items-start gap-3">
                <div className="bg-emerald-100 p-2 rounded-lg mt-1">
                  <Info className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <div className="text-sm font-medium text-emerald-800 mb-1">{selectedInverter?.brand} Inverter</div>
                  <div className="text-sm text-emerald-700">
                    {selectedInverter?.power}kW inverter{Math.ceil(state.systemSize / (selectedInverter?.power || 1)) > 1 ? 's' : ''} - you'll need {Math.ceil(state.systemSize / (selectedInverter?.power || 1))} unit{Math.ceil(state.systemSize / (selectedInverter?.power || 1)) > 1 ? 's' : ''} for your {state.systemSize}kW system.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3D Roof Visualization - 6 columns */}
        <div className="md:col-span-6 bg-white rounded-2xl overflow-hidden shadow-lg border border-gray-100 group hover:shadow-xl transition-all h-full">
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white p-4 md:p-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-lg backdrop-blur-sm">
                  <Home className="w-5 h-5 text-white" />
                </div>
                <div className="font-semibold">3D Roof Visualization</div>
              </div>
              <div className="flex gap-2">
                <button
                  className="bg-white/20 p-2 rounded-lg backdrop-blur-sm"
                  aria-label="View camera angle"
                  title="View camera angle"
                >
                  <Camera className="w-4 h-4 text-white" />
                </button>
                <button
                  className="bg-white/20 p-2 rounded-lg backdrop-blur-sm"
                  aria-label="View map location"
                  title="View map location"
                >
                  <MapPin className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          </div>

          <div className="relative h-[250px] md:h-[300px]">
            <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300">
              <div className="absolute inset-0 grid grid-cols-7 grid-rows-3 gap-1 p-8 transform perspective-800 rotateX-10">
                {Array(Math.min(21, Math.ceil((state.systemSize * 1000) / (selectedPanel?.power || 1))))
                  .fill(0)
                  .map((_, i) => (
                    <div
                      key={i}
                      className="bg-emerald-500/60 border border-emerald-500/80 rounded-sm shadow-md transform hover:translate-z-2 hover:bg-emerald-500/80 transition-all duration-300"
                    ></div>
                  ))}
              </div>
            </div>

            {/* Controls */}
            <div className="absolute right-4 bottom-4 flex flex-col gap-2">
              <button
                className="bg-white p-2 rounded-lg shadow-md"
                aria-label="Zoom in"
              >
                <Plus className="w-4 h-4 text-gray-700" />
              </button>
              <button
                className="bg-white p-2 rounded-lg shadow-md"
                aria-label="Zoom out"
              >
                <Minus className="w-4 h-4 text-gray-700" />
              </button>
            </div>

            {/* Info overlay */}
            <div className="absolute left-4 bottom-4 bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow-md">
              <div className="text-sm font-medium text-gray-800">South Facing</div>
              <div className="text-xs text-gray-600">30° Pitch • Minimal Shading</div>
            </div>
          </div>

          <div className="p-4 md:p-6">
            <div className="grid grid-cols-2 gap-4 mb-4 md:mb-6">
              <div className="bg-gray-50 p-3 md:p-4 rounded-xl">
                <div className="text-sm text-gray-500 mb-1">Required Area</div>
                <div className="text-lg md:text-xl font-medium text-gray-900">
                  {Math.round(Math.ceil((state.systemSize * 1000) / (selectedPanel?.power || 1)) * 1.8)} m²
                </div>
              </div>
              <div className="bg-gray-50 p-3 md:p-4 rounded-xl">
                <div className="text-sm text-gray-500 mb-1">Efficiency Rating</div>
                <div className="text-lg md:text-xl font-medium text-gray-900">95%</div>
              </div>
            </div>

            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
              <div className="flex items-start gap-3">
                <div className="bg-emerald-100 p-2 rounded-lg mt-1">
                  <Info className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <div className="text-sm font-medium text-emerald-800 mb-1">Optimal Configuration</div>
                  <div className="text-sm text-emerald-700">
                    Your roof is ideal for solar installation with excellent sun exposure throughout the day.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quote Breakdown - 6 columns */}
        <div className="md:col-span-6 bg-white rounded-2xl p-4 md:p-6 shadow-lg border border-gray-100 overflow-hidden relative group hover:shadow-xl transition-all h-full">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-100 to-transparent rounded-bl-full -mr-10 -mt-10 opacity-70"></div>
          <div className="relative">
            <div className="flex justify-between items-center mb-4 md:mb-6">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-100 p-2 rounded-lg">
                  <DollarSign className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="font-semibold text-gray-800">Quote Breakdown</div>
              </div>
            </div>

            <div className="space-y-3 mb-4">
              {/* Main system components */}
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">
                  Labor & Installation
                </span>
                <span className="text-sm font-medium">
                  {formatCurrency((costs?.components?.labor ?? 0) + (costs?.components?.installation ?? 0))}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">
                  Net Metering Setup
                </span>
                <span className="text-sm font-medium">
                  {formatCurrency(costs?.components?.net_metering ?? 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Transport</span>
                <span className="text-sm font-medium">
                  {formatCurrency(costs?.components?.transport ?? 0)}
                </span>
              </div>
              <div className="border-t pt-2 flex justify-between font-semibold">
                <span>Total</span>
                <span className="text-emerald-600">{totalCost ? formatCurrency(totalCost) : "Calculating..."}</span>
              </div>
            </div>

            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
              <div className="flex items-start gap-3">
                <div className="bg-emerald-100 p-2 rounded-lg mt-1">
                  <Info className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <div className="text-sm font-medium text-emerald-800 mb-1">Savings & ROI</div>
                  <div className="text-sm text-emerald-700">
                    Your {state.systemSize}kW system could save up to {formatCurrency(totalCost ? totalCost * 0.11 : 0)} annually, with
                    total savings of {formatCurrency(totalCost ? totalCost * 1.5 : 0)} over 25 years.
                    <div className="bg-emerald-100/50 mt-2 p-2 rounded-lg grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <div className="text-emerald-700 font-medium">Monthly Payment</div>
                        <div className="text-emerald-800">{formatCurrency(totalCost ? totalCost / 60 : 0)}</div>
                      </div>
                      <div>
                        <div className="text-emerald-700 font-medium">Payback Period</div>
                        <div className="text-emerald-800">~{totalCost ? Math.round(totalCost / (totalCost * 0.11)) : 0} years</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* System Summary - 12 columns */}
        <div className="md:col-span-12 bg-white rounded-2xl p-4 md:p-6 shadow-lg border border-gray-100 overflow-hidden relative group hover:shadow-xl transition-all">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-100 to-transparent rounded-bl-full -mr-10 -mt-10 opacity-70"></div>
          <div className="relative">
            <div className="flex justify-between items-center mb-4 md:mb-6">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-100 p-2 rounded-lg">
                  <Sun className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="font-semibold text-gray-800">System Summary</div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-4 md:mb-6">
              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                <div className="flex items-start gap-3">
                  <div className="bg-emerald-100 p-2 rounded-lg mt-1">
                    <Sun className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-emerald-800 mb-1">Solar System</div>
                    <div className="text-sm text-emerald-700">
                      {state.systemSize} kW system with {Math.ceil((state.systemSize * 1000) / (selectedPanel?.power || 1))} {selectedPanel?.brand} panels ({selectedPanel?.power}W each)
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                <div className="flex items-start gap-3">
                  <div className="bg-emerald-100 p-2 rounded-lg mt-1">
                    <Zap className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-emerald-800 mb-1">Inverter Solution</div>
                    <div className="text-sm text-emerald-700">
                      {selectedInverter?.brand} {selectedInverter?.power}kW with {" "}
                      {Math.ceil(state.systemSize / (selectedInverter?.power || 1))} unit{Math.ceil(state.systemSize / (selectedInverter?.power || 1)) > 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                <div className="flex items-start gap-3">
                  <div className="bg-emerald-100 p-2 rounded-lg mt-1">
                    <Droplets className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-emerald-800 mb-1">Battery Recommendation</div>
                    <div className="text-sm text-emerald-700">13.5 kWh Powerwall for 85% energy independence</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4 md:gap-6">
              <div className="flex-1 bg-white border border-emerald-200 text-emerald-700 py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow hover:bg-emerald-50 transform hover:-translate-y-0.5">
                <span className="font-medium">Last saved: {state.lastSaved ? new Date(state.lastSaved).toLocaleTimeString() : 'Not saved yet'}</span>
                {state.isSaving ? (
                  <div className="animate-spin h-4 w-4 border-2 border-emerald-700 border-t-transparent rounded-full"></div>
                ) : (
                  <Check className="w-4 h-4" />
                )}
              </div>
              <Link
                href="/bill"
                className="flex-1 bg-white border border-emerald-200 text-emerald-700 py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow hover:bg-emerald-50 transform hover:-translate-y-0.5"
              >
                <span className="font-medium">Back to Bill Analysis</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}