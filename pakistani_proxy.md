const proxyUrl = 'http://brd.superproxy.io:33335';
const proxyUsername = 'brd-customer-hl_e79890bb-zone-<zone_name>';
const proxyPassword = '<your_proxy_password>';

const response = await fetch(browserlessUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Proxy-Authorization": `Basic ${btoa(`${proxyUsername}:${proxyPassword}`)}`
  },
  body: JSON.stringify({
    code,
    context
  }),
  agent: new HttpsProxyAgent(proxyUrl)
});



Congratulations, your Scraping Browser endpoint is ready!
If you haven't yet used our Scraping Browser before, here are the key details to help you get started:
 1. Remove proxy IP configurations from your code, they are no longer needed.
 2. Configure your code to connect to the Scraping Browser endpoint (instead of using a local browser), using the following URL with embedded credentials (auth+@host):
Puppeteer / Playwright

wss://brd-customer-hl_e79890bb-zone-scraping_browser1:a2ttdoqjm85c@brd.superproxy.io:9222
Selenium

https://brd-customer-hl_e79890bb-zone-scraping_browser1:a2ttdoqjm85c@brd.superproxy.io:9515
For additional information 
see the documentation
Don't show this again

Continue with Scraping Browser Playground