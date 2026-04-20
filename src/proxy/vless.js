/**
 * VLESS outbound proxy implementation
 * Connects to a remote VLESS server via WebSocket
 */

import { WS_READY_STATE_OPEN } from '../config/constants.js';
import { safeCloseWebSocket } from '../utils/websocket.js';

/**
 * VLESS command types
 */
export const VLESS_CMD_TCP = 0x01;
export const VLESS_CMD_UDP = 0x02;

/**
 * VLESS address types
 */
export const VLESS_ADDR_IPV4 = 1;
export const VLESS_ADDR_DOMAIN = 2;
export const VLESS_ADDR_IPV6 = 3;

/**
 * Default VLESS outbound connection timeout in milliseconds
 */
export const VLESS_OUTBOUND_TIMEOUT = 10000;

/**
 * Generates a VLESS request header
 * @param {number} command - Command type (1=TCP, 2=UDP)
 * @param {number} addressType - Address type (1=IPv4, 2=Domain, 3=IPv6)
 * @param {string} addressRemote - Remote address
 * @param {number} portRemote - Remote port
 * @param {string} uuid - UUID for authentication
 * @returns {Uint8Array} VLESS request header
 */
export function makeVlessRequestHeader(command, addressType, addressRemote, portRemote, uuid) {
	let addressFieldLength;
	let addressEncoded;

	switch (addressType) {
		case VLESS_ADDR_IPV4:
			addressFieldLength = 4;
			break;
		case VLESS_ADDR_DOMAIN:
			addressEncoded = new TextEncoder().encode(addressRemote);
			addressFieldLength = addressEncoded.length + 1;
			break;
		case VLESS_ADDR_IPV6:
			addressFieldLength = 16;
			break;
		default:
			throw new Error(`Unknown address type: ${addressType}`);
	}

	const uuidString = uuid.replace(/-/g, '');
	const vlessHeader = new Uint8Array(22 + addressFieldLength);

	// Protocol Version = 0
	vlessHeader[0] = 0x00;

	// UUID (16 bytes)
	for (let i = 0; i < uuidString.length; i += 2) {
		vlessHeader[1 + i / 2] = parseInt(uuidString.substr(i, 2), 16);
	}

	// Additional Information Length = 0
	vlessHeader[17] = 0x00;

	// Command
	vlessHeader[18] = command;

	// Port (2-byte big-endian)
	vlessHeader[19] = portRemote >> 8;
	vlessHeader[20] = portRemote & 0xff;

	// Address Type
	vlessHeader[21] = addressType;

	// Address
	switch (addressType) {
		case VLESS_ADDR_IPV4:
			const octets = addressRemote.split('.');
			for (let i = 0; i < 4; i++) {
				vlessHeader[22 + i] = parseInt(octets[i]);
			}
			break;
		case VLESS_ADDR_DOMAIN:
			vlessHeader[22] = addressEncoded.length;
			vlessHeader.set(addressEncoded, 23);
			break;
		case VLESS_ADDR_IPV6:
			// Handle both full and compressed IPv6 formats
			const fullIPv6 = expandIPv6(addressRemote);
			const groups = fullIPv6.split(':');
			for (let i = 0; i < 8; i++) {
				const hexGroup = parseInt(groups[i], 16);
				vlessHeader[22 + i * 2] = hexGroup >> 8;
				vlessHeader[23 + i * 2] = hexGroup & 0xff;
			}
			break;
	}

	return vlessHeader;
}

/**
 * Expands a compressed IPv6 address to full format
 * @param {string} ipv6 - IPv6 address (may be compressed)
 * @returns {string} Full IPv6 address
 */
function expandIPv6(ipv6) {
	// Remove brackets if present
	ipv6 = ipv6.replace(/^\[|\]$/g, '');

	// Handle :: compression
	if (ipv6.includes('::')) {
		const parts = ipv6.split('::');
		const left = parts[0] ? parts[0].split(':') : [];
		const right = parts[1] ? parts[1].split(':') : [];
		const missing = 8 - left.length - right.length;
		const middle = Array(missing).fill('0');
		return [...left, ...middle, ...right].map((g) => g.padStart(4, '0')).join(':');
	}

	return ipv6
		.split(':')
		.map((g) => g.padStart(4, '0'))
		.join(':');
}

/**
 * Validates VLESS outbound configuration
 * @param {string} address - Server address
 * @param {Object} streamSettings - Stream settings
 * @throws {Error} If configuration is invalid
 */
