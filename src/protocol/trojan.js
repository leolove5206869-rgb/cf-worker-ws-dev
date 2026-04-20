/**
 * Trojan protocol implementation
 *
 * Header format:
 * [Password SHA224 (56 bytes hex)] [CRLF (2 bytes)] [Cmd (1 byte)] [AddrType (1 byte)] [Addr] [Port (2 bytes)] [CRLF (2 bytes)] [Payload]
 */

import { sha224 } from '../utils/crypto.js';
import { TROJAN_CMD_TCP, TROJAN_CMD_UDP } from '../config/constants.js';

/**
 * Detects if buffer contains Trojan protocol header by checking password hash
 * @param {ArrayBuffer} buffer - Buffer to check
 * @param {string} password - Expected password (plain text)
 * @returns {boolean} True if buffer is valid Trojan protocol
 */
export function isTrojanProtocol(buffer, password) {
	if (buffer.byteLength < 58) {
		return false;
	}
	const bytes = new Uint8Array(buffer);

	// Check for CRLF at position 56-57
	if (bytes[56] !== 0x0d || bytes[57] !== 0x0a) {
		return false;
	}

	// Verify password hash matches
	try {
		const receivedPasswordHash = new TextDecoder().decode(bytes.slice(0, 56));
		const expectedPasswordHash = sha224(password);
		return receivedPasswordHash === expectedPasswordHash;
	} catch {
		return false;
	}
}

/**
 * Processes Trojan protocol header
 * @param {ArrayBuffer} buffer - Buffer containing Trojan header
 * @param {string} password - Expected password (plain text)
 * @returns {{
 *   hasError: boolean,
 *   message?: string,
 *   addressRemote?: string,
 *   addressType?: number,
 *   portRemote?: number,
 *   rawDataIndex?: number,
 *   isUDP?: boolean
 * }} Processed header information
 */
export function processTrojanHeader(buffer, password) {
	if (buffer.byteLength < 58) {
		return { hasError: true, message: 'Invalid Trojan data: too short' };
	}

	const bytes = new Uint8Array(buffer);
	const dataView = new DataView(buffer);

	// Extract password hash from header (first 56 bytes as hex string)
	const receivedPasswordHash = new TextDecoder().decode(bytes.slice(0, 56));

	// Compute expected password hash
	const expectedPasswordHash = sha224(password);

	// Verify password
	if (receivedPasswordHash !== expectedPasswordHash) {
		return { hasError: true, message: 'Invalid Trojan password' };
	}

	// Verify CRLF at bytes 56-57
	if (bytes[56] !== 0x0d || bytes[57] !== 0x0a) {
		return { hasError: true, message: 'Invalid Trojan header: missing CRLF' };
	}

	// Parse command at byte 58
	const command = bytes[58];
	if (command !== TROJAN_CMD_TCP && command !== TROJAN_CMD_UDP) {
		return { hasError: true, message: `Unsupported Trojan command: ${command}` };
	}

	// Parse address type at byte 59
	const addressType = bytes[59];
	let addressValue, addressLength, addressValueIndex;

	switch (addressType) {
		case 1: // IPv4
			addressLength = 4;
			addressValueIndex = 60;
			if (buffer.byteLength < addressValueIndex + addressLength + 2) {
				return { hasError: true, message: 'Invalid Trojan header: IPv4 address truncated' };
			}
			addressValue = Array.from(bytes.slice(addressValueIndex, addressValueIndex + addressLength)).join('.');
			break;
		case 3: // Domain name
			addressLength = bytes[60];
			addressValueIndex = 61;
			if (buffer.byteLength < addressValueIndex + addressLength + 2) {
				return { hasError: true, message: 'Invalid Trojan header: domain name truncated' };
			}
			addressValue = new TextDecoder().decode(bytes.slice(addressValueIndex, addressValueIndex + addressLength));
			break;
		case 4: // IPv6
			addressLength = 16;
			addressValueIndex = 60;
			if (buffer.byteLength < addressValueIndex + addressLength + 2) {
				return { hasError: true, message: 'Invalid Trojan header: IPv6 address truncated' };
			}
			addressValue = Array.from({ length: 8 }, (_, i) =>
				dataView.getUint16(addressValueIndex + i * 2).toString(16)
			).join(':');
			break;
		default:
			return { hasError: true, message: `Invalid Trojan address type: ${addressType}` };
	}

	// Parse port (2 bytes, big-endian, after address)
	const portIndex = addressValueIndex + addressLength;
	if (buffer.byteLength < portIndex + 2) {
		return { hasError: true, message: 'Invalid Trojan header: port truncated' };
	}
	const portRemote = dataView.getUint16(portIndex);

	// Verify second CRLF after port
	const crlfIndex = portIndex + 2;
	if (buffer.byteLength < crlfIndex + 2) {
		return { hasError: true, message: 'Invalid Trojan header: missing final CRLF' };
	}
	if (bytes[crlfIndex] !== 0x0d || bytes[crlfIndex + 1] !== 0x0a) {
		return { hasError: true, message: 'Invalid Trojan header: invalid final CRLF' };
	}

	// Raw data starts after final CRLF
	const rawDataIndex = crlfIndex + 2;

	if (!addressValue) {
		return { hasError: true, message: `Address value is empty, address type is ${addressType}` };
	}

	console.log(`Trojan: target ${addressValue}:${portRemote}, UDP: ${command === TROJAN_CMD_UDP}`);

	return {
		hasError: false,
		addressRemote: addressValue,
		addressType: addressType === 3 ? 2 : addressType, // Map Trojan type 3 (domain) to VLESS type 2
		portRemote,
		rawDataIndex,
		isUDP: command === TROJAN_CMD_UDP
	};
}
