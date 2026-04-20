/**
 * Main request handler and routing
 */

import { createRequestConfig, defaultUserID, proxyIPs } from '../config/defaults.js';
import { handleDefaultPath } from './http.js';
import { protocolOverWSHandler } from './websocket.js';
import { getConfig } from '../generators/config-page.js';
import { genSub, genTrojanSub } from '../generators/subscription.js';
import { handleProxyConfig, socks5AddressParser, selectRandomAddress, parseEncodedQueryParams, parsePathProxyParams, parseVlessUrl } from '../utils/parser.js';
import { isValidUUID } from '../utils/validation.js';

// Validate default user ID at startup
if (!isValidUUID(defaultUserID)) {
	throw new Error('uuid is not valid');
}

/**
 * Main request handler for the Cloudflare Worker.
 * Processes incoming requests and routes them appropriately.
 * @param {import("@cloudflare/workers-types").Request} request - The incoming request object
 * @param {Object} env - Environment variables containing configuration
 * @param {import("@cloudflare/workers-types").ExecutionContext} ctx - Execution context
 * @param {Function} connect - Cloudflare socket connect function
 * @returns {Promise<Response>} Response object
 */
export async function handleRequest(request, env, ctx, connect) {
	try {
		const { UUID, PROXYIP, SOCKS5, SOCKS5_RELAY, TROJAN_PASSWORD } = env;
		const url = new URL(request.url);

		// Create request-specific configuration
		const requestConfig = createRequestConfig(env);

		// Get URL parameters
		let urlPROXYIP = url.searchParams.get('proxyip');
		let urlSOCKS5 = url.searchParams.get('socks5');
		const urlGlobalProxy = url.searchParams.has('globalproxy');

		// Check for encoded parameters in path
		if (!urlPROXYIP && !urlSOCKS5) {
			const encodedParams = parseEncodedQueryParams(url.pathname);
			urlPROXYIP = urlPROXYIP || encodedParams.proxyip;
			urlSOCKS5 = urlSOCKS5 || encodedParams.socks5;
		}

		// Check for path-based proxy parameters (e.g., /proxyip=, /socks5=, /http=)
		const pathParams = parsePathProxyParams(url.pathname);

		// Path parameters have lower priority than query parameters
		if (!urlPROXYIP && pathParams.proxyip) {
			urlPROXYIP = pathParams.proxyip;
		}
		if (!urlSOCKS5 && pathParams.socks5) {
			urlSOCKS5 = pathParams.socks5;
		}
		// Global proxy flag from path (e.g., /socks5://, /http://, /gs5=, /ghttp=) or query param (?globalproxy)
		const enableGlobalProxy = pathParams.globalProxy || urlGlobalProxy;

		// HTTP proxy parameter
		let urlHTTP = url.searchParams.get('http') || pathParams.http;

		// Validate proxyip format
		if (urlPROXYIP) {
			const proxyPattern = /^([a-zA-Z0-9][-a-zA-Z0-9.]*(\.[a-zA-Z0-9][-a-zA-Z0-9.]*)+|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}|\[[0-9a-fA-F:]+\]):\d{1,5}$/;
			const proxyAddresses = urlPROXYIP.split(',').map(addr => addr.trim());
			const isValid = proxyAddresses.every(addr => proxyPattern.test(addr));
			if (!isValid) {
				console.warn('Invalid proxyip format:', urlPROXYIP);
				urlPROXYIP = null;
			}
		}

		// Validate socks5 format
		if (urlSOCKS5) {
			const socks5Pattern = /^(([^:@]+:[^:@]+@)?[a-zA-Z0-9][-a-zA-Z0-9.]*(\.[a-zA-Z0-9][-a-zA-Z0-9.]*)+|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):\d{1,5}$/;
			const socks5Addresses = urlSOCKS5.split(',').map(addr => addr.trim());
			const isValid = socks5Addresses.every(addr => socks5Pattern.test(addr));
			if (!isValid) {
				console.warn('Invalid socks5 format:', urlSOCKS5);
				urlSOCKS5 = null;
			}
		}

		// Apply URL parameters to request config
		requestConfig.socks5Address = urlSOCKS5 || requestConfig.socks5Address;
		requestConfig.globalProxy = enableGlobalProxy || requestConfig.socks5Relay;

		// Log parameters for debugging
		console.log('Config params:', requestConfig.userID, requestConfig.socks5Address, requestConfig.globalProxy, urlPROXYIP);

		// Handle proxy configuration
		const proxyConfig = handleProxyConfig(urlPROXYIP || PROXYIP);
		requestConfig.proxyIP = proxyConfig.ip;
		requestConfig.proxyPort = proxyConfig.port;

		// Log final proxy settings
		console.log('Using proxy:', requestConfig.proxyIP, requestConfig.proxyPort);

		// Parse VLESS outbound configuration (URL parameter > path parameter > environment variable)
		let urlVLESS = url.searchParams.get('vless') || pathParams.vless;
		if (urlVLESS || requestConfig.vlessOutbound) {
			try {
				const vlessUrl = urlVLESS || requestConfig.vlessOutbound;
				const parsed = parseVlessUrl(vlessUrl);
				if (parsed) {
					requestConfig.parsedVlessOutbound = parsed;
					requestConfig.proxyType = 'vless';
					// Use globalProxy flag from path/query params (e.g., /gvless=, /vless://, ?globalproxy)
					console.log('VLESS outbound configured:', parsed.address, parsed.port);
				}
			} catch (err) {
				console.log('VLESS outbound parse error:', err.toString());
			}
		}

		// Parse proxy configuration (VLESS > HTTP > SOCKS5)
		if (requestConfig.proxyType !== 'vless') {
			if (urlHTTP) {
				try {
					const selectedProxy = selectRandomAddress(urlHTTP);
					requestConfig.parsedProxyAddress = socks5AddressParser(selectedProxy);
					requestConfig.proxyType = 'http';
				} catch (err) {
					console.log('HTTP proxy parse error:', err.toString());
				}
			} else if (requestConfig.socks5Address) {
				try {
					const selectedProxy = selectRandomAddress(requestConfig.socks5Address);
					requestConfig.parsedProxyAddress = socks5AddressParser(selectedProxy);
					requestConfig.proxyType = 'socks5';
				} catch (err) {
					console.log('SOCKS5 proxy parse error:', err.toString());
				}
			}
		}

		const userIDs = requestConfig.userID.includes(',') ? requestConfig.userID.split(',').map(id => id.trim()) : [requestConfig.userID];
		const host = request.headers.get('Host');
		const requestedPath = url.pathname.substring(1); // Remove leading slash
		const matchingUserID = userIDs.length === 1 ?
			(requestedPath === userIDs[0] ||
				requestedPath === `sub/${userIDs[0]}` ||
				requestedPath === `bestip/${userIDs[0]}` ||
				requestedPath === `trojan/${userIDs[0]}` ? userIDs[0] : null) :
			userIDs.find(id => {
				const patterns = [id, `sub/${id}`, `bestip/${id}`, `trojan/${id}`];
				return patterns.some(pattern => requestedPath.startsWith(pattern));
			});

		// Non-WebSocket requests
		if (request.headers.get('Upgrade') !== 'websocket') {
			if (url.pathname === '/cf') {
				return new Response(JSON.stringify(request.cf, null, 4), {
					status: 200,
					headers: { "Content-Type": "application/json;charset=utf-8" },
				});
			}

			if (matchingUserID) {
				if (url.pathname === `/${matchingUserID}` || url.pathname === `/sub/${matchingUserID}`) {
					const isSubscription = url.pathname.startsWith('/sub/');
					// Priority: URL parameter > environment variable > default
					const proxyAddresses = urlPROXYIP
						? urlPROXYIP.split(',').map(addr => addr.trim())
						: (PROXYIP ? PROXYIP.split(',').map(addr => addr.trim()) : proxyIPs);
					// Get Trojan password (priority: env > userID)
					const trojanPassword = TROJAN_PASSWORD || matchingUserID;
					const content = isSubscription ?
						genSub(matchingUserID, host, proxyAddresses, trojanPassword) :
						getConfig(matchingUserID, host, proxyAddresses, trojanPassword);

					return new Response(content, {
						status: 200,
						headers: {
							"Content-Type": isSubscription ?
								"text/plain;charset=utf-8" :
								"text/html; charset=utf-8"
						},
					});
				} else if (url.pathname === `/trojan/${matchingUserID}`) {
					// Trojan-only subscription
					const proxyAddresses = urlPROXYIP
						? urlPROXYIP.split(',').map(addr => addr.trim())
						: (PROXYIP ? PROXYIP.split(',').map(addr => addr.trim()) : proxyIPs);
					const trojanPassword = TROJAN_PASSWORD || matchingUserID;
					const content = genTrojanSub(trojanPassword, host, proxyAddresses);

					return new Response(content, {
						status: 200,
						headers: { "Content-Type": "text/plain;charset=utf-8" },
					});
				} else if (url.pathname === `/bestip/${matchingUserID}`) {
					return fetch(`https://bestip.06151953.xyz/auto?host=${host}&uuid=${matchingUserID}&path=/`, { headers: request.headers });
				}
			}
			return handleDefaultPath(url, request);
		} else {
			// WebSocket upgrade request
			return await protocolOverWSHandler(request, requestConfig, connect);
		}
	} catch (err) {
		return new Response(err.toString());
	}
}
