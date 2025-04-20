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
  RefreshCcw,
} from "lucide-react";
import Link from "next/link";
import {
  supabase,
  Panel,
  Inverter,
  StructureType,
  BracketCost,
  VariableCost,
  fetchPanels,
  fetchInverters,
  fetchStructureTypes,
  fetchBracketCosts,
  fetchVariableCosts,
  fetchBillByReference,
  createQuote,
} from "@/utils/supabase";
import {
  calculateSystemSizing,
  EquipmentCombination,
  SystemSizingInput,
  SystemSizingResponse,
} from "@/utils/edgeFunctions";

export default function SizingPage() {
  const [activeTab, setActiveTab] = useState("Sizing");
  const [selectedPanelType, setSelectedPanelType] = useState("");
  const [selectedInverterType, setSelectedInverterType] = useState("");
  const [systemSize, setSystemSize] = useState(7.5); // Default system size
  const [sizingResult, setSizingResult] = useState<SystemSizingResponse | null>(
    null
  );
  const [userAdjustedSize, setUserAdjustedSize] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [panels, setPanels] = useState<Panel[]>([]);
  const [inverters, setInverters] = useState<Inverter[]>([]);
  const [structureTypes, setStructureTypes] = useState<StructureType[]>([]);
  const [bracketCosts, setBracketCosts] = useState<BracketCost[]>([]);
  const [variableCosts, setVariableCosts] = useState<VariableCost[]>([]);
  const [quoteTotal, setQuoteTotal] = useState<number | null>(null);
  const [quoteBreakdown, setQuoteBreakdown] = useState<{
    [key: string]: number;
  }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthlyUsage, setMonthlyUsage] = useState(856);
  const [weatherData, setWeatherData] = useState<{
    sunHours: number;
    efficiency: number;
    temperatureImpact: number;
    annualProduction: number;
  } | null>(null);
  const [roofRequirements, setRoofRequirements] = useState<{
    area: number;
    efficiency: number;
    orientation: string;
    shading: number;
  } | null>(null);
  const [batteryRecommendation, setBatteryRecommendation] = useState<{
    recommended_capacity: number;
    autonomy_days: number;
    estimated_cost: number;
    efficiency_rating: number;
    lifespan_years: number;
  } | null>(null);
  const [billReference, setBillReference] = useState<string | null>(null);
  const [billId, setBillId] = useState<string | null>(null);
  const [savingQuote, setSavingQuote] = useState(false);
  const [quoteSaved, setQuoteSaved] = useState(false);

  const [equipmentCombinations, setEquipmentCombinations] = useState<
    EquipmentCombination[]
  >([]);
  const [selectedCombination, setSelectedCombination] =
    useState<EquipmentCombination | null>(null);
  // Get the selected panel and inverter data
  const selectedPanel =
    panels.find((panel) => panel.id === selectedPanelType) || panels[0];
  const selectedInverter =
    inverters.find((inverter) => inverter.id === selectedInverterType) ||
    inverters[0];
  const selectedStructureType = structureTypes[0]; // Default to first structure type

  // Function to update costs based on UI selections
  const updateCostsBasedOnSelection = () => {
    if (
      !selectedPanelType ||
      !selectedInverterType ||
      !equipmentCombinations.length
    ) {
      return;
    }

    // Find the combination for the current selections
    const combination = equipmentCombinations.find(
      (combo) =>
        combo.panelId === selectedPanelType &&
        combo.inverterId === selectedInverterType
    );

    if (combination) {
      console.log("Found equipment combination:", combination);

      // Update all states based on this combination
      setSelectedCombination(combination);

      // Update costs
      setQuoteBreakdown(combination.costs);
      setQuoteTotal(combination.costs.total);

      // Update roof requirements
      setRoofRequirements({
        area: combination.roof.required_area,
        efficiency: combination.roof.layout_efficiency,
        orientation: combination.roof.optimal_orientation,
        shading: combination.roof.shading_impact,
      });
    } else {
      console.warn(
        "No matching combination found for",
        selectedPanelType,
        selectedInverterType
      );
    }
  };
  const updateEquipmentOptions = (
    result: SystemSizingResponse,
    preserveSelection: boolean = false
  ) => {
    // Store previous selections if we want to preserve them
    const currentPanelType = preserveSelection ? selectedPanelType : null;
    const currentInverterType = preserveSelection ? selectedInverterType : null;

    // Process panel options
    if (result?.equipment?.panelOptions?.length > 0) {
      // Store the panels from edge function
      setPanels(
        result.equipment.panelOptions.map((option) => ({
          id: `panel-${option.brand}-${option.power}`,
          brand: option.brand,
          power: option.power,
          price: option.pricePerUnit,
          default_choice: option.defaultChoice,
          availability: true,
        }))
      );
    }

    // Process inverter options
    if (result?.equipment?.inverters?.length > 0) {
      // Store the inverters from edge function
      setInverters(
        result.equipment.inverters.map((option) => ({
          id: `inverter-${option.brand}-${option.power}`,
          brand: option.brand,
          power: option.power,
          price: option.pricePerUnit,
          availability: true,
        }))
      );
    }

    // Store combination data
    if (result?.equipment?.combinations) {
      setEquipmentCombinations(result.equipment.combinations);
    }

    // Only set default selections if we're not preserving user selection
    if (!preserveSelection && result?.equipment?.defaultCombination) {
      setSelectedPanelType(result.equipment.defaultCombination.panelId);
      setSelectedInverterType(result.equipment.defaultCombination.inverterId);
    } else if (preserveSelection) {
      // Restore user selections if panel/inverter still exists in the new options
      if (currentPanelType && panels.some((p) => p.id === currentPanelType)) {
        setSelectedPanelType(currentPanelType);
      } else if (result?.equipment?.defaultCombination) {
        setSelectedPanelType(result.equipment.defaultCombination.panelId);
      }

      if (
        currentInverterType &&
        inverters.some((i) => i.id === currentInverterType)
      ) {
        setSelectedInverterType(currentInverterType);
      } else if (result?.equipment?.defaultCombination) {
        setSelectedInverterType(result.equipment.defaultCombination.inverterId);
      }
    }
  };

  // Calculate quote using edge function
  const calculateQuoteTotal = async () => {
    try {
      console.log("Starting quote calculation with:");
      console.log("Monthly usage:", monthlyUsage);
      console.log("System size:", systemSize);

      // Prepare input for the edge function
      const input: SystemSizingInput = {
        monthlyUsage,
        location: "Central Pakistan", // Default, can make this configurable
        roofDirection: "south", // Default, can make this configurable
        roofType: "standard", // Default, can make this configurable
        shading: "minimal", // Default, can make this configurable
      };

      // If the user manually adjusted the system size, force it
      if (userAdjustedSize) {
        input.forceSize = systemSize;
      }

      // Call the edge function
      const result = await calculateSystemSizing(input);
      console.log("System sizing result:", result);
      setSizingResult(result);

      // Update equipment options from edge function response
      updateEquipmentOptions(result);

      // Update system size from calculation (if not forced)
      if (!userAdjustedSize) {
        setSystemSize(result.systemSize);
      }

      // Update weather data
      setWeatherData({
        sunHours:
          result.weather?.sunHours || result.production?.peakSunHours || 5.2,
        efficiency: Math.round(
          result.efficiencyFactors?.systemEfficiency || 92
        ),
        temperatureImpact: result.weather?.temperatureImpact || 9,
        annualProduction:
          result.production?.annual || Math.round(systemSize * 1460),
      });

      // Update roof requirements
      setRoofRequirements({
        area:
          result.roof?.required_area ||
          Math.round(
            Math.ceil((systemSize * 1000) / (selectedPanel?.power || 1)) * 1.8
          ),
        efficiency: result.roof?.layout_efficiency || 95,
        orientation: result.roof?.optimal_orientation || "south",
        shading: Math.round(result.roof?.shading_impact || 5),
      });

      // Update battery recommendation
      setBatteryRecommendation(
        result.battery || {
          recommended_capacity: monthlyUsage * 0.3,
          autonomy_days: 1,
          estimated_cost: monthlyUsage * 200,
          efficiency_rating: 0.95,
          lifespan_years: 10,
        }
      );

      // Update quote breakdown from the costs data
      const quoteBreakdownData = {
        panels: result.costs?.panels || 0,
        inverter: result.costs?.inverter || 0,
        structure: result.costs?.mounting || 0, // Note the mapping from mounting to structure
        dcCable: result.costs?.dcCable || 0,
        acCable: result.costs?.acCable || 0,
        accessories: result.costs?.accessories || 26000, // Set default if not provided
        labor: result.costs?.installation || 0, // Note the mapping from installation to labor
        transport: result.costs?.transport || 0,
        netMetering: result.costs?.netMetering || 0,
        total: result.costs?.total || 0,
      };

      setQuoteBreakdown(quoteBreakdownData);

      return result.costs?.total || 0;
    } catch (err) {
      console.error("Error calculating quote:", err);
      return null;
    }
  };

  // Recalculate with forced system size (for manual adjustments)
  const recalculateWithSize = async (size: number) => {
    try {
      // Set loading state for affected UI components
      setRecalculating(true);

      // Call the edge function with forced size
      const sizingResult = await calculateSystemSizing({
        monthlyUsage,
        location: "Central Pakistan",
        roofDirection: "south",
        roofType: "standard",
        shading: "minimal",
        forceSize: size,
      });

      console.log(
        "Recalculated system sizing with forced size:",
        size,
        sizingResult
      );

      // Update equipment options from edge function response
      updateEquipmentOptions(sizingResult);

      // Update panel count and requirement calculations
      // This would reflect the new number of panels needed for the adjusted system size
      const newPanelCount = Math.ceil(
        (size * 1000) / (selectedPanel?.power || 1)
      );

      // Update roof requirements
      setRoofRequirements({
        area:
          sizingResult.roof?.required_area || Math.round(newPanelCount * 1.8),
        efficiency: sizingResult.roof?.layout_efficiency || 95,
        orientation: sizingResult.roof?.optimal_orientation || "south",
        shading: Math.round(sizingResult.roof?.shading_impact || 5),
      });

      // Update production data
      setWeatherData({
        sunHours:
          sizingResult.weather?.sunHours ||
          sizingResult.production?.peakSunHours ||
          5.2,
        efficiency: Math.round(
          sizingResult.efficiencyFactors?.systemEfficiency || 92
        ),
        temperatureImpact: sizingResult.efficiencyFactors?.temperature || 9,
        annualProduction:
          sizingResult.production?.annual || Math.round(size * 1460),
      });

      // Update cost breakdown
      setQuoteBreakdown({
        panels:
          sizingResult.costs?.panels ||
          newPanelCount * (selectedPanel?.price || 400),
        inverter:
          sizingResult.costs?.inverter ||
          Math.ceil(size / (selectedInverter?.power || 5)) *
            (selectedInverter?.price || 120000),
        structure: sizingResult.costs?.mounting || newPanelCount * 8000,
        dcCable:
          sizingResult.costs?.dcCable ||
          300 * Math.ceil(Math.sqrt(newPanelCount * 1.8) * 4),
        acCable:
          sizingResult.costs?.acCable ||
          400 * Math.ceil(Math.sqrt(newPanelCount * 1.8) * 4),
        accessories: sizingResult.costs?.accessories || 26000,
        labor: sizingResult.costs?.installation || 25000,
        transport: sizingResult.costs?.transport || 15000,
        netMetering: sizingResult.costs?.netMetering || 50000,
        total: sizingResult.costs?.total || 0,
      });

      // Update total quote
      if (sizingResult.costs?.total) {
        setQuoteTotal(sizingResult.costs.total);
      } else {
        // Fallback calculation if edge function doesn't return total
        const calculatedTotal = Object.values(quoteBreakdown).reduce(
          (sum, value) => sum + value,
          0
        );
        setQuoteTotal(calculatedTotal);
      }
    } catch (error) {
      console.error("Error recalculating with forced size:", error);
      // Fallback to basic calculations if the API call fails
      const newPanelCount = Math.ceil(
        (size * 1000) / (selectedPanel?.power || 1)
      );

      // Update with basic calculations
      setRoofRequirements((prev) => ({
        ...prev!,
        area: Math.round(newPanelCount * 1.8),
        efficiency: prev?.efficiency || 95,
        orientation: prev?.orientation || "south",
        shading: Math.round(prev?.shading || 5),
      }));

      setWeatherData((prev) => ({
        ...prev!,
        sunHours: prev?.sunHours || 5.2,
        efficiency: Math.round(prev?.efficiency || 92),
        temperatureImpact: prev?.temperatureImpact || 9,
        annualProduction: Math.round(size * 1460),
      }));

      // Basic cost calculation
      const totalCost = Object.values({
        panels: newPanelCount * (selectedPanel?.price || 400),
        inverter:
          Math.ceil(size / (selectedInverter?.power || 5)) *
          (selectedInverter?.price || 120000),
        structure: newPanelCount * 8000,
        dcCable: 300 * Math.ceil(Math.sqrt(newPanelCount * 1.8) * 4),
        acCable: 400 * Math.ceil(Math.sqrt(newPanelCount * 1.8) * 4),
        accessories: 26000,
        labor: 25000,
        transport: 15000,
        netMetering: 50000,
      }).reduce((sum, value) => sum + value, 0);

      setQuoteBreakdown({
        panels: newPanelCount * (selectedPanel?.price || 400),
        inverter:
          Math.ceil(size / (selectedInverter?.power || 5)) *
          (selectedInverter?.price || 120000),
        structure: newPanelCount * 8000,
        dcCable: 300 * Math.ceil(Math.sqrt(newPanelCount * 1.8) * 4),
        acCable: 400 * Math.ceil(Math.sqrt(newPanelCount * 1.8) * 4),
        accessories: 26000,
        labor: 25000,
        transport: 15000,
        netMetering: 50000,
        total: totalCost,
      });
      setQuoteTotal(totalCost);
    } finally {
      setRecalculating(false);
    }
  };

  // Reset to recommended system size
  const resetToRecommendedSize = async () => {
    setRecalculating(true);
    try {
      // Call the edge function without forceSize to get recommended size
      const result = await calculateSystemSizing({
        monthlyUsage,
        location: "Central Pakistan",
        roofDirection: "south",
        roofType: "standard",
        shading: "minimal",
      });

      // Update equipment options from edge function response
      updateEquipmentOptions(result);

      setUserAdjustedSize(false);
      setSystemSize(result.systemSize);

      // Update all the data based on the recommendation
      setWeatherData({
        sunHours:
          result.weather?.sunHours || result.production?.peakSunHours || 5.2,
        efficiency: Math.round(
          result.efficiencyFactors?.systemEfficiency || 92
        ),
        temperatureImpact: result.efficiencyFactors?.temperature || 9,
        annualProduction:
          result.production?.annual || Math.round(result.systemSize * 1460),
      });

      setRoofRequirements({
        area:
          result.roof?.required_area ||
          Math.round(
            Math.ceil(
              (result.systemSize * 1000) / (selectedPanel?.power || 1)
            ) * 1.8
          ),
        efficiency: result.roof?.layout_efficiency || 95,
        orientation: result.roof?.optimal_orientation || "south",
        shading: Math.round(result.roof?.shading_impact || 5),
      });

      setBatteryRecommendation(
        result.battery || {
          recommended_capacity: monthlyUsage * 0.3,
          autonomy_days: 1,
          estimated_cost: monthlyUsage * 200,
          efficiency_rating: 0.95,
          lifespan_years: 10,
        }
      );

      setQuoteBreakdown({
        panels: result.costs?.panels || 0,
        inverter: result.costs?.inverter || 0,
        structure: result.costs?.mounting || 0,
        dcCable: result.costs?.dcCable || 0,
        acCable: result.costs?.acCable || 0,
        accessories: result.costs?.accessories || 0,
        labor: result.costs?.installation || 0,
        transport: result.costs?.transport || 0,
        netMetering: result.costs?.netMetering || 0,
        total: result.costs?.total || 0,
      });

      setQuoteTotal(result.costs?.total || 0);
    } catch (err) {
      console.error("Error resetting to recommended size:", err);
    } finally {
      setRecalculating(false);
    }
  };

  // Adjust system size
  const adjustSystemSize = (increment: boolean) => {
    // Calculate new size
    const newSize = increment
      ? Math.min(systemSize + 0.5, 15) // Max 15kW
      : Math.max(systemSize - 0.5, 1); // Min 1kW

    // Update the state
    setSystemSize(newSize);

    // Flag that user manually changed the size
    setUserAdjustedSize(true);

    // Recalculate with the new size
    recalculateWithSize(newSize);
  };

  // send quote to whatsapp
  const saveQuote = async () => {
    console.log(
      "Saving quote with billId:",
      billId,
      "and quoteTotal:",
      quoteTotal,
      "and systemSize:",
      systemSize
    );
    if (!billId || !quoteTotal) {
      setError("Cannot send quote to whatsapp: Missing bill data or quote calculation");
      return;
    }

    setSavingQuote(true);

    try {
      const quoteData = {
        bill_id: billId,
        system_size: systemSize,
        total_cost: quoteTotal,
      };

      console.log("Quote data to be saved:", quoteData);
      const result = await createQuote(quoteData);
      console.log("Result from createQuote:", result);

      if (result) {
        setQuoteSaved(true);
        setTimeout(() => setQuoteSaved(false), 3000);
      } else {
        throw new Error("Failed to send quote to whatsapp");
      }
    } catch (err) {
      console.error("Error saving quote:", (err as Error).message);
      setError("Failed to save your quote. Please try again.");
    } finally {
      setSavingQuote(false);
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Get bill reference from localStorage
        const storedBillRef = localStorage.getItem("billReference");
        setBillReference(storedBillRef);

        // Load equipment and cost data in parallel
        const [
          panelsData,
          invertersData,
          structureTypesData,
          bracketCostsData,
          variableCostsData,
        ] = await Promise.all([
          fetchPanels(),
          fetchInverters(),
          fetchStructureTypes(),
          fetchBracketCosts(),
          fetchVariableCosts(),
        ]);

        // Set initial panel/inverter data (will be replaced by edge function response)
        setPanels(panelsData);
        setInverters(invertersData);
        setStructureTypes(structureTypesData);
        setBracketCosts(bracketCostsData);
        setVariableCosts(variableCostsData);

        // Set default panel
        const defaultPanel =
          panelsData.find((p) => p.default_choice) || panelsData[0];
        if (defaultPanel) {
          setSelectedPanelType(defaultPanel.id);
        }

        // Get bill data if available
        if (storedBillRef) {
          const billRecord = await fetchBillByReference(storedBillRef);

          if (billRecord) {
            setBillId(billRecord.id);

            // Set monthly usage based on bill data
            setMonthlyUsage(billRecord.units_consumed);

            // Calculate initial system sizing based on bill data
            const input: SystemSizingInput = {
              monthlyUsage: billRecord.units_consumed,
              location: "Central Pakistan",
              roofDirection: "south",
              roofType: "standard",
              shading: "minimal",
            };

            // Call edge function to get initial sizing
            try {
              const result = await calculateSystemSizing(input);
              setSizingResult(result);

              // Store the combinations
              if (result?.equipment?.combinations) {
                setEquipmentCombinations(result.equipment.combinations);
              }

              // Update equipment options from edge function response
              updateEquipmentOptions(result);

              // Update system size
              setSystemSize(result.systemSize);

              // Set default inverter based on recommended system size
              const appropriateInverter =
                invertersData.find((inv) => inv.power >= result.systemSize) ||
                invertersData[0];
              if (appropriateInverter) {
                setSelectedInverterType(appropriateInverter.id);
              }

              // Update UI data
              setWeatherData({
                sunHours:
                  result.weather?.sunHours ||
                  result.production?.peakSunHours ||
                  5.2,
                efficiency: Math.round(
                  result.efficiencyFactors?.systemEfficiency || 92
                ),
                temperatureImpact: result.efficiencyFactors?.temperature || 9,
                annualProduction:
                  result.production?.annual ||
                  Math.round(result.systemSize * 1460),
              });

              setRoofRequirements({
                area:
                  result.roof?.required_area ||
                  Math.round(
                    Math.ceil(
                      (result.systemSize * 1000) / (defaultPanel?.power || 1)
                    ) * 1.8
                  ),
                efficiency: result.roof?.layout_efficiency || 95,
                orientation: result.roof?.optimal_orientation || "south",
                shading: Math.round(result.roof?.shading_impact || 5),
              });

              setBatteryRecommendation(
                result.battery || {
                  recommended_capacity: billRecord.units_consumed * 0.3,
                  autonomy_days: 1,
                  estimated_cost: billRecord.units_consumed * 200,
                  efficiency_rating: 0.95,
                  lifespan_years: 10,
                }
              );

              // Set initial quote breakdown
              setQuoteBreakdown({
                panels: result.costs?.panels || 0,
                inverter: result.costs?.inverter || 0,
                structure: result.costs?.mounting || 0,
                dcCable: result.costs?.dcCable || 0,
                acCable: result.costs?.acCable || 0,
                accessories: result.costs?.accessories || 0,
                labor: result.costs?.installation || 0,
                transport: result.costs?.transport || 0,
                netMetering: result.costs?.netMetering || 0,
                total: result.costs?.total || 0,
              });

              setQuoteTotal(result.costs?.total || 0);
            } catch (sizeErr) {
              console.error("Error getting initial sizing:", sizeErr);
              // Fall back to estimating system size
              const calculatedSize =
                Math.ceil((billRecord.units_consumed / 120) * 10) / 10;
              setSystemSize(calculatedSize);

              // Set default inverter based on estimated system size
              const fallbackInverter =
                invertersData.find((inv) => inv.power >= calculatedSize) ||
                invertersData[0];
              if (fallbackInverter) {
                setSelectedInverterType(fallbackInverter.id);
              }
            }
          }
        } else {
          // If no bill data, set default inverter
          const initialInverter =
            invertersData.find((inv) => inv.power >= systemSize) ||
            invertersData[0];
          if (initialInverter) {
            setSelectedInverterType(initialInverter.id);
          }

          // Run initial calculation with default values
          const initialCalc = await calculateQuoteTotal();
          setQuoteTotal(initialCalc);
        }

        setLoading(false);
      } catch (err: any) {
        console.error("Error fetching data:", err);
        setError(err.message || "Failed to load data. Please try again.");
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Recalculate when panel or inverter type changes
  // Effect to update costs when panel/inverter selection changes
  useEffect(() => {
    if (selectedPanel && selectedInverter && sizingResult) {
      updateCostsBasedOnSelection();
    }
  }, [selectedPanel, selectedInverter]);
  useEffect(() => {
    const updateQuote = async () => {
      if (selectedPanelType && selectedInverterType && !recalculating) {
        // Only recalculate with API when system size changes, not equipment
        if (userAdjustedSize) {
          recalculateWithSize(systemSize);
        }
        // No need for additional API call for equipment changes
        // Just update costs based on the pre-calculated combinations
        updateCostsBasedOnSelection();
      }
    };

    updateQuote();
  }, [selectedPanelType, selectedInverterType]);

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

  // Render loading state
  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 text-gray-800 items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow-lg">
          <div className="animate-spin w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-center text-gray-600">
            Loading system configuration...
          </p>
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
            <svg
              className="w-12 h-12 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
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
              <div className="text-xs text-gray-500">
                Smart Solar Sizing System
              </div>
            </div>
          </div>
          <div className="flex gap-3 items-center">
            <div className="text-sm text-gray-500 hidden sm:block">
              {billReference ? `Ref: ${billReference}` : "New Quote"}
            </div>
            <Link
              href="/"
              className="h-8 w-8 bg-white rounded-full flex items-center justify-center text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 transition-colors shadow-md border border-gray-100"
            >
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
                Customized system sizing based on your energy profile and
                location data.
              </p>
              <div className="flex gap-3 md:gap-4">
                <button
                  className={`bg-white text-emerald-700 px-4 md:px-6 py-2 md:py-3 rounded-lg font-medium shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 ${
                    savingQuote ? "opacity-70 cursor-wait" : ""
                  } ${quoteSaved ? "bg-emerald-200" : ""}`}
                  onClick={saveQuote}
                  disabled={savingQuote || quoteSaved || recalculating}
                >
                  {quoteSaved
                    ? "Quote Saved!"
                    : savingQuote
                    ? "Saving..."
                    : "send quote to whatsapp"}
                </button>
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
                  {recalculating ? (
                    <div className="h-8 w-8 rounded-full border-2 border-white border-t-transparent animate-spin mx-auto mb-1"></div>
                  ) : (
                    <div className="text-3xl md:text-5xl font-bold text-white mb-1 md:mb-2">
                      {systemSize}
                    </div>
                  )}
                  <div className="text-sm md:text-base text-emerald-100">
                    kW System
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-emerald-800/40 to-transparent"></div>
        </div>

        {/* Tabs */}
        {/* Mobile-only tabs */}
        <div className="flex justify-center mb-8 md:mb-10 overflow-x-auto scrollbar-hide md:hidden">
          <div className="bg-white rounded-xl flex p-1.5 shadow-lg border border-gray-100">
            {["Sizing", "Performance", "Financial"].map((tab) => (
              <button
                key={tab}
                className={`px-4 sm:px-6 py-2 sm:py-2.5 text-sm rounded-lg transition-all whitespace-nowrap ${
                  activeTab === tab
                    ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-md"
                    : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>

        {/* Section Title */}
        <div className="mb-6 md:mb-8 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            Solar System Sizing
          </h2>
          <p className="text-gray-500 max-w-2xl mx-auto text-sm md:text-base">
            Our AI has analyzed your energy consumption patterns and local
            weather data to recommend the optimal solar system for your needs.
          </p>
        </div>

        {/* Quote Total Summary Card */}
        <div className={`bg-white rounded-2xl p-6 shadow-xl border border-gray-100 mb-6 md:mb-8 ${
          activeTab !== "Financial" ? "hidden md:block" : ""
        }`}>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">
                Your Solar Quote
              </h3>
              <p className="text-gray-600">
                {systemSize}kW system with{" "}
                {Math.ceil((systemSize * 1000) / (selectedPanel?.power || 1))}{" "}
                {selectedPanel?.brand} panels
              </p>
              {userAdjustedSize && (
                <div className="mt-2 flex items-center text-xs text-blue-600">
                  <span className="bg-blue-100 px-2 py-0.5 rounded-full flex items-center">
                    <span className="mr-1">Manually adjusted</span>
                    <button
                      onClick={resetToRecommendedSize}
                      className="ml-1 text-blue-700 hover:text-blue-900 flex items-center"
                      disabled={recalculating}
                    >
                      <RefreshCcw className="w-3 h-3 mr-0.5" /> Reset
                    </button>
                  </span>
                </div>
              )}
            </div>
            <div className="text-center md:text-right">
              <div className="text-3xl md:text-4xl font-bold text-emerald-600">
                {recalculating ? (
                  <span className="flex items-center justify-end gap-2">
                    <span className="h-6 w-6 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin"></span>
                    <span className="text-emerald-500 text-2xl">
                      Recalculating...
                    </span>
                  </span>
                ) : quoteTotal ? (
                  formatCurrency(quoteTotal)
                ) : (
                  "Calculating..."
                )}
              </div>
              <div className="text-sm text-gray-500">
                Estimated savings of{" "}
                {formatCurrency(quoteTotal ? quoteTotal * 1.5 : 0)} over 25
                years
              </div>
            </div>
          </div>
        </div>

        {/* Dashboard Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 auto-rows-auto">
          {/* Energy Usage - 4 columns */}
          <div className={`md:col-span-6 bg-white rounded-2xl p-4 md:p-6 shadow-lg border border-gray-100 overflow-hidden relative group hover:shadow-xl transition-all h-full ${
            activeTab !== "Performance" ? "hidden md:block" : ""
          }`}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-100 to-transparent rounded-bl-full -mr-10 -mt-10 opacity-70"></div>
            <div className="relative">
              <div className="flex justify-between items-center mb-4 md:mb-6">
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-100 p-2 rounded-lg">
                    <Zap className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="font-semibold text-gray-800">
                    Monthly Energy Usage
                  </div>
                </div>
                <div className="text-gray-400 group-hover:text-emerald-500 transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </div>
              </div>
              <div className="text-4xl md:text-5xl font-bold mb-4 text-gray-900 flex items-end gap-2">
                {monthlyUsage}{" "}
                <span className="text-lg md:text-xl text-gray-500 font-normal">
                  kWh
                </span>
              </div>
              <div className="space-y-3 mb-6">
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <div className="w-3 h-3 rounded-full bg-emerald-500 mr-2"></div>
                    <span className="text-sm">Peak Hours</span>
                  </div>
                  <span className="text-sm font-medium">
                    {Math.round(
                      (monthlyUsage *
                        (sizingResult?.consumption?.peak?.percentage || 42)) /
                        100
                    )}{" "}
                    kWh
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center">
                    <div className="w-3 h-3 rounded-full bg-gray-800 mr-2"></div>
                    <span className="text-sm">Off-Peak</span>
                  </div>
                  <span className="text-sm font-medium">
                    {Math.round(
                      monthlyUsage *
                        (1 -
                          (sizingResult?.consumption?.peak?.percentage || 42) /
                            100)
                    )}{" "}
                    kWh
                  </span>
                </div>
              </div>
              <div className="bg-emerald-50 p-3 rounded-lg">
                <div className="text-sm text-emerald-700">
                  <span className="font-medium">Solar Production:</span>{" "}
                  {sizingResult?.production?.monthly ||
                    Math.round(systemSize * 120)}{" "}
                  kWh/month
                </div>
              </div>
            </div>
          </div>

          {/* Recommended System Size - 4 columns */}
          <div className={`md:col-span-6 bg-white rounded-2xl p-4 md:p-6 shadow-lg border border-gray-100 overflow-hidden relative group hover:shadow-xl transition-all h-full ${
            activeTab !== "Sizing" ? "hidden md:block" : ""
          }`}>
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

              <div className="flex items-center justify-between mb-4">
                <button
                  onClick={() => adjustSystemSize(false)}
                  className={`bg-gray-100 p-2 rounded-full ${
                    systemSize <= 1 || recalculating
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-gray-200"
                  } transition-colors`}
                  disabled={systemSize <= 1 || recalculating}
                >
                  <Minus className="w-5 h-5 text-gray-700" />
                </button>

                <div className="text-4xl md:text-5xl font-bold text-gray-900 flex items-center">
                  {recalculating && (
                    <span className="h-5 w-5 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin inline-block mr-2"></span>
                  )}
                  {systemSize}{" "}
                  <span className="text-lg md:text-xl text-gray-500 font-normal">
                    kW
                  </span>
                </div>

                <button
                  onClick={() => adjustSystemSize(true)}
                  className={`bg-gray-100 p-2 rounded-full ${
                    systemSize >= 15 || recalculating
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-gray-200"
                  } transition-colors`}
                  disabled={systemSize >= 15 || recalculating}
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
                    <div
                      className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full"
                      style={{
                        width: `${((systemSize - 1) / 14) * 100}%`,
                      }}
                    ></div>
                    <div
                      className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-emerald-500 rounded-full shadow-md"
                      style={{
                        left: `${((systemSize - 1) / 14) * 100}%`,
                      }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>1.0 kW</span>
                    <span>15.0 kW</span>
                  </div>
                </div>

                <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div className="text-sm">Number of Panels</div>
                  <div className="text-sm font-medium bg-emerald-100 px-3 py-1 rounded-full text-emerald-700">
                    {Math.ceil(
                      (systemSize * 1000) / (selectedPanel?.power || 1)
                    )}{" "}
                    panels
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
                <div className="text-sm text-gray-500 mb-3">
                  Select your preferred solar panel type:
                </div>
                <div className="overflow-x-auto pb-2 -mx-2 px-2 scrollbar-hide">
                  <div className="flex gap-3 min-w-max pb-1">
                    {panels.map((panel) => (
                      <div
                        key={panel.id}
                        className={`flex-shrink-0 w-40 sm:w-48 p-3 md:p-4 rounded-xl border-2 transition-all cursor-pointer ${
                          selectedPanelType === panel.id
                            ? "border-emerald-500 bg-emerald-50"
                            : "border-gray-100 bg-white hover:border-emerald-200"
                        }`}
                        onClick={() => setSelectedPanelType(panel.id)}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div
                            className={`text-sm font-medium ${
                              selectedPanelType === panel.id
                                ? "text-emerald-700"
                                : "text-gray-800"
                            }`}
                          >
                            {panel.brand}
                          </div>
                          <div
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                              selectedPanelType === panel.id
                                ? "border-emerald-500 bg-emerald-500"
                                : "border-gray-300"
                            }`}
                          >
                            {selectedPanelType === panel.id && (
                              <div className="w-2 h-2 rounded-full bg-white"></div>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <div className="text-xs text-gray-500">Power</div>
                            <div className="text-xs font-medium">
                              {panel.power}W
                            </div>
                          </div>
                          <div className="flex justify-between">
                            <div className="text-xs text-gray-500">Price</div>
                            <div className="text-xs font-medium">
                              {formatCurrency(panel.price)}
                            </div>
                          </div>
                          <div className="flex justify-between">
                            <div className="text-xs text-gray-500">Panels</div>
                            <div className="text-xs font-medium">
                              {Math.ceil((systemSize * 1000) / panel.power)}
                            </div>
                          </div>
                          {panel.default_choice && (
                            <div className="text-xs text-emerald-600 mt-1">
                              Recommended
                            </div>
                          )}
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
                    <div className="text-sm font-medium text-emerald-800 mb-1">
                      {selectedPanel?.brand} Panels
                    </div>
                    <div className="text-sm text-emerald-700">
                      {selectedPanel?.power}W panels will require{" "}
                      {Math.ceil(
                        (systemSize * 1000) / (selectedPanel?.power || 1)
                      )}{" "}
                      panels for your {systemSize}kW system.
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
                  <div className="font-semibold text-gray-800">
                    Inverter Type
                  </div>
                </div>
                <div className="text-gray-400 group-hover:text-emerald-500 transition-colors">
                  <ChevronRight className="w-5 h-5" />
                </div>
              </div>

              <div className="mb-4">
                <div className="text-sm text-gray-500 mb-3">
                  Select your preferred inverter technology:
                </div>
                <div className="overflow-x-auto pb-2 -mx-2 px-2 scrollbar-hide">
                  <div className="flex gap-3 min-w-max pb-1">
                    {inverters.map((inverter) => (
                      <div
                        key={inverter.id}
                        className={`flex-shrink-0 w-40 sm:w-48 p-3 md:p-4 rounded-xl border-2 transition-all cursor-pointer ${
                          selectedInverterType === inverter.id
                            ? "border-emerald-500 bg-emerald-50"
                            : "border-gray-100 bg-white hover:border-emerald-200"
                        }`}
                        onClick={() => setSelectedInverterType(inverter.id)}
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div
                            className={`text-sm font-medium ${
                              selectedInverterType === inverter.id
                                ? "text-emerald-700"
                                : "text-gray-800"
                            }`}
                          >
                            {inverter.brand}
                          </div>
                          <div
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                              selectedInverterType === inverter.id
                                ? "border-emerald-500 bg-emerald-500"
                                : "border-gray-300"
                            }`}
                          >
                            {selectedInverterType === inverter.id && (
                              <div className="w-2 h-2 rounded-full bg-white"></div>
                            )}
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <div className="text-xs text-gray-500">Power</div>
                            <div className="text-xs font-medium">
                              {inverter.power}kW
                            </div>
                          </div>
                          <div className="flex justify-between">
                            <div className="text-xs text-gray-500">Price</div>
                            <div className="text-xs font-medium">
                              {formatCurrency(inverter.price)}
                            </div>
                          </div>
                          <div className="flex justify-between">
                            <div className="text-xs text-gray-500">Units</div>
                            <div className="text-xs font-medium">
                              {Math.ceil(systemSize / inverter.power)}
                            </div>
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
                    <div className="text-sm font-medium text-emerald-800 mb-1">
                      {selectedInverter?.brand} Inverter
                    </div>
                    <div className="text-sm text-emerald-700">
                      {selectedInverter?.power}kW inverter
                      {Math.ceil(systemSize / selectedInverter?.power) > 1
                        ? "s"
                        : ""}{" "}
                      - you'll need{" "}
                      {Math.ceil(systemSize / selectedInverter?.power)} unit
                      {Math.ceil(systemSize / selectedInverter?.power) > 1
                        ? "s"
                        : ""}{" "}
                      for your {systemSize}kW system.
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
                    aria-label="Take screenshot"
                  >
                    <Camera className="w-4 h-4 text-white" />
                  </button>
                  <button
                    className="bg-white/20 p-2 rounded-lg backdrop-blur-sm"
                    aria-label="View location"
                  >
                    <MapPin className="w-4 h-4 text-white" />
                  </button>
                </div>
              </div>
            </div>

            <div className="relative h-[250px] md:h-[300px]">
              <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300">
                <div className="absolute inset-0 grid grid-cols-7 grid-rows-3 gap-1 p-8 transform perspective-800 rotateX-10">
                  {Array(
                    Math.min(
                      21,
                      Math.ceil(
                        (systemSize * 1000) / (selectedPanel?.power || 1)
                      )
                    )
                  )
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
                <div className="text-sm font-medium text-gray-800">
                  {roofRequirements?.orientation || "South"} Facing
                </div>
                <div className="text-xs text-gray-600">
                  {roofRequirements?.efficiency || 95}% Efficiency •{" "}
                  {roofRequirements?.shading || 5}% Shading
                </div>
              </div>
            </div>

            <div className="p-4 md:p-6">
              <div className="grid grid-cols-2 gap-4 mb-4 md:mb-6">
                <div className="bg-gray-50 p-3 md:p-4 rounded-xl">
                  <div className="text-sm text-gray-500 mb-1">
                    Required Area
                  </div>
                  <div className="text-lg md:text-xl font-medium text-gray-900">
                    {roofRequirements?.area ||
                      Math.round(
                        Math.ceil(
                          (systemSize * 1000) / (selectedPanel?.power || 1)
                        ) * 1.8
                      )}{" "}
                    m²
                  </div>
                </div>
                <div className="bg-gray-50 p-3 md:p-4 rounded-xl">
                  <div className="text-sm text-gray-500 mb-1">
                    Efficiency Rating
                  </div>
                  <div className="text-lg md:text-xl font-medium text-gray-900">
                    {roofRequirements?.efficiency || 95}%
                  </div>
                </div>
              </div>

              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                <div className="flex items-start gap-3">
                  <div className="bg-emerald-100 p-2 rounded-lg mt-1">
                    <Info className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-emerald-800 mb-1">
                      Optimal Configuration
                    </div>
                    <div className="text-sm text-emerald-700">
                      {roofRequirements?.orientation || "South"} facing roof
                      with {roofRequirements?.efficiency || 95}% layout
                      efficiency and {roofRequirements?.shading || 5}% shading
                      impact provides optimal conditions for your {systemSize}kW
                      solar system.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quote Breakdown - 6 columns */}
          <div className={`md:col-span-6 bg-white rounded-2xl p-4 md:p-6 shadow-lg border border-gray-100 overflow-hidden relative group hover:shadow-xl transition-all h-full ${
            activeTab !== "Financial" ? "hidden md:block" : ""
          }`}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-100 to-transparent rounded-bl-full -mr-10 -mt-10 opacity-70"></div>
            <div className="relative">
              <div className="flex justify-between items-center mb-4 md:mb-6">
                <div className="flex items-center gap-3">
                  <div className="bg-emerald-100 p-2 rounded-lg">
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div className="font-semibold text-gray-800">
                    Quote Breakdown
                  </div>
                </div>
              </div>

              <div className="space-y-3 mb-4">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">
                    Solar Panels (
                    {Math.ceil(
                      (systemSize * 1000) / (selectedPanel?.power || 1)
                    )}{" "}
                    x {selectedPanel?.brand})
                  </span>
                  <span className="text-sm font-medium">
                    {formatCurrency(quoteBreakdown.panels || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">
                    Inverter (
                    {Math.ceil(systemSize / (selectedInverter?.power || 1))} x{" "}
                    {selectedInverter?.brand})
                  </span>
                  <span className="text-sm font-medium">
                    {formatCurrency(quoteBreakdown.inverter || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">
                    Mounting Structure
                  </span>
                  <span className="text-sm font-medium">
                    {formatCurrency(quoteBreakdown.structure || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">DC & AC Cables</span>
                  <span className="text-sm font-medium">
                    {formatCurrency(
                      (quoteBreakdown.dcCable || 0) +
                        (quoteBreakdown.acCable || 0)
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">
                    Installation & Labor
                  </span>
                  <span className="text-sm font-medium">
                    {formatCurrency(quoteBreakdown.labor || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Net Metering</span>
                  <span className="text-sm font-medium">
                    {formatCurrency(quoteBreakdown.netMetering || 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Transport</span>
                  <span className="text-sm font-medium">
                    {formatCurrency(quoteBreakdown.transport || 0)}
                  </span>
                </div>
                <div className="border-t pt-2 flex justify-between font-semibold">
                  <span>Total</span>
                  <span className="text-emerald-600">
                    {formatCurrency(quoteBreakdown.total || 0)}
                  </span>
                </div>
              </div>

              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                <div className="flex items-start gap-3">
                  <div className="bg-emerald-100 p-2 rounded-lg mt-1">
                    <Info className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-emerald-800 mb-1">
                      Savings & ROI
                    </div>
                    <div className="text-sm text-emerald-700">
                      Your system will provide{" "}
                      {weatherData?.annualProduction ||
                        Math.round(systemSize * 1460)}{" "}
                      kWh annual production with peak generation of{" "}
                      {sizingResult?.production?.byMonth?.reduce(
                        (max: number, val: number) => Math.max(max, val),
                        0
                      ) || Math.round(systemSize * 150)}{" "}
                      kWh in summer months.
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
                  <div className="font-semibold text-gray-800">
                    System Summary
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-4 md:mb-6">
                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100">
                  <div className="flex items-start gap-3">
                    <div className="bg-emerald-100 p-2 rounded-lg mt-1">
                      <Sun className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-emerald-800 mb-1">
                        Solar System
                      </div>
                      <div className="text-sm text-emerald-700">
                        {systemSize} kW system with{" "}
                        {Math.ceil(
                          (systemSize * 1000) / (selectedPanel?.power || 1)
                        )}{" "}
                        {selectedPanel?.brand} panels ({selectedPanel?.power}W
                        each)
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
                      <div className="text-sm font-medium text-emerald-800 mb-1">
                        Inverter Solution
                      </div>
                      <div className="text-sm text-emerald-700">
                        {selectedInverter?.brand} {selectedInverter?.power}kW
                        with{" "}
                        {Math.ceil(systemSize / (selectedInverter?.power || 1))}{" "}
                        unit
                        {Math.ceil(
                          systemSize / (selectedInverter?.power || 1)
                        ) > 1
                          ? "s"
                          : ""}
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
                      <div className="text-sm font-medium text-emerald-800 mb-1">
                        Battery Recommendation
                      </div>
                      <div className="text-sm text-emerald-700">
                        {batteryRecommendation?.recommended_capacity?.toFixed(
                          1
                        ) || "13.5"}{" "}
                        kWh battery for{" "}
                        {batteryRecommendation?.autonomy_days || 1} day
                        {batteryRecommendation?.autonomy_days !== 1
                          ? "s"
                          : ""}{" "}
                        of backup (
                        {batteryRecommendation?.efficiency_rating
                          ? `${batteryRecommendation.efficiency_rating * 100}%`
                          : "95%"}{" "}
                        efficient)
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:flex-row gap-4 md:gap-6">
                <button
                  className={`flex-1 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5 ${
                    savingQuote ? "opacity-70 cursor-wait" : ""
                  } ${quoteSaved ? "bg-emerald-200" : ""}`}
                  onClick={saveQuote}
                  disabled={savingQuote || quoteSaved || recalculating}
                >
                  <span className="font-medium">
                    {quoteSaved
                      ? "Quote Saved!"
                      : savingQuote
                      ? "Saving..."
                      : "send quote to whatsapp"}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
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
    </div>
  );
}
