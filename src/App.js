import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

const App = () => {
  const [data, setData] = useState([]);
  const [timeFrame, setTimeFrame] = useState('1Y');
  const [signal, setSignal] = useState({ message: 'Loading...', color: 'text-gray-500' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [historicalSignals, setHistoricalSignals] = useState([]);
  const [averageReturn, setAverageReturn] = useState(null);
  const [average6MonthReturn, setAverage6MonthReturn] = useState(null);
  const [benchmarkAverageReturn, setBenchmarkAverageReturn] = useState(null);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');


  // --- Data fetching function for Yahoo Finance ---
  const fetchData = useCallback(async () => {
    if (timeFrame === 'Custom' && (!customStartDate || !customEndDate)) {
        setError("Please select both a start and end date for the custom range.");
        return;
    }

    console.log('🚀 Starting data fetch...', { timeFrame, customStartDate, customEndDate });
    setIsLoading(true);
    setError(null);
    setHistoricalSignals([]);
    setAverageReturn(null);
    setAverage6MonthReturn(null);
    setBenchmarkAverageReturn(null);
    setSignal({ message: 'Loading Data...', color: 'text-gray-500' });

    // --- Determine display start and end dates ---
    let displayStartDate, displayEndDate;
    const today = new Date();

    if (timeFrame === 'Custom') {
        displayStartDate = new Date(customStartDate);
        displayEndDate = new Date(customEndDate);
    } else {
        displayEndDate = new Date(); // today
        displayStartDate = new Date();
        let yearsToSubtract = 1;
        switch(timeFrame) {
            case '2Y': yearsToSubtract = 2; break;
            case '5Y': yearsToSubtract = 5; break;
            case '10Y': yearsToSubtract = 10; break;
            case '20Y': yearsToSubtract = 20; break;
            case '50Y': yearsToSubtract = 50; break;
            default: yearsToSubtract = 1;
        }
        displayStartDate.setFullYear(displayStartDate.getFullYear() - yearsToSubtract);
    }
    
    // --- Determine fetch start and end dates ---
    const fetchStartDate = displayStartDate;
    const fetchEndDate = new Date(displayEndDate);
    fetchEndDate.setFullYear(fetchEndDate.getFullYear() + 1);

    const startDateStamp = Math.floor(fetchStartDate.getTime() / 1000);
    const endDateStamp = Math.min(Math.floor(fetchEndDate.getTime() / 1000), Math.floor(today.getTime() / 1000));


    // --- Yahoo Finance API URLs with CORS Proxy (with fallback) ---
    const originalSpxUrl = `https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?period1=${startDateStamp}&period2=${endDateStamp}&interval=1d&events=history`;
    const originalVixUrl = `https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?period1=${startDateStamp}&period2=${endDateStamp}&interval=1d&events=history`;

    // Try multiple CORS proxies as fallback
    const proxyUrls = [
      'https://api.codetabs.com/v1/proxy/?quest=', // Use trailing slash - this one works!
      'https://corsproxy.io/?',
      'https://proxy.cors.sh/?'
    ];

    // Helper function to try fetching with fallback proxies
    const fetchWithFallback = async (url, proxyIndex = 0) => {
      if (proxyIndex >= proxyUrls.length) {
        const errorMsg = 'All CORS proxy attempts failed';
        console.error('❌', errorMsg);
        throw new Error(errorMsg);
      }

      let proxyUrl = proxyUrls[proxyIndex];
      let fullUrl;
      
      // Handle different proxy URL formats
      if (proxyUrl.includes('allorigins.win')) {
        fullUrl = proxyUrl + encodeURIComponent(url);
      } else if (proxyUrl.includes('corsproxy.io')) {
        fullUrl = proxyUrl + encodeURIComponent(url);
      } else if (proxyUrl.includes('codetabs.com')) {
        // codetabs.com requires trailing slash in path - use /?quest= format
        fullUrl = proxyUrl + encodeURIComponent(url);
      } else if (proxyUrl.includes('cors.sh')) {
        fullUrl = proxyUrl + encodeURIComponent(url);
      } else {
        fullUrl = proxyUrl + url;
      }

      console.log(`🔄 Attempting proxy ${proxyIndex + 1}/${proxyUrls.length}: ${proxyUrl.split('/')[2]}`);
      console.log(`📡 Full URL:`, fullUrl.substring(0, 100) + '...');

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        const startTime = Date.now();
        const response = await fetch(fullUrl, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          },
          signal: controller.signal
        });
        const duration = Date.now() - startTime;
        
        clearTimeout(timeoutId);
        
        console.log(`✅ Proxy ${proxyIndex + 1} response: ${response.status} ${response.statusText} (${duration}ms)`);
        
        if (!response.ok) {
          throw new Error(`Proxy ${proxyIndex} returned ${response.status} ${response.statusText}`);
        }
        return response;
      } catch (error) {
        const errorDetails = {
          proxy: proxyUrl.split('/')[2],
          error: error.name,
          message: error.message,
          type: error.name === 'AbortError' ? 'Timeout' : error.message.includes('CORS') ? 'CORS' : 'Network'
        };
        
        console.warn(`⚠️  Proxy ${proxyIndex + 1} failed:`, errorDetails);
        
        // Try next proxy
        if (proxyIndex + 1 < proxyUrls.length) {
          console.log(`⏭️  Trying next proxy...`);
          return fetchWithFallback(url, proxyIndex + 1);
        } else {
          // All proxies failed
          const finalError = `All CORS proxy attempts failed. Errors: ${JSON.stringify(errorDetails, null, 2)}`;
          console.error('❌', finalError);
          throw new Error(finalError);
        }
      }
    };

    try {
      console.log('📊 Fetching data for:', {
        SPX: originalSpxUrl.substring(0, 80) + '...',
        VIX: originalVixUrl.substring(0, 80) + '...'
      });
      
      const [spxResponse, vixResponse] = await Promise.all([
        fetchWithFallback(originalSpxUrl).catch(err => {
          console.error('❌ SPX fetch failed:', err);
          throw err;
        }),
        fetchWithFallback(originalVixUrl).catch(err => {
          console.error('❌ VIX fetch failed:', err);
          throw err;
        })
      ]);
      
      console.log('✅ Both requests completed successfully');

      // Handle text/plain responses from codetabs.com proxy (it returns JSON as text/plain)
      const spxText = await spxResponse.text();
      const vixText = await vixResponse.text();
      
      // Check if responses are valid JSON (start with { or [)
      const isJson = (text) => {
        const trimmed = text.trim();
        return trimmed.startsWith('{') || trimmed.startsWith('[');
      };
      
      // Log first 200 chars of response for debugging if not JSON
      if (!isJson(spxText)) {
        console.warn('⚠️  SPX response is not JSON. First 200 chars:', spxText.substring(0, 200));
      }
      if (!isJson(vixText)) {
        console.warn('⚠️  VIX response is not JSON. First 200 chars:', vixText.substring(0, 200));
      }
      
      let spxJson, vixJson;
      try {
        if (!isJson(spxText) || !isJson(vixText)) {
          throw new Error(`Proxy returned non-JSON response. SPX starts with: "${spxText.substring(0, 50)}...", VIX starts with: "${vixText.substring(0, 50)}..."`);
        }
        spxJson = JSON.parse(spxText);
        vixJson = JSON.parse(vixText);
      } catch (parseError) {
        // If parsing fails, throw the error with more context
        console.error('❌ Failed to parse JSON response:', parseError.message);
        throw new Error(`Failed to parse JSON response: ${parseError.message}`);
      }

      // --- Parse Yahoo Finance data structure ---
      const parseYahooData = (jsonData) => {
        if (!jsonData.chart.result) return [];
        const result = jsonData.chart.result[0];
        if (!result) return [];
        const timestamps = result.timestamp;
        const prices = result.indicators.quote[0].close;
        return timestamps.map((ts, i) => ({
          date: new Date(ts * 1000).toISOString().split('T')[0],
          price: prices[i] ? parseFloat(prices[i].toFixed(2)) : null
        })).filter(d => d.price !== null);
      };

      const spxData = parseYahooData(spxJson);
      const vixData = parseYahooData(vixJson);

      // --- Combine S&P 500 and VIX data ---
      const combinedData = spxData.map((spxPoint) => {
        const vixPoint = vixData.find(vix => vix.date === spxPoint.date);
        return {
          date: spxPoint.date,
          spx: spxPoint.price,
          vix: vixPoint ? vixPoint.price : null,
        };
      }).filter(point => point.vix !== null);

      // Filter data to the selected timeframe for display on the chart
      const finalDisplayData = combinedData.filter(d => {
        const dDate = new Date(d.date);
        return dDate >= displayStartDate && dDate <= displayEndDate;
      });
      setData(finalDisplayData);

      // --- Signal Logic & Historical Analysis ---
      const signals = [];
      for (let i = 1; i < combinedData.length; i++) {
        const currentPoint = combinedData[i];
        const previousPoint = combinedData[i-1];

        if (previousPoint.vix > 30 && currentPoint.vix < previousPoint.vix) {
          const sixMonthForwardDate = new Date(new Date(currentPoint.date).setMonth(new Date(currentPoint.date).getMonth() + 6));
          const twelveMonthForwardDate = new Date(new Date(currentPoint.date).setFullYear(new Date(currentPoint.date).getFullYear() + 1));
          
          const sixMonthForwardPoint = combinedData.find(p => new Date(p.date) >= sixMonthForwardDate);
          const twelveMonthForwardPoint = combinedData.find(p => new Date(p.date) >= twelveMonthForwardDate);
          
          let sixMonthReturn = null;
          let twelveMonthReturn = null;

          if (sixMonthForwardPoint) {
            sixMonthReturn = ((sixMonthForwardPoint.spx - currentPoint.spx) / currentPoint.spx) * 100;
          }
          if (twelveMonthForwardPoint) {
            twelveMonthReturn = ((twelveMonthForwardPoint.spx - currentPoint.spx) / currentPoint.spx) * 100;
          }

          signals.push({
            date: currentPoint.date,
            spxOnSignal: currentPoint.spx,
            vixOnSignal: currentPoint.vix,
            sixMonthForwardReturn: sixMonthReturn !== null ? sixMonthReturn.toFixed(2) : null,
            forwardReturn: twelveMonthReturn !== null ? twelveMonthReturn.toFixed(2) : null,
          });
        }
      }
      
      const filteredSignals = signals.filter(s => {
        const sDate = new Date(s.date);
        return sDate >= displayStartDate && sDate <= displayEndDate;
      });
      setHistoricalSignals(filteredSignals);

      if (filteredSignals.length > 0) {
        const signalsWith6MReturns = filteredSignals.filter(s => s.sixMonthForwardReturn !== null);
        if (signalsWith6MReturns.length > 0) {
            const total6MReturn = signalsWith6MReturns.reduce((acc, signal) => acc + parseFloat(signal.sixMonthForwardReturn), 0);
            setAverage6MonthReturn((total6MReturn / signalsWith6MReturns.length).toFixed(2));
        }

        const signalsWith12MReturns = filteredSignals.filter(s => s.forwardReturn !== null);
        if (signalsWith12MReturns.length > 0) {
            const total12MReturn = signalsWith12MReturns.reduce((acc, signal) => acc + parseFloat(signal.forwardReturn), 0);
            setAverageReturn((total12MReturn / signalsWith12MReturns.length).toFixed(2));
        }
      }

      // --- Calculate Benchmark Average Return ---
      const benchmarkReturns = [];
      for (let i = 0; i < finalDisplayData.length; i++) {
        const currentPoint = finalDisplayData[i];
        const forwardDate = new Date(new Date(currentPoint.date).setFullYear(new Date(currentPoint.date).getFullYear() + 1));
        const forwardPoint = combinedData.find(p => new Date(p.date) >= forwardDate);
        if (forwardPoint) {
            const returnVal = ((forwardPoint.spx - currentPoint.spx) / currentPoint.spx) * 100;
            benchmarkReturns.push(returnVal);
        }
      }
      if (benchmarkReturns.length > 0) {
        const totalBenchmarkReturn = benchmarkReturns.reduce((acc, val) => acc + val, 0);
        setBenchmarkAverageReturn((totalBenchmarkReturn / benchmarkReturns.length).toFixed(2));
      }

      if (finalDisplayData.length >= 2) {
        const latestPoint = finalDisplayData[finalDisplayData.length - 1];
        const previousPoint = finalDisplayData[finalDisplayData.length - 2];
        if (previousPoint.vix > 30 && latestPoint.vix < previousPoint.vix) {
          setSignal({ message: 'Good Time to Enter', color: 'text-green-500' });
        } else if (latestPoint.vix > 30) {
          setSignal({ message: 'High Fear: Monitor', color: 'text-yellow-500' });
        } else {
          setSignal({ message: 'Wait', color: 'text-red-500' });
        }
      } else {
        setSignal({ message: 'No Data', color: 'text-yellow-500' });
      }

    } catch (err) {
      setError(err.message);
      setSignal({ message: 'Error', color: 'text-red-500' });
    } finally {
      setIsLoading(false);
    }
  }, [timeFrame, customStartDate, customEndDate]);

  useEffect(() => {
    if (timeFrame !== 'Custom') {
        fetchData();
    }
  }, [timeFrame, fetchData]);
  
  const handleCustomDateSubmit = () => {
    if (customStartDate && customEndDate) {
        if (new Date(customStartDate) > new Date(customEndDate)) {
            setError("Start date cannot be after end date.");
            return;
        }
        fetchData();
    } else {
        setError("Please select both a start and end date.");
    }
  }

  const formattedData = useMemo(() => {
    return data.map(d => ({
      ...d,
      date: new Date(d.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    }));
  }, [data]);

  const formatXAxis = (tickItem) => {
    const date = new Date(tickItem);
    if (timeFrame === '1Y' || timeFrame === '2Y' || timeFrame === '5Y') {
        const month = date.toLocaleDateString('en-US', { month: 'short' });
        const year = date.getFullYear().toString().slice(-2);
        return `${month}'${year}`;
    }
    return date.getFullYear();
  };

  const timeFrames = ['1Y', '2Y', '5Y', '10Y', '20Y', '50Y', 'Custom'];

  return (
    <div className="bg-gray-900 text-white min-h-screen p-4 sm:p-6 lg:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6">
          <h1 className="text-3xl sm:text-4xl font-bold text-cyan-400">S&P 500 & VIX Market Entry Analyzer</h1>
          <p className="text-gray-400 mt-2">Using the VIX as a market sentiment indicator to find potential entry points. Data from Yahoo Finance.</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <div className="mb-4 flex justify-center flex-wrap items-center gap-2">
                {timeFrames.map(tf => (
                    <button key={tf} onClick={() => setTimeFrame(tf)} disabled={isLoading} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${ timeFrame === tf ? 'bg-cyan-500 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600' } disabled:opacity-50 disabled:cursor-not-allowed`}>
                        {tf}
                    </button>
                ))}
            </div>

            {timeFrame === 'Custom' && (
                <div className="flex justify-center items-end gap-4 mb-6 bg-gray-800 p-4 rounded-lg">
                    <div>
                        <label htmlFor="startDate" className="block text-sm font-medium text-gray-300 mb-1">Start Date</label>
                        <input type="date" id="startDate" value={customStartDate} onChange={e => setCustomStartDate(e.target.value)} className="bg-gray-700 text-white p-2 rounded-md border border-gray-600 focus:ring-2 focus:ring-cyan-500 focus:outline-none"/>
                    </div>
                    <div>
                        <label htmlFor="endDate" className="block text-sm font-medium text-gray-300 mb-1">End Date</label>
                        <input type="date" id="endDate" value={customEndDate} onChange={e => setCustomEndDate(e.target.value)} className="bg-gray-700 text-white p-2 rounded-md border border-gray-600 focus:ring-2 focus:ring-cyan-500 focus:outline-none"/>
                    </div>
                    <button onClick={handleCustomDateSubmit} disabled={isLoading} className="bg-cyan-500 text-white px-4 py-2 rounded-md hover:bg-cyan-600 transition-colors disabled:opacity-50">Apply</button>
                </div>
            )}
            
            <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
                <h2 className="text-xl font-semibold mb-4 text-white">S&P 500 vs. VIX ({timeFrame === 'Custom' && customStartDate && customEndDate ? `${customStartDate} to ${customEndDate}` : timeFrame})</h2>
                <ResponsiveContainer width="100%" height={400}>
                    {isLoading ? ( <div className="flex items-center justify-center h-full text-gray-400">Loading chart data...</div>
                    ) : error ? ( <div className="flex flex-col items-center justify-center h-full p-4 text-center"><span className="text-red-400">{error}</span><button onClick={fetchData} className="mt-4 px-4 py-2 bg-cyan-500 text-white rounded-md hover:bg-cyan-600 transition-colors">Retry</button></div>
                    ) : data.length > 0 ? (
                        <LineChart data={formattedData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
                            <XAxis dataKey="date" stroke="#A0AEC0" tick={{ fontSize: 12 }} tickFormatter={formatXAxis} />
                            <YAxis yAxisId="left" stroke="#63B3ED" label={{ value: 'S&P 500 (^GSPC)', angle: -90, position: 'insideLeft', fill: '#63B3ED' }} tick={{ fontSize: 12 }} domain={['dataMin', 'dataMax']} />
                            <YAxis yAxisId="right" orientation="right" stroke="#F6E05E" label={{ value: 'VIX (^VIX)', angle: 90, position: 'insideRight', fill: '#F6E05E' }} tick={{ fontSize: 12 }} />
                            <Tooltip contentStyle={{ backgroundColor: '#1A202C', border: '1px solid #4A5568' }} labelStyle={{ color: '#E2E8F0' }} />
                            <Legend />
                            <Line yAxisId="left" type="monotone" dataKey="spx" stroke="#63B3ED" strokeWidth={2} dot={false} name="S&P 500" />
                            <Line yAxisId="right" type="monotone" dataKey="vix" stroke="#F6E05E" strokeWidth={2} dot={false} name="VIX" />
                            <ReferenceLine yAxisId="right" y={30} label={{ value: "High Fear", position: "insideTopRight", fill: "#A0AEC0" }} stroke="#FC8181" strokeDasharray="3 3" />
                        </LineChart>
                    ) : ( <div className="flex items-center justify-center h-full text-gray-400">No data available for the selected range.</div> )}
                </ResponsiveContainer>
                {/* --- Average Returns Display --- */}
                {!isLoading && (data.length > 0) && (
                    <div className="mt-4 flex justify-around gap-x-4 text-center">
                        {average6MonthReturn !== null && (
                            <div className="text-lg">
                                <span className="text-gray-400 block text-sm">Signal Avg 6M Return</span>
                                <span className={`font-bold text-xl ${average6MonthReturn > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {average6MonthReturn}%
                                </span>
                            </div>
                        )}
                        {averageReturn !== null && (
                            <div className="text-lg">
                                <span className="text-gray-400 block text-sm">Signal Avg 12M Return</span>
                                <span className={`font-bold text-xl ${averageReturn > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {averageReturn}%
                                </span>
                            </div>
                        )}
                        {benchmarkAverageReturn !== null && (
                            <div className="text-lg">
                                <span className="text-gray-400 block text-sm">S&P 500 Avg 12M Return</span>
                                <span className={`font-bold text-xl ${benchmarkAverageReturn > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                    {benchmarkAverageReturn}%
                                </span>
                            </div>
                        )}
                    </div>
                )}
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-gray-800 p-6 rounded-xl shadow-lg text-center"><h2 className="text-xl font-semibold mb-4 text-white">Market Entry Signal</h2><p className={`text-4xl font-bold ${signal.color}`}>{signal.message}</p><p className="text-gray-400 mt-2">Based on latest data</p></div>
            <div className="bg-gray-800 p-6 rounded-xl shadow-lg"><h2 className="text-xl font-semibold mb-4 text-white">Latest Data</h2><div className="space-y-3"><div className="flex justify-between items-center"><span className="text-gray-400">S&P 500:</span><span className="text-2xl font-bold text-blue-400">{!isLoading && data.length > 0 ? data[data.length - 1].spx.toFixed(2) : 'N/A'}</span></div><div className="flex justify-between items-center"><span className="text-gray-400">VIX:</span><span className="text-2xl font-bold text-yellow-400">{!isLoading && data.length > 0 && data[data.length-1].vix ? data[data.length - 1].vix.toFixed(2) : 'N/A'}</span></div></div></div>
            <div className="bg-gray-800 p-6 rounded-xl shadow-lg"><h2 className="text-xl font-semibold mb-2 text-white">Methodology</h2><p className="text-gray-400 text-sm">This tool uses the VIX, often called the "fear index," to gauge market sentiment. A high VIX suggests fear and potential market bottoms.<br/><br/>The signal turns to <strong className="text-green-500">"Good Time to Enter"</strong> when the VIX has been high (above 30) and shows signs of declining, suggesting fear is subsiding. This is a contrarian indicator.</p></div>
          </div>
        </div>

        {/* --- Historical Signals Table --- */}
        <div className="mt-8 bg-gray-800 rounded-xl shadow-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Historical Buy Signals ({timeFrame === 'Custom' && customStartDate && customEndDate ? `${customStartDate} to ${customEndDate}` : timeFrame})</h2>
            {!isLoading && data.length > 0 && (
                historicalSignals.length > 0 ? (
                    <div className="overflow-x-auto max-h-96">
                        <table className="w-full text-sm text-left text-gray-300">
                            <thead className="text-xs text-cyan-400 uppercase bg-gray-700 sticky top-0">
                            <tr>
                                <th scope="col" className="px-6 py-3">Date</th>
                                <th scope="col" className="px-6 py-3">S&P 500</th>
                                <th scope="col" className="px-6 py-3">VIX</th>
                                <th scope="col" className="px-6 py-3">6-Month Return</th>
                                <th scope="col" className="px-6 py-3">12-Month Return</th>
                            </tr>
                            </thead>
                            <tbody>
                            {historicalSignals.map((signal, index) => (
                                <tr key={index} className="bg-gray-800 border-b border-gray-700 hover:bg-gray-600">
                                <td className="px-6 py-4">{new Date(signal.date).toLocaleDateString()}</td>
                                <td className="px-6 py-4">{signal.spxOnSignal.toFixed(2)}</td>
                                <td className="px-6 py-4">{signal.vixOnSignal.toFixed(2)}</td>
                                <td className={`px-6 py-4 font-bold ${
                                    signal.sixMonthForwardReturn === null 
                                    ? 'text-gray-400' 
                                    : (parseFloat(signal.sixMonthForwardReturn) > 0 ? 'text-green-400' : 'text-red-400')
                                }`}>
                                    {signal.sixMonthForwardReturn !== null ? `${signal.sixMonthForwardReturn}%` : 'Pending...'}
                                </td>
                                <td className={`px-6 py-4 font-bold ${
                                    signal.forwardReturn === null 
                                    ? 'text-gray-400' 
                                    : (parseFloat(signal.forwardReturn) > 0 ? 'text-green-400' : 'text-red-400')
                                }`}>
                                    {signal.forwardReturn !== null ? `${signal.forwardReturn}%` : 'Pending...'}
                                </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="text-center text-gray-400 py-8">
                        No historical buy signals found for this period.
                    </div>
                )
            )}
            {isLoading && (
                <div className="text-center text-gray-400 py-8">
                    Loading historical data...
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default App;
