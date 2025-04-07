import { serve } from "https://deno.land/std@0.192.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"
import * as PDFLib from "https://esm.sh/pdf-lib@1.17.1"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { quote_id } = await req.json()
    
    // Get quote data
    const { data: quote, error } = await supabase
      .from('quotes')
      .select('*, calculations')
      .eq('id', quote_id)
      .single()

    if (error) throw error

    // Generate PDF with invoice layout
    const pdfDoc = await PDFLib.PDFDocument.create()
    const page = pdfDoc.addPage([612, 792]) // Letter size 8.5" x 11"
    const { width, height } = page.getSize()
    
    // Add template background if exists
    // Create basic template if missing
    try {
      const templateBytes = await Deno.readFile('template.pdf')
      const templateDoc = await PDFLib.PDFDocument.load(templateBytes)
      const [templatePage] = await pdfDoc.embedPdf(templateDoc)
      page.drawPage(templatePage)
    } catch {
      // Generate simple template programmatically
      const templateDoc = await PDFLib.PDFDocument.create()
      const templatePage = templateDoc.addPage([612, 792])
      templatePage.drawText('Energy Cove Solar Solutions', {
        x: 50,
        y: 750,
        size: 18,
        font: await templateDoc.embedFont(PDFLib.StandardFonts.HelveticaBold)
      })
      const [embeddedPage] = await pdfDoc.embedPdf(await templateDoc.save())
      page.drawPage(embeddedPage)
    }
    const helvetica = await pdfDoc.embedFont(PDFLib.StandardFonts.HelveticaBold)
    
    // Draw customer information
    page.drawText(`Customer: ${quote.customer_name}`, {
      x: 50,
      y: height - 100,
      size: 12,
      font: helvetica,
    })
    
    page.drawText(`System Size: ${quote.system_size} kW`, {
      x: 50,
      y: height - 120,
      size: 12,
      font: helvetica,
    })

    // Cost breakdown table
    const costs = quote.calculations.costs
    const startY = height - 200
    let currentY = startY
    
    const drawRow = (label: string, value: number) => {
      page.drawText(label, { x: 50, y: currentY, size: 12, font: helvetica })
      page.drawText(`$${value.toLocaleString()}`, { 
        x: width - 150, 
        y: currentY,
        size: 12,
        font: helvetica
      })
      currentY -= 20
    }

    drawRow('Panels', costs.panel_total)
    drawRow('Inverter', costs.inverter_price)
    drawRow('Installation', costs.installation)
    drawRow('Net Metering', costs.net_metering)
    drawRow('Cabling', costs.dc_cable + costs.ac_cable)
    drawRow('Total', quote.total_cost)

    // Add terms and conditions
    page.drawText('90% Advance Payment | 10% After Commissioning', {
      x: 50,
      y: 100,
      size: 14,
      font: helvetica,
      color: PDFLib.rgb(0, 0.5, 0)
    })

    const pdfBytes = await pdfDoc.save()
    
    // Store in storage
    const { data: file, error: storageError } = await supabase.storage
      .from('quotes-pdf')
      .upload(`quote-${quote_id}.pdf`, pdfBytes)

    if (storageError) throw storageError

    // Get public URL for the PDF
    const { data: urlData } = supabase.storage
      .from('quotes-pdf')
      .getPublicUrl(file.path)

    // Send email via Resend
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`
      },
      body: JSON.stringify({
        from: 'Energy Cove <quotes@energycove.com>',
        to: quote.customer_email,
        subject: `Your Solar Quote #${quote.reference_number}`,
        html: `<p>Dear ${quote.customer_name},<br><br>
              Attached is your ${quote.system_size}kW solar system quote.<br>
              <a href="${urlData.publicUrl}">View Quote PDF</a></p>`,
        attachments: [{
          filename: `quote-${quote.reference_number}.pdf`,
          content: btoa(String.fromCharCode(...pdfBytes))
        }]
      })
    })

    if (!resendResponse.ok) {
      throw new Error('Failed to send email: ' + await resendResponse.text())
    }

    return new Response(JSON.stringify({ 
      url: urlData.publicUrl,
      message: "Email sent successfully"
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
