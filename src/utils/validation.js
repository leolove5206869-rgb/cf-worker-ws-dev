/**
 * Validation utilities
 */

/**
 * Validates UUID format.
 * Supports UUID versions 1-5 with proper variant checking.
 * @param {string} uuid - UUID string to validate
 * @returns {boolean} True if valid UUID
 */
export function isValidUUID(uuid) {
	const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
	return uuidRegex.test(uuid);
}

/**
 * Validates proxy IP format.
 * Supports domain:port, IPv4:port, and [IPv6]:port formats.
 * @param {string} proxyIP - Proxy IP string to validate
 * @returns {boolean} True if valid format
 */
export function isValidProxyIP(proxyIP) {
	const proxyPattern = /^([a-zA-Z0-9][-a-zA-Z0-9.]*(\.[a-zA-Z0-9][-a-zA-Z0-9.]*)+|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}|\[[0-9a-fA-F:]+\]):\d{1,5}$/;
	return proxyPattern.test(proxyIP);
}

/**
 * Validates SOCKS5 address format.
 * Supports optional authentication (username:password@) prefix.
 * @param {string} socks5 - SOCKS5 address string to validate
 * @returns {boolean} True if valid format
 */
export function isValidSocks5(socks5) {
	const socks5Pattern = /^(([^:@]+:[^:@]+@)?[a-zA-Z0-9][-a-zA-Z0-9.]*(\.[a-zA-Z0-9][-a-zA-Z0-9.]*)+|\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}):\d{1,5}$/;
	return socks5Pattern.test(socks5);
}
