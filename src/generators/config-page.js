/**
 * Configuration page HTML generator
 */

import { at, pt, trojanPt } from '../config/constants.js';
import { proxyIPs } from '../config/defaults.js';

/**
 * Generates configuration HTML page for VLESS and Trojan clients.
 * @param {string} userIDs - Single or comma-separated user IDs
 * @param {string} hostName - Host name for configuration
 * @param {string|string[]} proxyIP - Proxy IP address or array of addresses
 * @param {string} trojanPassword - Trojan password (optional, defaults to first userID)
 * @returns {string} Configuration HTML
 */
export function getConfig(userIDs, hostName, proxyIP, trojanPassword = null) {
	// Get proxy port from first proxy address
	const firstProxy = Array.isArray(proxyIP) ? proxyIP[0] : proxyIP;
	const proxyPort = firstProxy.includes(':') ? firstProxy.split(':')[1] : '443';

	const commonUrlPart = `?encryption=none&security=tls&sni=${hostName}&fp=randomized&type=ws&host=${hostName}&path=%2F%3Fed%3D2048#${hostName}`;

	// Split the userIDs into an array
	const userIDArray = userIDs.split(",");

	// Trojan password (use provided or default to first userID)
	const effectiveTrojanPassword = trojanPassword || userIDArray[0];
	const trojanCommonUrlPart = `?security=tls&type=ws&host=${hostName}&path=%2F%3Fed%3D2048&sni=${hostName}#${hostName}`;

	// Prepare output string for each userID
	const sublink = `https://${hostName}/sub/${userIDArray[0]}?format=clash`;
	const subbestip = `https://${hostName}/bestip/${userIDArray[0]}`;
	const clash_link = `https://url.v1.mk/sub?target=clash&url=${encodeURIComponent(`https://${hostName}/sub/${userIDArray[0]}?format=clash`)}&insert=false&emoji=true&list=false&tfo=false&scv=true&fdn=false&sort=false&new_name=true`;

	// HTML Head with CSS and FontAwesome library
	const htmlHead = `
  <head>
    <title>EDtunnel: Configuration</title>
    <meta name='viewport' content='width=device-width, initial-scale=1'>
    <meta property='og:site_name' content='EDtunnel: Protocol Configuration' />
    <meta property='og:type' content='website' />
    <meta property='og:title' content='EDtunnel - Protocol Configuration and Subscribe Output' />
    <meta property='og:description' content='Use Cloudflare Pages and Worker serverless to implement protocol' />
    <meta property='og:url' content='https://${hostName}/' />
    <meta property='og:image' content='https://cdn.jsdelivr.net/gh/6Kmfi6HP/EDtunnel@refs/heads/main/image/logo.png' />
    <meta name='twitter:card' content='summary_large_image' />
    <meta name='twitter:title' content='EDtunnel - Protocol Configuration and Subscribe Output' />
    <meta name='twitter:description' content='Use Cloudflare Pages and Worker serverless to implement protocol' />
    <meta name='twitter:url' content='https://${hostName}/' />
    <meta name='twitter:image' content='https://cdn.jsdelivr.net/gh/6Kmfi6HP/EDtunnel@refs/heads/main/image/logo.png' />
    <meta property='og:image:width' content='1500' />
    <meta property='og:image:height' content='1500' />

    <style>
      body {
        font-family: 'Roboto', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        background-color: #000000;
        color: #ffffff;
        line-height: 1.6;
        padding: 20px;
        max-width: 1200px;
        margin: 0 auto;
      }
      .container {
        background-color: #111111;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(255, 255, 255, 0.1);
        padding: 20px;
        margin-bottom: 20px;
      }
      h1, h2 {
        color: #ffffff;
      }
      .config-item {
        background-color: #222222;
        border: 1px solid #333333;
        border-radius: 4px;
        padding: 15px;
        margin-bottom: 15px;
      }
      .config-item h3 {
        margin-top: 0;
        color: #ffffff;
      }
      .btn {
        background-color: #ffffff;
        color: #000000;
        border: none;
        padding: 10px 15px;
        border-radius: 4px;
        cursor: pointer;
        transition: background-color 0.3s, color 0.3s;
      }
      .btn:hover {
        background-color: #cccccc;
      }
      .btn-group {
        margin-top: 10px;
      }
      .btn-group .btn {
        margin-right: 10px;
      }
      pre {
        background-color: #333333;
        border: 1px solid #444444;
        border-radius: 4px;
        padding: 10px;
        white-space: pre-wrap;
        word-wrap: break-word;
        color: #00ff00;
      }
      .logo {
        float: left;
        margin-right: 20px;
        margin-bottom: 20px;
		max-width: 30%;
      }
      @media (max-width: 768px) {
        .logo {
          float: none;
          display: block;
          margin: 0 auto 20px;
          max-width: 90%; /* Adjust the max-width to fit within the container */
        }
        .btn-group {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .btn-group .btn {
          margin-bottom: 10px;
          width: 100%;
          text-align: center;
        }
      }
      .code-container {
        position: relative;
        margin-bottom: 15px;
      }
      .code-container pre {
        margin: 0;
        padding-right: 100px; /* Make space for the button */
      }
      .copy-btn {
        position: absolute;
        top: 5px;
        right: 5px;
        padding: 5px 10px;
        font-size: 0.8em;
      }
      .subscription-info {
        margin-top: 20px;
        background-color: #222222;
        border-radius: 4px;
        padding: 15px;
      }
      .subscription-info h3 {
        color: #ffffff;
        margin-top: 0;
      }
      .subscription-info ul {
        padding-left: 20px;
      }
      .subscription-info li {
        margin-bottom: 10px;
      }
    </style>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.3/css/all.min.css">
  </head>
  `;

	const header = `
    <div class="container">
      <h1>EDtunnel: Protocol Configuration</h1>
      <img src="https://cdn.jsdelivr.net/gh/6Kmfi6HP/EDtunnel@refs/heads/main/image/logo.png" alt="EDtunnel Logo" class="logo">
      <p>Welcome! This function generates configuration for the vless protocol. If you found this useful, please check our GitHub project:</p>
      <p><a href="https://github.com/6Kmfi6HP/EDtunnel" target="_blank" style="color: #00ff00;">EDtunnel - https://github.com/6Kmfi6HP/EDtunnel</a></p>
      <div style="clear: both;"></div>
      <div class="btn-group">
        <a href="//${hostName}/sub/${userIDArray[0]}" class="btn" target="_blank"><i class="fas fa-link"></i> VLESS Subscription</a>
        <a href="//${hostName}/trojan/${userIDArray[0]}" class="btn" target="_blank"><i class="fas fa-shield-alt"></i> Trojan Subscription</a>
        <a href="clash://install-config?url=${encodeURIComponent(`https://${hostName}/sub/${userIDArray[0]}?format=clash`)}" class="btn" target="_blank"><i class="fas fa-bolt"></i> Clash Subscription</a>
        <a href="${clash_link}" class="btn" target="_blank"><i class="fas fa-bolt"></i> Clash Link</a>
        <a href="${subbestip}" class="btn" target="_blank"><i class="fas fa-star"></i> Best IP Subscription</a>
      </div>
      <div class="subscription-info">
        <h3>Options Explained:</h3>
        <ul>
          <li><strong>VLESS Subscription:</strong> Direct link for VLESS protocol configuration. Suitable for clients supporting VLESS.</li>
          <li><strong>Trojan Subscription:</strong> Direct link for Trojan protocol configuration. Suitable for clients supporting Trojan-WS.</li>
          <li><strong>Clash Subscription:</strong> Opens the Clash client with pre-configured settings. Best for Clash users on mobile devices.</li>
          <li><strong>Clash Link:</strong> A web link to convert the VLESS config to Clash format. Useful for manual import or troubleshooting.</li>
          <li><strong>Best IP Subscription:</strong> Provides a curated list of optimal server IPs for many <b>different countries</b>.</li>
        </ul>
        <p>Choose the option that best fits your client and needs. For most users, the VLESS or Clash Subscription will be the easiest to use.</p>
      </div>
    </div>
  `;

	// Generate Trojan configuration
	const trojanMain = atob(trojanPt) + '://' + encodeURIComponent(effectiveTrojanPassword) + atob(at) + hostName + ":443" + trojanCommonUrlPart;
	const firstProxyHostForTrojan = (Array.isArray(proxyIP) ? proxyIP[0] : proxyIP).split(':')[0];
	const trojanSec = atob(trojanPt) + '://' + encodeURIComponent(effectiveTrojanPassword) + atob(at) + firstProxyHostForTrojan + ":" + proxyPort + trojanCommonUrlPart;

	const configOutput = userIDArray.map((userID) => {
		const protocolMain = atob(pt) + '://' + userID + atob(at) + hostName + ":443" + commonUrlPart;
		const firstProxyHost = (Array.isArray(proxyIP) ? proxyIP[0] : proxyIP).split(':')[0];
		const protocolSec = atob(pt) + '://' + userID + atob(at) + firstProxyHost + ":" + proxyPort + commonUrlPart;
		return `
      <div class="container config-item">
        <h2>UUID: ${userID}</h2>
        <h3>VLESS Default IP Configuration</h3>
        <div class="code-container">
          <pre><code>${protocolMain}</code></pre>
          <button class="btn copy-btn" onclick='copyToClipboard("${protocolMain}")'><i class="fas fa-copy"></i> Copy</button>
        </div>

        <h3>VLESS Best IP Configuration</h3>
        <div class="input-group mb-3">
          <select class="form-select" id="proxySelect" onchange="updateProxyConfig()">
            ${typeof proxyIP === 'string' ?
				`<option value="${proxyIP}">${proxyIP}</option>` :
				Array.from(proxyIP).map(proxy => `<option value="${proxy}">${proxy}</option>`).join('')}
          </select>
        </div>
		<br>
        <div class="code-container">
          <pre><code id="proxyConfig">${protocolSec}</code></pre>
          <button class="btn copy-btn" onclick='copyToClipboard(document.getElementById("proxyConfig").textContent)'><i class="fas fa-copy"></i> Copy</button>
        </div>
      </div>
    `;
	}).join('');

	// Trojan configuration section
	const trojanConfigOutput = `
      <div class="container config-item">
        <h2>Trojan Configuration</h2>
        <p>Password: <code>${effectiveTrojanPassword}</code></p>
        <h3>Trojan Default IP Configuration</h3>
        <div class="code-container">
          <pre><code>${trojanMain}</code></pre>
          <button class="btn copy-btn" onclick='copyToClipboard("${trojanMain}")'><i class="fas fa-copy"></i> Copy</button>
        </div>

        <h3>Trojan Best IP Configuration</h3>
        <div class="input-group mb-3">
          <select class="form-select" id="trojanProxySelect" onchange="updateTrojanProxyConfig()">
            ${typeof proxyIP === 'string' ?
				`<option value="${proxyIP}">${proxyIP}</option>` :
				Array.from(proxyIP).map(proxy => `<option value="${proxy}">${proxy}</option>`).join('')}
          </select>
        </div>
		<br>
        <div class="code-container">
          <pre><code id="trojanProxyConfig">${trojanSec}</code></pre>
          <button class="btn copy-btn" onclick='copyToClipboard(document.getElementById("trojanProxyConfig").textContent)'><i class="fas fa-copy"></i> Copy</button>
        </div>
      </div>
    `;

	return `
  <html>
  ${htmlHead}
  <body>
    ${header}
    ${configOutput}
    ${trojanConfigOutput}
    <script>
      const userIDArray = ${JSON.stringify(userIDArray)};
      const pt = "${pt}";
      const at = "${at}";
      const trojanPt = "${trojanPt}";
      const trojanPassword = "${encodeURIComponent(effectiveTrojanPassword)}";
      const commonUrlPart = "?encryption=none&security=tls&sni=${hostName}&fp=randomized&type=ws&host=${hostName}&path=%2F%3Fed%3D2048#${hostName}";
      const trojanCommonUrlPart = "?security=tls&type=ws&host=${hostName}&path=%2F%3Fed%3D2048&sni=${hostName}#${hostName}";

      function copyToClipboard(text) {
        navigator.clipboard.writeText(text)
          .then(() => {
            alert("Copied to clipboard");
          })
          .catch((err) => {
            console.error("Failed to copy to clipboard:", err);
          });
      }

      function updateProxyConfig() {
        const select = document.getElementById('proxySelect');
        const proxyValue = select.value;
        const [host, port] = proxyValue.split(':');
        const protocolSec = atob(pt) + '://' + userIDArray[0] + atob(at) + host + ":" + port + commonUrlPart;
        document.getElementById("proxyConfig").textContent = protocolSec;
      }

      function updateTrojanProxyConfig() {
        const select = document.getElementById('trojanProxySelect');
        const proxyValue = select.value;
        const [host, port] = proxyValue.split(':');
        const trojanSec = atob(trojanPt) + '://' + trojanPassword + atob(at) + host + ":" + port + trojanCommonUrlPart;
        document.getElementById("trojanProxyConfig").textContent = trojanSec;
      }
    </script>
  </body>
  </html>`;
}
