/**
 * WebSocket ready state constants
 */
export const WS_READY_STATE_OPEN = 1;
export const WS_READY_STATE_CLOSING = 2;

/**
 * HTTP and HTTPS port sets for subscription generation
 */
export const HttpPort = new Set([80, 8080, 8880, 2052, 2086, 2095, 2082]);
export const HttpsPort = new Set([443, 8443, 2053, 2096, 2087, 2083]);

/**
 * Byte to hex lookup table for UUID conversion
 */
export const byteToHex = Array.from({ length: 256 }, (_, i) => (i + 0x100).toString(16).slice(1));

/**
 * Base64 encoded strings for protocol configuration
 */
export const at = 'QA==';
export const pt = 'dmxlc3M=';
export const ed = 'RUR0dW5uZWw=';

/**
 * Trojan protocol constants
 */
export const trojanPt = 'dHJvamFu'; // 'trojan' in base64
export const TROJAN_CMD_TCP = 0x01;
export const TROJAN_CMD_UDP = 0x03;

/**
 * VLESS protocol command types
 */
export const VLESS_CMD_TCP = 0x01;
export const VLESS_CMD_UDP = 0x02;

/**
 * VLESS protocol address types
 */
export const VLESS_ADDR_IPV4 = 1;
export const VLESS_ADDR_DOMAIN = 2;
export const VLESS_ADDR_IPV6 = 3;

/**
 * Default VLESS outbound connection timeout in milliseconds
 */
export const VLESS_OUTBOUND_TIMEOUT = 10000;
