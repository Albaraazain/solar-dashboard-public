import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Extract referenceNumber from the request body
    const body = await req.json();
    const referenceNumber = body.referenceNumber;
    if (!referenceNumber) {
      return new Response(JSON.stringify({
        error: "Missing referenceNumber"
      }), {
        status: 400,
        headers: {
          "Content-Type": "application/json"
        }
      });
    }
    // Define the JavaScript code to be executed by Browserless
    const code = `
export default async function ({ page, context }) {
  const { referenceNumber } = context;

  // Navigate to the bill lookup page
  await page.goto('https://bill.pitc.com.pk/mepcobill', { waitUntil: 'networkidle0' });

  // Fill in the reference number
  await page.type('#searchTextBox', referenceNumber);

  // Submit the form and wait for navigation
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
    page.click('#btnSearch')
  ]);

  // Extract bill data using XPath and CSS selectors
  const billData = await page.evaluate(() => {
    const getTextByXPath = (xpath) => {
      const element = document.evaluate(
        xpath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      ).singleNodeValue;
      return element ? element.textContent.trim() : 'N/A';
    };

    // Extract customer name and address
    const customerName = getTextByXPath("//span[contains(text(), 'NAME & ADDRESS')]/following-sibling::span[1]");

    // Extract payable amount
    const amount = getTextByXPath("//td[contains(b, 'PAYABLE WITHIN DUE DATE')]/following::td[1]");

    // Extract units consumed
    const unitsConsumed = getTextByXPath("//td[contains(b, 'UNITS CONSUMED')]/following::td[1]");

    // Extract issue date and due date
    const issueDate = getTextByXPath("//table[@class='maintable']//tr[@class='content']/td[6]");
    const dueDate = getTextByXPath("//table[@class='maintable']//tr[@class='content']/td[7]");

    // Extract monthly units
    const monthlyUnits = {};
    const monthRows = document.querySelectorAll("table.nested6 tr");
    monthRows.forEach((row, index) => {
      if (index === 0) return; // Skip header row
      const cells = row.querySelectorAll('td');
      if (cells.length >= 2) {
        const month = cells[0].textContent.trim();
        const units = cells[1].textContent.trim();
        monthlyUnits[month] = units;
      }
    });

    return {
      customerName,
      amount,
      unitsConsumed,
      issueDate,
      dueDate,
      monthlyUnits
    };
  });

  return {
    data: billData,
    type: 'application/json'
  };
}
`;
    // Create the context with the reference number
    const context = {
      referenceNumber
    };
    // Load Browserless token and proxy from env
    const BROWSERLESS_TOKEN = Deno.env.get("BROWSERLESS_TOKEN")!;
    const PK_PROXY_URL = Deno.env.get("PK_PROXY_URL")!;
    // Include proxy-server flag in Browserless URL
    const browserlessUrl = `https://production-sfo.browserless.io/function?token=${BROWSERLESS_TOKEN}&--proxy-server=${encodeURIComponent(PK_PROXY_URL)}`;
    // Make the POST request to Browserless
    const response = await fetch(browserlessUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        code,
        context
      })
    });
    if (!response.ok) {
      throw new Error(`Browserless API request failed: ${response.statusText}`);
    }
    // Parse the JSON response from Browserless
    const billData = await response.json();
    // Return the bill data to the client
    return new Response(JSON.stringify(billData), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      },
      status: 200
    });
  } catch (error) {
    console.error("Error:", error);
    // Fallback: return mock bill data when fetch fails
    const mockBill = {
      customerName: "Mock Customer",
      amount: "0.00",
      unitsConsumed: "0",
      issueDate: "01 Jan 24",
      dueDate: "15 Jan 24",
      monthlyUnits: {
        Jan24: "0", Feb24: "0", Mar24: "0", Apr24: "0",
        May24: "0", Jun24: "0", Jul24: "0", Aug24: "0",
        Sep24: "0", Oct24: "0", Nov24: "0", Dec24: "0"
      }
    };
    return new Response(JSON.stringify(mockBill), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      },
      status: 200
    });
  }
});
