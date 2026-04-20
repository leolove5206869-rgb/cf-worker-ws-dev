/**
 * Stream processing for WebSocket-Socket bridge
 */

import { WS_READY_STATE_OPEN } from '../config/constants.js';
import { base64ToArrayBuffer } from '../utils/encoding.js';
import { safeCloseWebSocket } from '../utils/websocket.js';

/**
 * Creates a readable stream from WebSocket server.
 * Handles early data (0-RTT) and WebSocket messages.
 * @param {WebSocket} webSocketServer - WebSocket server instance
 * @param {string} earlyDataHeader - Header for early data (0-RTT)
 * @param {Function} log - Logging function
 * @returns {ReadableStream} Stream of WebSocket data
 */
export function makeReadableWebSocketStream(webSocketServer, earlyDataHeader, log) {
	let readableStreamCancel = false;
	const stream = new ReadableStream({
		start(controller) {
			webSocketServer.addEventListener('message', (event) => {
				if (readableStreamCancel) return;
				controller.enqueue(event.data);
			});

			webSocketServer.addEventListener('close', (event) => {
				log(`readableWebSocketStream is close (code: ${event.code})`);
				if (readableStreamCancel) return;
				safeCloseWebSocket(webSocketServer);
				controller.close();
			});

			webSocketServer.addEventListener('error', (err) => {
				log(`webSocketServer has error: ${err?.message || 'unknown'}`);
				controller.error(err);
			});
			const { earlyData, error } = base64ToArrayBuffer(earlyDataHeader);
			if (error) {
				controller.error(error);
			} else if (earlyData) {
				controller.enqueue(earlyData);
			}
		},

		pull(_controller) {
			// if ws can stop read if stream is full, we can implement backpressure
			// https://streams.spec.whatwg.org/#example-rs-push-backpressure
		},

		cancel(reason) {
			log(`ReadableStream was canceled, due to ${reason}`);
			readableStreamCancel = true;
			safeCloseWebSocket(webSocketServer);
		}
	});

	return stream;
}

/**
 * Converts remote socket connection to WebSocket.
 * Handles bidirectional data transfer between socket and WebSocket.
 * @param {import("@cloudflare/workers-types").Socket} remoteSocket - Remote socket connection
 * @param {WebSocket} webSocket - WebSocket connection
 * @param {ArrayBuffer|null} protocolResponseHeader - Protocol response header
 * @param {Function|null} retry - Retry function for failed connections
 * @param {Function} log - Logging function
 */
export async function remoteSocketToWS(remoteSocket, webSocket, protocolResponseHeader, retry, log) {
	log(`[remoteSocketToWS] Starting, remoteSocket.readable=${!!remoteSocket?.readable}`);
	let hasIncomingData = false;

	try {
		log(`[remoteSocketToWS] Starting pipeTo...`);
		await remoteSocket.readable.pipeTo(
			new WritableStream({
				async write(chunk) {
					log(`[remoteSocketToWS] Received chunk, size=${chunk?.byteLength || chunk?.length || 0}`);
					if (webSocket.readyState !== WS_READY_STATE_OPEN) {
						log(`[remoteSocketToWS] WebSocket not open, readyState=${webSocket.readyState}`);
						throw new Error('WebSocket is not open');
					}

					hasIncomingData = true;

					if (protocolResponseHeader) {
						const header = new Uint8Array(protocolResponseHeader);
						const data = new Uint8Array(chunk);
						const combined = new Uint8Array(header.length + data.length);
						combined.set(header, 0);
						combined.set(data, header.length);
						log(`[remoteSocketToWS] Sending first chunk with header, total size=${combined.length}`);
						webSocket.send(combined.buffer);
						protocolResponseHeader = null;
					} else {
						log(`[remoteSocketToWS] Sending chunk to WebSocket`);
						webSocket.send(chunk);
					}
				},
				close() {
					log(`[remoteSocketToWS] Remote connection readable closed. Had incoming data: ${hasIncomingData}`);
				},
				abort(reason) {
					log(`[remoteSocketToWS] Remote connection readable aborted: ${reason}`);
					console.error(`Remote connection readable aborted:`, reason);
				},
			})
		);
		log(`[remoteSocketToWS] pipeTo completed normally`);
	} catch (error) {
		log(`[remoteSocketToWS] pipeTo error: ${error.message}`);
		console.error(`remoteSocketToWS error:`, error.stack || error);
		safeCloseWebSocket(webSocket);
	}

	if (!hasIncomingData && retry) {
		log(`[remoteSocketToWS] No incoming data, retrying`);
		await retry();
	}
}
