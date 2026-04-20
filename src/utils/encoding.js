/**
 * Encoding utilities for Base64 and UUID conversion
 */

import { byteToHex } from '../config/constants.js';
import { isValidUUID } from './validation.js';

/**
 * Converts base64 string to ArrayBuffer.
 * Handles URL-safe Base64 (RFC 4648) conversion.
 * @param {string} base64Str - Base64 encoded string
 * @returns {{earlyData: ArrayBuffer|null, error: Error|null}} Object containing decoded data or error
 */
export function base64ToArrayBuffer(base64Str) {
	if (!base64Str) {
		return { earlyData: null, error: null };
	}
	try {
		// Convert modified Base64 for URL (RFC 4648) to standard Base64
		base64Str = base64Str.replace(/-/g, '+').replace(/_/g, '/');
		// Decode Base64 string
		const binaryStr = atob(base64Str);
		// Convert binary string to ArrayBuffer
		const buffer = new ArrayBuffer(binaryStr.length);
		const view = new Uint8Array(buffer);
		for (let i = 0; i < binaryStr.length; i++) {
			view[i] = binaryStr.charCodeAt(i);
		}
		return { earlyData: buffer, error: null };
	} catch (error) {
		return { earlyData: null, error };
	}
}

/**
 * Converts byte array to hex string without validation.
 * @param {Uint8Array} arr - Byte array to convert
 * @param {number} offset - Starting offset
 * @returns {string} Hex string in UUID format
 */
export function unsafeStringify(arr, offset = 0) {
	return [
		byteToHex[arr[offset]],
		byteToHex[arr[offset + 1]],
		byteToHex[arr[offset + 2]],
		byteToHex[arr[offset + 3]],
		'-',
		byteToHex[arr[offset + 4]],
		byteToHex[arr[offset + 5]],
		'-',
		byteToHex[arr[offset + 6]],
		byteToHex[arr[offset + 7]],
		'-',
		byteToHex[arr[offset + 8]],
		byteToHex[arr[offset + 9]],
		'-',
		byteToHex[arr[offset + 10]],
		byteToHex[arr[offset + 11]],
		byteToHex[arr[offset + 12]],
		byteToHex[arr[offset + 13]],
		byteToHex[arr[offset + 14]],
		byteToHex[arr[offset + 15]]
	].join('').toLowerCase();
}

/**
 * Safely converts byte array to hex string with validation.
 * @param {Uint8Array} arr - Byte array to convert
 * @param {number} offset - Starting offset
 * @returns {string} Hex string in UUID format
 * @throws {TypeError} If the stringified UUID is invalid
 */
export function stringify(arr, offset = 0) {
	const uuid = unsafeStringify(arr, offset);
	if (!isValidUUID(uuid)) {
		throw new TypeError("Stringified UUID is invalid");
	}
	return uuid;
}
