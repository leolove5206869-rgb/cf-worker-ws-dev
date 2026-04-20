/**
 * Subscription content generator
 */

import { at, pt, ed, trojanPt, HttpPort, HttpsPort } from '../config/constants.js';
import { proxyIPs } from '../config/defaults.js';

/**
 * Generates subscription content with VLESS and Trojan URLs.
 * @param {string} userID_path - User ID path (supports comma-separated multiple UUIDs)
 * @param {string} hostname - Host name for configuration
 * @param {string|string[]} proxyIP - Proxy IP address or array of addresses
 * @param {string} trojanPassword - Trojan password (optional, defaults to first userID)
 * @returns {string} Base64 encoded subscription content
 */
export function genSub(userID_path, hostname, proxyIP, trojanPassword = null) {
	// Add all CloudFlare public CNAME domains
	const mainDomains = new Set([
		hostname,
		// public domains
		'icook.hk',
		'japan.com',
		'malaysia.com',
		'russia.com',
		'singapore.com',
		'www.visa.com',
		'www.csgo.com',
		'www.shopify.com',
		'www.whatismyip.com',
		'www.ipget.net',
		// High frequency update sources
		'freeyx.cloudflare88.eu.org',    // 1000ip/3min
		'cloudflare.182682.xyz',         // 15ip/15min
		'cfip.cfcdn.vip',                // 6ip/1day
		...proxyIPs,
		// Manual update and unknown frequency
		'cf.0sm.com',
		'cloudflare-ip.mofashi.ltd',
		'cf.090227.xyz',
		'cf.zhetengsha.eu.org',
		'cloudflare.9jy.cc',
		'cf.zerone-cdn.pp.ua',
		'cfip.1323123.xyz',
		'cdn.tzpro.xyz',
		'cf.877771.xyz',
		'cnamefuckxxs.yuchen.icu',
		'cfip.xxxxxxxx.tk',              // OTC maintained
	]);

	const userIDArray = userID_path.includes(',') ? userID_path.split(",") : [userID_path];
	const proxyIPArray = Array.isArray(proxyIP) ? proxyIP : (proxyIP ? (proxyIP.includes(',') ? proxyIP.split(',') : [proxyIP]) : proxyIPs);
	const randomPath = () => '/' + Math.random().toString(36).substring(2, 15) + '?ed=2048';
	const commonUrlPartHttp = `?encryption=none&security=none&fp=random&type=ws&host=${hostname}&path=${encodeURIComponent(randomPath())}#`;
	const commonUrlPartHttps = `?encryption=none&security=tls&sni=${hostname}&fp=random&type=ws&host=${hostname}&path=%2F%3Fed%3D2048#`;

	const result = userIDArray.flatMap((userID) => {
		let allUrls = [];
		// Generate main HTTP URLs first for all domains (except pages.dev)
		if (!hostname.includes('pages.dev')) {
			mainDomains.forEach(domain => {
				Array.from(HttpPort).forEach((port) => {
					const urlPart = `${hostname.split('.')[0]}-${domain}-HTTP-${port}`;
					const mainProtocolHttp = atob(pt) + '://' + userID + atob(at) + domain + ':' + port + commonUrlPartHttp + urlPart;
					allUrls.push(mainProtocolHttp);
				});
			});
		}

		// Generate main HTTPS URLs for all domains
		mainDomains.forEach(domain => {
			Array.from(HttpsPort).forEach((port) => {
				const urlPart = `${hostname.split('.')[0]}-${domain}-HTTPS-${port}`;
				const mainProtocolHttps = atob(pt) + '://' + userID + atob(at) + domain + ':' + port + commonUrlPartHttps + urlPart;
				allUrls.push(mainProtocolHttps);
			});
		});

		// Generate proxy HTTPS URLs
		proxyIPArray.forEach((proxyAddr) => {
			const [proxyHost, proxyPort = '443'] = proxyAddr.split(':');
			const urlPart = `${hostname.split('.')[0]}-${proxyHost}-HTTPS-${proxyPort}`;
			const secondaryProtocolHttps = atob(pt) + '://' + userID + atob(at) + proxyHost + ':' + proxyPort + commonUrlPartHttps + urlPart + '-' + atob(ed);
			allUrls.push(secondaryProtocolHttps);
		});

		return allUrls;
	});

	// Generate Trojan URLs
	const effectiveTrojanPassword = trojanPassword || userIDArray[0];
	const trojanUrls = generateTrojanUrls(effectiveTrojanPassword, hostname, proxyIPArray);

	return btoa([...result, ...trojanUrls].join('\n'));
}

/**
 * Generates Trojan subscription URLs
 * @param {string} password - Trojan password
 * @param {string} hostname - Host name
 * @param {string[]} proxyIPArray - Proxy IP array
 * @returns {string[]} Array of Trojan URLs
 */
function generateTrojanUrls(password, hostname, proxyIPArray) {
	const urls = [];
	const encodedPassword = encodeURIComponent(password);
	const commonParams = `?security=tls&type=ws&host=${hostname}&path=%2F%3Fed%3D2048&sni=${hostname}`;

	// Main hostname Trojan URLs (HTTPS ports only)
	Array.from(HttpsPort).forEach((port) => {
		const urlPart = `${hostname.split('.')[0]}-Trojan-HTTPS-${port}`;
		const trojanUrl = `${atob(trojanPt)}://${encodedPassword}@${hostname}:${port}${commonParams}#${urlPart}`;
		urls.push(trojanUrl);
	});

	// Proxy IP Trojan URLs
	proxyIPArray.forEach((proxyAddr) => {
		const [proxyHost, proxyPort = '443'] = proxyAddr.split(':');
		const urlPart = `${hostname.split('.')[0]}-${proxyHost}-Trojan-${proxyPort}`;
		const trojanUrl = `${atob(trojanPt)}://${encodedPassword}@${proxyHost}:${proxyPort}${commonParams}#${urlPart}`;
		urls.push(trojanUrl);
	});

	return urls;
}

/**
 * Generates Trojan-only subscription content
 * @param {string} password - Trojan password
 * @param {string} hostname - Host name
 * @param {string|string[]} proxyIP - Proxy IP address or array of addresses
 * @returns {string} Base64 encoded Trojan subscription content
 */
export function genTrojanSub(password, hostname, proxyIP) {
	const proxyIPArray = Array.isArray(proxyIP) ? proxyIP : (proxyIP ? (proxyIP.includes(',') ? proxyIP.split(',') : [proxyIP]) : proxyIPs);
	const urls = generateTrojanUrls(password, hostname, proxyIPArray);
	return btoa(urls.join('\n'));
}
