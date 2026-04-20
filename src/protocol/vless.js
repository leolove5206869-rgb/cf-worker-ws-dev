/**
 * VLESS protocol implementation
 */

import { stringify } from '../utils/encoding.js';

/**
 * Processes VLESS protocol header.
 * Extracts and validates protocol information from buffer.
 * @param {ArrayBuffer} protocolBuffer - Buffer containing protocol header
 * @param {string} userID - User ID for validation (supports comma-separated multiple UUIDs)
 * @returns {{
 *   hasError: boolean,
 *   message?: string,
 *   addressRemote?: string,
 *   addressType?: number,
 *   portRemote?: number,
 *   rawDataIndex?: number,
 *   protocolVersion?: Uint8Array,
 *   isUDP?: boolean
 * }} Processed header information
 */
export function processProtocolHeader(protocolBuffer, userID) {
	if (protocolBuffer.byteLength < 24) {
		return { hasError: true, message: 'invalid data' };
	}

	const dataView = new DataView(protocolBuffer);
	const version = dataView.getUint8(0);
	const slicedBufferString = stringify(new Uint8Array(protocolBuffer.slice(1, 17)));

	const uuids = userID.includes(',') ? userID.split(",") : [userID];
	const isValidUser = uuids.some(uuid => slicedBufferString === uuid.trim()) ||
		(uuids.length === 1 && slicedBufferString === uuids[0].trim());

	console.log(`userID: ${slicedBufferString}`);

	if (!isValidUser) {
		return { hasError: true, message: 'invalid user' };
	}

	const optLength = dataView.getUint8(17);
	const command = dataView.getUint8(18 + optLength);

	if (command !== 1 && command !== 2) {
		return { hasError: true, message: `command ${command} is not supported, command 01-tcp,02-udp,03-mux` };
	}

	const portIndex = 18 + optLength + 1;
	const portRemote = dataView.getUint16(portIndex);
	const addressType = dataView.getUint8(portIndex + 2);
	let addressValue, addressLength, addressValueIndex;

	switch (addressType) {
		case 1: // IPv4
			addressLength = 4;
			addressValueIndex = portIndex + 3;
			addressValue = new Uint8Array(protocolBuffer.slice(addressValueIndex, addressValueIndex + addressLength)).join('.');
			break;
		case 2: // Domain
			addressLength = dataView.getUint8(portIndex + 3);
			addressValueIndex = portIndex + 4;
			addressValue = new TextDecoder().decode(protocolBuffer.slice(addressValueIndex, addressValueIndex + addressLength));
			break;
		case 3: // IPv6
			addressLength = 16;
			addressValueIndex = portIndex + 3;
			addressValue = Array.from({ length: 8 }, (_, i) => dataView.getUint16(addressValueIndex + i * 2).toString(16)).join(':');
			break;
		default:
			return { hasError: true, message: `invalid addressType: ${addressType}` };
	}

	if (!addressValue) {
		return { hasError: true, message: `addressValue is empty, addressType is ${addressType}` };
	}

	return {
		hasError: false,
		addressRemote: addressValue,
		addressType,
		portRemote,
		rawDataIndex: addressValueIndex + addressLength,
		protocolVersion: new Uint8Array([version]),
		isUDP: command === 2
	};
}
