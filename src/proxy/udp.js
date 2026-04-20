/**
 * UDP stream processing utilities
 * Handles UDP datagram framing for VLESS protocol
 */

/**
 * Joins two Uint8Arrays into a single array
 * @param {Uint8Array} arr1 - First array
 * @param {Uint8Array} arr2 - Second array
 * @returns {Uint8Array} Combined array
 */
export function joinUint8Array(arr1, arr2) {
	const result = new Uint8Array(arr1.length + arr2.length);
	result.set(arr1, 0);
	result.set(arr2, arr1.length);
	return result;
}

/**
 * Creates a readable stream that wraps UDP datagrams with length prefix
 * Each datagram is prepended with a 16-bit big-endian length field
 * @param {Object} udpClient - UDP client with onmessage and onerror handlers
 * @param {Function} log - Logging function
 * @returns {ReadableStream}
 */
export function makeReadableUDPStream(udpClient, log) {
	return new ReadableStream({
		start(controller) {
			udpClient.onmessage((message, info) => {
				// Prepend 16-bit big-endian length header
				const header = new Uint8Array([(info.size >> 8) & 0xff, info.size & 0xff]);
				const encodedChunk = joinUint8Array(header, message);
				controller.enqueue(encodedChunk);
			});

			udpClient.onerror((error) => {
				log(`[UDP] Socket error: ${error.message || error}`);
				controller.error(error);
			});
		},
		cancel(reason) {
			log(`[UDP] ReadableStream canceled: ${reason}`);
			try {
				udpClient.close();
			} catch (e) {
				// Ignore close errors
			}
		},
	});
}

/**
 * Creates a writable stream that unpacks length-prefixed UDP datagrams
 * @param {Object} udpClient - UDP client with send method
 * @param {string} addressRemote - Remote address
 * @param {number} portRemote - Remote port
 * @param {Function} log - Logging function
 * @returns {WritableStream}
 */
export function makeWritableUDPStream(udpClient, addressRemote, portRemote, log) {
	let leftoverData = new Uint8Array(0);

	return new WritableStream({
		write(chunk, controller) {
			let byteArray = new Uint8Array(chunk);

			// Merge with leftover data from previous chunk
			if (leftoverData.length > 0) {
				byteArray = joinUint8Array(leftoverData, byteArray);
				leftoverData = new Uint8Array(0);
			}

			let offset = 0;
			while (offset < byteArray.length) {
				// Need at least 2 bytes for length field
				if (offset + 1 >= byteArray.length) {
					leftoverData = byteArray.slice(offset);
					break;
				}

				// Read 16-bit big-endian length
				const datagramLen = (byteArray[offset] << 8) | byteArray[offset + 1];

				// Check if we have the complete datagram
				if (offset + 2 + datagramLen > byteArray.length) {
					leftoverData = byteArray.slice(offset);
					break;
				}

				// Extract and send the datagram
				const datagram = byteArray.slice(offset + 2, offset + 2 + datagramLen);
				udpClient.send(datagram, 0, datagramLen, portRemote, addressRemote, (err) => {
					if (err) {
						log(`[UDP] Send error: ${err.message || err}`);
						controller.error(err);
					}
				});

				offset += 2 + datagramLen;
			}
		},
		close() {
			log('[UDP] WritableStream closed');
		},
		abort(reason) {
			log(`[UDP] WritableStream aborted: ${reason}`);
		},
	});
}

/**
 * Safely closes a UDP socket
 * @param {Object} socket - UDP socket
 */
export function safeCloseUDP(socket) {
	try {
		if (socket && typeof socket.close === 'function') {
			socket.close();
		}
	} catch (error) {
		console.error('[UDP] Safe close error:', error);
	}
}
