/**
 * TCP outbound connection management with multi-proxy rotation
 */

import { socks5Connect } from './socks5.js';
import { httpConnect } from './http.js';
import { remoteSocketToWS } from './stream.js';
import { safeCloseWebSocket } from '../utils/websocket.js';
import { resolveProxyAddresses, connectWithRotation } from '../utils/proxyResolver.js';
import { vlessOutboundConnect, VLESS_CMD_TCP } from './vless.js';

/**
 * Handles outbound TCP connections for the proxy.
 * Establishes connection to remote server and manages data flow.
 * Supports multi-proxy rotation with fallback mechanism.
 * @param {{value: import("@cloudflare/workers-types").Socket | null}} remoteSocket - Remote socket wrapper
 * @param {number} addressType - Type of address (1=IPv4, 2=Domain, 3=IPv6)
 * @param {string} addressRemote - Remote server address
 * @param {number} portRemote - Remote server port
 * @param {Uint8Array} rawClientData - Raw data from client
 * @param {WebSocket} webSocket - WebSocket connection
 * @param {Uint8Array} protocolResponseHeader - Protocol response header
 * @param {Function} log - Logging function
 * @param {Object} config - Request configuration
 * @param {Function} connect - Cloudflare socket connect function
 */
export async function handleTCPOutBound(remoteSocket, addressType, addressRemote, portRemote, rawClientData, webSocket, protocolResponseHeader, log, config, connect) {

	/**
	 * Connects to target via VLESS, SOCKS5 or HTTP proxy
	 * @returns {Promise<import("@cloudflare/workers-types").Socket|{readable: ReadableStream, writable: WritableStream, closed: Promise<void>}>}
	 */
	async function connectViaProxy() {
		if (config.proxyType === 'vless' && config.parsedVlessOutbound) {
			log(`[TCP] Connecting via VLESS outbound to ${addressRemote}:${portRemote}`);
			const vlessResult = await vlessOutboundConnect(
				config.parsedVlessOutbound,
				VLESS_CMD_TCP,
				addressType,
				addressRemote,
				portRemote,
				rawClientData,
				log
			);
			if (!vlessResult) {
				throw new Error('VLESS outbound connection failed');
			}
			// Return a socket-like object that wraps the streams
			return {
				readable: vlessResult.readable,
				writable: vlessResult.writable,
				closed: vlessResult.closed
			};
		} else if (config.proxyType === 'http') {
			log(`[TCP] Connecting via HTTP proxy to ${addressRemote}:${portRemote}`);
			const tcpSocket = await httpConnect(addressType, addressRemote, portRemote, log, config.parsedProxyAddress, connect, rawClientData);
			if (!tcpSocket) {
				throw new Error('HTTP proxy connection failed');
			}
			return tcpSocket;
		} else {
			log(`[TCP] Connecting via SOCKS5 proxy to ${addressRemote}:${portRemote}`);
			const tcpSocket = await socks5Connect(addressType, addressRemote, portRemote, log, config.parsedProxyAddress, connect);
			if (!tcpSocket) {
				throw new Error('SOCKS5 proxy connection failed');
			}
			// Write initial data for SOCKS5 (HTTP proxy handles internally)
			const writer = tcpSocket.writable.getWriter();
			await writer.write(rawClientData);
			writer.releaseLock();
			return tcpSocket;
		}
	}

	/**
	 * Connects directly to target address
	 * @param {string} address - Target address
	 * @param {number} port - Target port
	 * @returns {Promise<import("@cloudflare/workers-types").Socket>}
	 */
	async function connectDirect(address, port) {
		log(`[TCP] Direct connecting to ${address}:${port}`);
		const tcpSocket = connect({ hostname: address, port: port });
		const writer = tcpSocket.writable.getWriter();
		await writer.write(rawClientData);
		writer.releaseLock();
		return tcpSocket;
	}

	/**
	 * Connects using multi-proxy rotation with fallback
	 * @param {boolean} enableFallback - Whether to fallback to direct connection if all proxies fail
	 * @returns {Promise<import("@cloudflare/workers-types").Socket>}
	 */
	async function connectWithProxyRotation(enableFallback = true) {
		// Resolve proxy addresses (uses cache if available)
		const proxyAddresses = await resolveProxyAddresses(
			config.proxyIP,
			addressRemote,
			config.userID || ''
		);

		if (proxyAddresses.length > 0) {
			// Try connecting with rotation
			const result = await connectWithRotation(
				proxyAddresses,
				rawClientData,
				connect,
				log,
				config.proxyTimeout || 1500
			);

			if (result) {
				return result.socket;
			}
		}

		// Fallback to direct connection if enabled
		if (enableFallback) {
			log(`[TCP] All proxies failed, falling back to direct connection`);
			return await connectDirect(addressRemote, portRemote);
		}

		throw new Error('All proxy connections failed and fallback is disabled');
	}

	/**
	 * Retry function for when initial connection has no incoming data
	 */
	async function retry() {
		let tcpSocket;

		// Check if global proxy mode is enabled (SOCKS5, HTTP, or VLESS)
		const hasProxyConfig = config.parsedProxyAddress || config.parsedVlessOutbound;
		if (config.globalProxy && config.proxyType && hasProxyConfig) {
			// Use SOCKS5/HTTP/VLESS proxy for retry
			tcpSocket = await connectViaProxy();
		} else if (config.proxyIP) {
			// Use proxy rotation for retry
			tcpSocket = await connectWithProxyRotation(config.enableProxyFallback !== false);
		} else {
			// Direct connection as last resort
			tcpSocket = await connectDirect(addressRemote, portRemote);
		}

		remoteSocket.value = tcpSocket;

		// Close WebSocket when socket closes
		tcpSocket.closed.catch(error => {
			console.log('retry tcpSocket closed error', error);
		}).finally(() => {
			safeCloseWebSocket(webSocket);
		});

		remoteSocketToWS(tcpSocket, webSocket, protocolResponseHeader, null, log);
	}

	// Main connection logic
	let tcpSocket;

	// Check if global proxy mode is enabled (SOCKS5, HTTP, or VLESS)
	const hasProxyConfig = config.parsedProxyAddress || config.parsedVlessOutbound;
	if (config.globalProxy && config.proxyType && hasProxyConfig) {
		// Global proxy mode: use SOCKS5/HTTP/VLESS proxy directly
		log(`[TCP] Using ${config.proxyType.toUpperCase()} proxy (global mode)`);
		tcpSocket = await connectViaProxy();
		log(`[TCP] connectViaProxy returned, tcpSocket=${tcpSocket ? 'valid' : 'null'}`);

		if (!tcpSocket) {
			log('[TCP] VLESS connection returned null, closing WebSocket');
			safeCloseWebSocket(webSocket);
			return;
		}

		remoteSocket.value = tcpSocket;
		log(`[TCP] Setting up closed handler`);

		tcpSocket.closed.catch((err) => {
			log(`[TCP] tcpSocket.closed catch: ${err?.message || 'unknown'}`);
		}).finally(() => {
			log('[TCP] tcpSocket.closed finally - closing WebSocket');
			safeCloseWebSocket(webSocket);
		});

		log(`[TCP] Calling remoteSocketToWS`);
		remoteSocketToWS(tcpSocket, webSocket, protocolResponseHeader, null, log);
	} else {
		// Standard mode: try direct first, then retry with proxy
		try {
			tcpSocket = await connectDirect(addressRemote, portRemote);
			remoteSocket.value = tcpSocket;
			// Pass retry function - will be called if no incoming data
			remoteSocketToWS(tcpSocket, webSocket, protocolResponseHeader, retry, log);
		} catch (err) {
			log(`[TCP] Direct connection failed: ${err.message}, trying proxies`);
			await retry();
		}
	}
}
