import type { NextApiRequest, NextApiResponse } from 'next'
import puppeteer from 'puppeteer-core'

type BillData = {
  customerName: string
  amount: string
  unitsConsumed: string
  issueDate: string
  dueDate: string
  monthlyUnits: Record<string, string>
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<BillData | { error: string }>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { referenceNumber } = req.body
  if (!referenceNumber) {
    return res.status(400).json({ error: 'referenceNumber is required' })
  }

  const browserWSEndpoint = process.env.SCRAPING_BROWSER_ENDPOINT
  if (!browserWSEndpoint) {
    return res.status(500).json({ error: 'Missing SCRAPING_BROWSER_ENDPOINT env var' })
  }

  let browser
  try {
    browser = await puppeteer.connect({ browserWSEndpoint })
    const page = await browser.newPage()
    await page.goto('https://bill.pitc.com.pk/mepcobill', { waitUntil: 'networkidle0' })
    await page.type('#searchTextBox', referenceNumber)
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click('#btnSearch'),
    ])

    const billData = await page.evaluate(() => {
      const getTextByXPath = (xpath: string) => {
        const el = document.evaluate(
          xpath,
          document,
          null,
          XPathResult.FIRST_ORDERED_NODE_TYPE,
          null
        ).singleNodeValue as HTMLElement | null
        return el ? el.textContent?.trim() || 'N/A' : 'N/A'
      }
      const customerName = getTextByXPath("//span[contains(text(), 'NAME & ADDRESS')]/following-sibling::span[1]")
      const amount = getTextByXPath("//td[contains(b, 'PAYABLE WITHIN DUE DATE')]/following::td[1]")
      const unitsConsumed = getTextByXPath("//td[contains(b, 'UNITS CONSUMED')]/following::td[1]")
      const issueDate = getTextByXPath("//table[@class='maintable']//tr[@class='content']/td[6]")
      const dueDate = getTextByXPath("//table[@class='maintable']//tr[@class='content']/td[7]")
      const monthlyUnits: Record<string, string> = {}
      document.querySelectorAll('table.nested6 tr').forEach((row, i) => {
        if (i === 0) return
        const cells = row.querySelectorAll('td')
        if (cells.length >= 2) {
          monthlyUnits[cells[0].textContent?.trim() || ''] = cells[1].textContent?.trim() || ''
        }
      })
      return { customerName, amount, unitsConsumed, issueDate, dueDate, monthlyUnits }
    })

    await browser.close()
    return res.status(200).json(billData)
  } catch (error: any) {
    if (browser) await browser.close()
    console.error('Error fetching bill:', error)
    return res.status(500).json({ error: error.message || 'Failed to fetch bill' })
  }
}
