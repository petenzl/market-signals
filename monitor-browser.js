#!/usr/bin/env node

/**
 * Browser Monitor Script
 * Uses Puppeteer to load the GitHub Pages site and capture console logs and network requests
 * Run with: node monitor-browser.js
 */

const puppeteer = require('puppeteer');

const SITE_URL = 'https://petenzl.github.io/market-signals';

async function monitorSite() {
  console.log('🚀 Starting browser monitor...');
  console.log(`📡 Loading: ${SITE_URL}\n`);

  const browser = await puppeteer.launch({
    headless: false, // Set to true to run in background
    devtools: true,  // Open DevTools automatically
  });

  const page = await browser.newPage();

  // Capture console logs
  const consoleLogs = [];
  page.on('console', msg => {
    const logEntry = {
      type: msg.type(),
      text: msg.text(),
      location: msg.location(),
      timestamp: new Date().toISOString(),
    };
    consoleLogs.push(logEntry);
    console.log(`[${logEntry.type.toUpperCase()}] ${logEntry.text}`);
  });

  // Capture network requests
  const networkRequests = [];
  page.on('request', request => {
    const reqEntry = {
      url: request.url(),
      method: request.method(),
      headers: request.headers(),
      timestamp: new Date().toISOString(),
    };
    networkRequests.push(reqEntry);
    console.log(`➡️  ${request.method()} ${request.url()}`);
  });

  // Capture network responses
  const networkResponses = [];
  page.on('response', response => {
    const resEntry = {
      url: response.url(),
      status: response.status(),
      statusText: response.statusText(),
      headers: response.headers(),
      timestamp: new Date().toISOString(),
    };
    networkResponses.push(resEntry);
    const statusEmoji = response.status() >= 400 ? '❌' : '✅';
    console.log(`${statusEmoji} ${response.status()} ${response.statusText()} - ${response.url()}`);
  });

  // Capture page errors
  const pageErrors = [];
  page.on('pageerror', error => {
    const errorEntry = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
    };
    pageErrors.push(errorEntry);
    console.error(`💥 Page Error: ${error.message}`);
  });

  // Capture request failures
  page.on('requestfailed', request => {
    const failureEntry = {
      url: request.url(),
      method: request.method(),
      failureText: request.failure()?.errorText,
      timestamp: new Date().toISOString(),
    };
    pageErrors.push(failureEntry);
    console.error(`💥 Request Failed: ${request.method()} ${request.url()} - ${request.failure()?.errorText}`);
  });

  try {
    // Navigate to the site
    await page.goto(SITE_URL, {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });

    // Wait a bit for any async operations and proxy attempts
    console.log('\n⏳ Waiting for page to fully load and proxy attempts to complete...');
    await new Promise(resolve => setTimeout(resolve, 10000)); // Increased to 10 seconds to catch all proxy attempts

    // Generate report
    const report = {
      url: SITE_URL,
      timestamp: new Date().toISOString(),
      consoleLogs,
      networkRequests,
      networkResponses,
      pageErrors,
      summary: {
        totalConsoleLogs: consoleLogs.length,
        totalRequests: networkRequests.length,
        totalResponses: networkResponses.length,
        failedRequests: networkResponses.filter(r => r.status >= 400).length,
        errors: pageErrors.length,
      },
    };

    // Save report to file
    const fs = require('fs');
    const reportPath = './browser-monitor-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Report saved to: ${reportPath}`);

    // Print summary
    console.log('\n📊 Summary:');
    console.log(`   Console Logs: ${report.summary.totalConsoleLogs}`);
    console.log(`   Network Requests: ${report.summary.totalRequests}`);
    console.log(`   Failed Requests: ${report.summary.failedRequests}`);
    console.log(`   Errors: ${report.summary.errors}`);

    // Keep browser open for manual inspection
    console.log('\n👀 Browser will stay open for 30 seconds for manual inspection...');
    console.log('   Press Ctrl+C to close early\n');
    await new Promise(resolve => setTimeout(resolve, 30000));

  } catch (error) {
    console.error('❌ Error monitoring site:', error);
  } finally {
    await browser.close();
  }
}

monitorSite().catch(console.error);
