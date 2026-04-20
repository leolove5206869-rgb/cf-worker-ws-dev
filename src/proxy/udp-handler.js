/**
 * UDP outbound connection handler
 * Manages UDP traffic routing through VLESS outbound proxy
 */

import { WS_READY_STATE_OPEN } from '../config/constants.js';
import { safeCloseWebSocket } from '../utils/websocket.js';
import { vlessOutboundConnect, VLESS_CMD_UDP } from './vless.js';

/**
 * Checks if the current configuration can handle UDP traffic
 * @param {Object} config - Request configuration
 * @returns {boolean} True if UDP can be handled
 */
export function canHandleUDP(config) {
	// VLESS outbound supports UDP natively
	if (config.proxyType === 'vless' && config.parsedVlessOutbound) {
		return true;
	}
	// Native UDP support could be added here in the future
	// if (platformAPI.associate != null) return true;
	return false;
}

/**
 * Handles UDP outbound connections via VLESS proxy
 * @param {WebSocket} webSocket - Client WebSocket connection
 * @param {Uint8Array|null} protocolResponseHeader - VLESS response header
 * @param {number} addressType - Destination address type
 * @param {string} addressRemote - Destination address
 * @param {number} portRemote - Destination port
 * @param {Uint8Array} rawClientData - Raw client data after header
 * @param {Function} log - Logging function
 * @param {Object} config - Request configuration
 * @returns {Promise<WritableStream|null>} Writable stream for subsequent data, or null on failure
 */
export async function handleUDPOutbound(webSocket, protocolResponseHeader, addressType, addressRemote, portRemote, rawClientData, log, config) {
	// Only VLESS outbound supports UDP currently
	if (config.proxyType !== 'vless' || !config.parsedVlessOutbound) {
		log('[UDP] No UDP-capable outbound configured');
		safeCloseWebSocket(webSocket);
		return null;
	}

	log(`[UDP] Establishing VLESS outbound for UDP://${addressRemote}:${portRemote}`);

	// Connect via VLESS outbound
	const vlessResult = await vlessOutboundConnect(config.parsedVlessOutbound, VLESS_CMD_UDP, addressType, addressRemote, portRemote, rawClientData, log);

	if (!vlessResult) {
		log('[UDP] VLESS outbound connection failed');
		safeCloseWebSocket(webSocket);
		return null;
	}

	let headerSent = false;

	// Pipe VLESS readable stream to client WebSocket
	vlessResult.readable
		.pipeTo(
			new WritableStream({
				write(data) {
					if (webSocket.readyState !== WS_READY_STATE_OPEN) {
						return;
					}

					// Add protocol response header to first response
					if (!headerSent && protocolResponseHeader) {
						const combined = new Uint8Array(protocolResponseHeader.length + data.length);
						combined.set(protocolResponseHeader, 0);
						combined.set(data, protocolResponseHeader.length);
						webSocket.send(combined.buffer);
						headerSent = true;
					} else {
						webSocket.send(data);
					}
				},
				close() {
					log('[UDP] VLESS readable stream closed');
					safeCloseWebSocket(webSocket);
				},
				abort(reason) {
					log(`[UDP] VLESS readable stream aborted: ${reason}`);
					safeCloseWebSocket(webSocket);
				},
			})
		)
		.catch((err) => {
			log(`[UDP] VLESS pipe error: ${err.message || err}`);
			safeCloseWebSocket(webSocket);
		});

	log('[UDP] VLESS outbound established successfully');

	// Return the writable stream for subsequent WebSocket messages
	return vlessResult.writable;
}
