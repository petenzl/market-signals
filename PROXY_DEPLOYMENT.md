# Backend Proxy Deployment Guide

The free CORS proxies are rate-limited. To fix this, deploy your own backend proxy.

## Quick Deploy to Vercel (Recommended)

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. **Deploy the proxy**:
   ```bash
   vercel
   ```
   Follow the prompts. When asked:
   - Link to existing project? **No**
   - Project name: `market-signals-proxy` (or any name)
   - Directory: `./api`

3. **Get your proxy URL**:
   After deployment, Vercel will give you a URL like: `https://market-signals-proxy.vercel.app`

4. **Update `src/App.js`**:
   Uncomment and update the proxy URL in the `proxyUrls` array:
   ```javascript
   const proxyUrls = [
     'https://your-proxy.vercel.app/api/proxy?url=', // Replace with your Vercel URL
     'https://api.codetabs.com/v1/proxy/?quest=', // Fallback
     // ...
   ];
   ```

## Alternative: Deploy to Netlify

1. Create a `netlify.toml` file:
   ```toml
   [build]
     functions = "api"
   
   [[redirects]]
     from = "/api/proxy"
     to = "/.netlify/functions/proxy"
     status = 200
   ```

2. Create `netlify/functions/proxy.js`:
   ```javascript
   exports.handler = async (event, context) => {
     const { url } = event.queryStringParameters;
     
     if (!url) {
       return {
         statusCode: 400,
         body: JSON.stringify({ error: 'Missing url parameter' })
       };
     }
     
     try {
       const response = await fetch(url);
       const data = await response.json();
       
       return {
         statusCode: 200,
         headers: {
           'Access-Control-Allow-Origin': '*',
         },
         body: JSON.stringify(data)
       };
     } catch (error) {
       return {
         statusCode: 500,
         body: JSON.stringify({ error: error.message })
       };
     }
   };
   ```

3. Deploy to Netlify and update the proxy URL in `src/App.js`.

## Why This Is Needed

Free CORS proxies have rate limits and often block requests from GitHub Pages. Your own backend proxy:
- ✅ No rate limits (within reason)
- ✅ More reliable
- ✅ Free to deploy (Vercel/Netlify free tier)
- ✅ Full control
