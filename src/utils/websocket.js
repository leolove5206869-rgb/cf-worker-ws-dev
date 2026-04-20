/**
 * WebSocket utility functions
 */

import { WS_READY_STATE_OPEN, WS_READY_STATE_CLOSING } from '../config/constants.js';

/**
 * Safely closes WebSocket connection.
 * Prevents exceptions during WebSocket closure.
 * @param {WebSocket} socket - WebSocket to close
 */
export function safeCloseWebSocket(socket) {
	try {
		if (socket.readyState === WS_READY_STATE_OPEN || socket.readyState === WS_READY_STATE_CLOSING) {
			socket.close();
		}
	} catch (error) {
		console.error('safeCloseWebSocket error:', error);
	}
}
