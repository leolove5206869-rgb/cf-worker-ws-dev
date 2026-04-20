/**
 * DNS query handling over TCP
 */

import { WS_READY_STATE_OPEN } from '../config/constants.js';

/**
 * Handles DNS query through TCP.
 * Forwards DNS requests to a configured DNS server.
 * @param {ArrayBuffer} udpChunk - UDP data chunk containing DNS query
 * @param {WebSocket} webSocket - WebSocket connection to send response
 * @param {ArrayBuffer|null} protocolResponseHeader - Protocol response header (VLESS)
 * @param {Function} log - Logging function
 * @param {Function} connect - Cloudflare socket connect function
 */
export async function handleDNSQuery(udpChunk, webSocket, protocolResponseHeader, log, connect) {
	// Always use hardcoded DNS server regardless of client request
	// Some DNS servers don't support DNS over TCP
	try {
		const dnsServer = '8.8.4.4'; // change to 1.1.1.1 after cf fix connect own ip bug
		const dnsPort = 53;
		/** @type {ArrayBuffer | null} */
		let vlessHeader = protocolResponseHeader;
		/** @type {import("@cloudflare/workers-types").Socket} */
		const tcpSocket = connect({
			hostname: dnsServer,
			port: dnsPort,
		});

		log(`connected to ${dnsServer}:${dnsPort}`);
		const writer = tcpSocket.writable.getWriter();
		await writer.write(udpChunk);
		writer.releaseLock();
		await tcpSocket.readable.pipeTo(new WritableStream({
			async write(chunk) {
				if (webSocket.readyState === WS_READY_STATE_OPEN) {
					if (vlessHeader) {
						webSocket.send(await new Blob([vlessHeader, chunk]).arrayBuffer());
						vlessHeader = null;
					} else {
						webSocket.send(chunk);
					}
				}
			},
			close() {
				log(`dns server(${dnsServer}) tcp is close`);
			},
			abort(reason) {
				console.error(`dns server(${dnsServer}) tcp is abort`, reason);
			},
		}));
	} catch (error) {
		console.error(
			`handleDNSQuery have exception, error: ${error.message}`
		);
	}
}