function validateVlessConfig(address, streamSettings) {
	if (streamSettings.network !== 'ws') {
		throw new Error(`Unsupported network type: ${streamSettings.network}, must be 'ws'`);
	}
	if (streamSettings.security !== 'tls' && streamSettings.security !== 'none' && streamSettings.security !== '') {
		throw new Error(`Unsupported security: ${streamSettings.security}, must be 'tls' or 'none'`);
	}
}

/**
 * Establishes VLESS outbound connection via WebSocket
 * @param {Object} config - VLESS outbound configuration
 * @param {string} config.address - VLESS server address
 * @param {number} config.port - VLESS server port
 * @param {string} config.uuid - VLESS UUID for authentication
 * @param {Object} config.streamSettings - Stream settings
 * @param {number} command - Command type (TCP/UDP)
 * @param {number} addressType - Destination address type
 * @param {string} addressRemote - Destination address
 * @param {number} portRemote - Destination port
 * @param {Uint8Array} rawClientData - Initial client data
 * @param {Function} log - Logging function
 * @param {number} [timeout=10000] - Connection timeout in ms
 * @returns {Promise<{readable: ReadableStream, writable: WritableStream, closed: Promise<void>}|null>}
 */
export async function vlessOutboundConnect(config, command, addressType, addressRemote, portRemote, rawClientData, log, timeout = VLESS_OUTBOUND_TIMEOUT) {
	try {
		validateVlessConfig(config.address, config.streamSettings);
	} catch (err) {
		log(`[VLESS] Config validation failed: ${err.message}`);
		return null;
	}

	// Build WebSocket URL
	const security = config.streamSettings.security || 'none';
	let wsURL = security === 'tls' ? 'wss://' : 'ws://';
	wsURL += `${config.address}:${config.port}`;
	if (config.streamSettings.wsSettings?.path) {
		wsURL += config.streamSettings.wsSettings.path;
	}

	const protocol = command === VLESS_CMD_UDP ? 'UDP' : 'TCP';
	log(`[VLESS] Connecting to ${wsURL} for ${protocol}://${addressRemote}:${portRemote}`);

	// Create WebSocket connection
	log(`[VLESS] Creating WebSocket to ${wsURL}...`);
	let ws;
	try {
		ws = new WebSocket(wsURL);
		log(`[VLESS] WebSocket object created, readyState: ${ws.readyState}`);
	} catch (err) {
		log(`[VLESS] Failed to create WebSocket: ${err.message}`);
		return null;
	}

	// Create a Promise that resolves when the WebSocket closes
	let closedResolve;
	const closedPromise = new Promise((resolve) => {
		closedResolve = resolve;
	});

	// Wait for connection to open
	log(`[VLESS] Waiting for WebSocket to open (timeout: ${timeout}ms)...`);
	try {
		await new Promise((resolve, reject) => {
			const timeoutId = setTimeout(() => {
				log(`[VLESS] Connection timeout after ${timeout}ms`);
				reject(new Error('Connection timeout'));
			}, timeout);

			ws.addEventListener('open', () => {
				log(`[VLESS] WebSocket open event received`);
				clearTimeout(timeoutId);
				resolve();
			});

			ws.addEventListener('close', (event) => {
				log(`[VLESS] WebSocket close event during connect (code: ${event.code})`);
				clearTimeout(timeoutId);
				reject(new Error(`WebSocket closed with code ${event.code}`));
			});

			ws.addEventListener('error', (err) => {
				log(`[VLESS] WebSocket error event during connect: ${err?.message || 'unknown'}`);
				clearTimeout(timeoutId);
				reject(new Error('WebSocket connection error'));
			});
		});
	} catch (err) {
		log(`[VLESS] Connection failed: ${err.message}`);
		try {
			ws.close();
		} catch (e) {
			// Ignore close errors
		}
		closedResolve();
		return null;
	}

	log('[VLESS] Connection promise resolved, setting up handlers...');

	try {
		// Set up close handler to resolve the closed Promise
		ws.addEventListener('close', (event) => {
			log(`[VLESS] WebSocket connection closed (code: ${event.code}, reason: ${event.reason || 'none'})`);
			closedResolve();
		});

		ws.addEventListener('error', () => {
			log(`[VLESS] WebSocket error event`);
		});

		log('[VLESS] Creating writable stream...');
		// Create writable stream for sending data to VLESS server
		/** @type {WritableStream<Uint8Array>} */
		const writableStream = new WritableStream({
			write(chunk) {
				if (ws.readyState === WS_READY_STATE_OPEN) {
					ws.send(chunk);
				}
			},
			close() {
				log('[VLESS] Writable stream closed');
				safeCloseWebSocket(ws);
			},
			abort(reason) {
				log(`[VLESS] Writable stream aborted: ${reason}`);
				safeCloseWebSocket(ws);
			},
		});

		log('[VLESS] Writable stream created');

		// Create readable stream with VLESS response header stripping
		let headerStripped = false;
		log('[VLESS] Creating readable stream with message handlers...');
		const readableStream = new ReadableStream({
			start(controller) {
				log('[VLESS] ReadableStream start called, adding message listener');
				ws.addEventListener('message', (event) => {
					log(`[VLESS] Message received from VLESS server, size=${event.data?.byteLength || 'unknown'}`);
					let data = new Uint8Array(event.data);

					// Strip VLESS response header on first message
					// Format: [version (1 byte)] [additional info length (1 byte)] [additional info (N bytes)]
					if (!headerStripped) {
						headerStripped = true;
						log(`[VLESS] First message - stripping header. Raw length=${data.length}, first bytes: ${data.slice(0, Math.min(10, data.length)).join(',')}`);
						if (data.length >= 2) {
							const additionalBytes = data[1];
							log(`[VLESS] Additional info bytes: ${additionalBytes}`);
							if (data.length > 2 + additionalBytes) {
								data = data.slice(2 + additionalBytes);
								log(`[VLESS] After header strip, data length=${data.length}`);
							} else {
								// Response header only, no data
								log('[VLESS] Response header only, no payload data');
								return;
							}
						}
					}

					if (data.length > 0) {
						log(`[VLESS] Enqueueing ${data.length} bytes to readable stream`);
						controller.enqueue(data);
					}
				});

				ws.addEventListener('close', () => {
					log('[VLESS] ReadableStream: WebSocket close event');
					try {
						controller.close();
					} catch (e) {
						// Controller may already be closed
					}
				});

				ws.addEventListener('error', (err) => {
					log(`[VLESS] ReadableStream: WebSocket error event: ${err?.message || 'unknown'}`);
					try {
						controller.error(err);
					} catch (e) {
						// Controller may already be errored
					}
				});
				log('[VLESS] ReadableStream message handlers registered');
			},
			cancel() {
				safeCloseWebSocket(ws);
			},
		});

		log('[VLESS] Readable stream created');
		log('[VLESS] Streams created, generating request header...');

		// Generate and send VLESS request header + initial data
		log(`[VLESS] Generating header for command=${command}, addressType=${addressType}, address=${addressRemote}, port=${portRemote}`);
		const vlessHeader = makeVlessRequestHeader(command, addressType, addressRemote, portRemote, config.uuid);

		// Ensure rawClientData is a Uint8Array (it might be ArrayBuffer)
		let clientData;
		if (rawClientData instanceof ArrayBuffer) {
			clientData = new Uint8Array(rawClientData);
		} else if (rawClientData instanceof Uint8Array) {
			clientData = rawClientData;
		} else if (rawClientData && rawClientData.buffer instanceof ArrayBuffer) {
			// It's already a typed array view
			clientData = new Uint8Array(rawClientData.buffer, rawClientData.byteOffset, rawClientData.byteLength);
		} else {
			// Fallback: try to create from whatever we have
			clientData = new Uint8Array(rawClientData || 0);
		}

		log(`[VLESS] Header generated, length=${vlessHeader.length}, clientData length=${clientData.length}`);

		const firstPacket = new Uint8Array(vlessHeader.length + clientData.length);
		firstPacket.set(vlessHeader, 0);
		firstPacket.set(clientData, vlessHeader.length);

		log(`[VLESS] Sending first packet, total length=${firstPacket.length}, ws.readyState=${ws.readyState}`);
		ws.send(firstPacket);
		log('[VLESS] Sent request header with initial data');

		log('[VLESS] Returning streams and closed promise');
		return { readable: readableStream, writable: writableStream, closed: closedPromise };
	} catch (err) {
		log(`[VLESS] Error after connection opened: ${err.message}`);
		log(`[VLESS] Error stack: ${err.stack}`);
		safeCloseWebSocket(ws);
		closedResolve();
		return null;
	}
}
