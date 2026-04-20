/**
 * EDtunnel - A Cloudflare Worker-based VLESS Proxy with WebSocket Transport
 *
 * This is the main entry point for the Cloudflare Worker.
 * The application is modularized into the following structure:
 *
 * - config/     : Configuration constants and defaults
 * - handlers/   : Request handlers (main, websocket, http)
 * - protocol/   : Protocol implementations (VLESS, DNS)
 * - proxy/      : Proxy implementations (SOCKS5, TCP, stream)
 * - generators/ : Configuration and subscription generators
 * - utils/      : Utility functions (encoding, validation, parser, websocket)
 */

// @ts-ignore
import { connect } from 'cloudflare:sockets';
import { handleRequest } from './handlers/main.js';

export default {
	/**
	 * Main fetch handler for Cloudflare Worker
	 * @param {import("@cloudflare/workers-types").Request} request - The incoming request
	 * @param {{UUID: string, PROXYIP: string, SOCKS5: string, SOCKS5_RELAY: string}} env - Environment variables
	 * @param {import("@cloudflare/workers-types").ExecutionContext} ctx - Execution context
	 * @returns {Promise<Response>} Response object
	 */
	async fetch(request, env, ctx) {
		return handleRequest(request, env, ctx, connect);
	}
};
