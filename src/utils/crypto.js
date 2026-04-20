/**
 * Cryptographic utilities for Trojan protocol
 * SHA224 implementation based on cmliu/edgetunnel
 */

/**
 * Computes SHA224 hash of a string
 * @param {string} str - String to hash
 * @returns {string} Hex-encoded SHA224 hash (56 characters)
 */
export function sha224(str) {
	function rightRotate(value, amount) {
		return (value >>> amount) | (value << (32 - amount));
	}

	const mathPow = Math.pow;
	const maxWord = mathPow(2, 32);
	let result = '';

	const words = [];
	const asciiBitLength = str.length * 8;

	// Initial hash values - SHA224 specific (first 32 bits of the fractional parts of square roots of 9th through 16th primes)
	let hash = [
		0xc1059ed8, 0x367cd507, 0x3070dd17, 0xf70e5939,
		0xffc00b31, 0x68581511, 0x64f98fa7, 0xbefa4fa4
	];

	// Round constants (first 32 bits of the fractional parts of cube roots of first 64 primes)
	const k = [
		0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
		0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
		0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
		0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
		0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
		0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
		0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
		0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
	];

	// Pre-processing: add padding bits
	let i, j;
	str += '\x80'; // Append '1' bit (plus zero padding)
	while (str.length % 64 - 56) str += '\x00'; // More zero padding

	for (i = 0; i < str.length; i++) {
		j = str.charCodeAt(i);
		if (j >> 8) return; // ASCII check
		words[i >> 2] |= j << ((3 - i) % 4) * 8;
	}
	words[words.length] = ((asciiBitLength / maxWord) | 0);
	words[words.length] = (asciiBitLength);

	// Process each chunk
	for (j = 0; j < words.length;) {
		const w = words.slice(j, j += 16);
		const oldHash = hash.slice(0);

		for (i = 0; i < 64; i++) {
			// Expand the message schedule
			if (i >= 16) {
				const w15 = w[i - 15], w2 = w[i - 2];
				w[i] = (
					w[i - 16] +
					(rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
					w[i - 7] +
					(rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))
				) | 0;
			}

			// Compression function main loop
			const a = hash[0], e = hash[4];
			const temp1 = (
				hash[7] +
				(rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
				((e & hash[5]) ^ (~e & hash[6])) +
				k[i] +
				w[i]
			);
			const temp2 = (
				(rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
				((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]))
			);

			hash = [(temp1 + temp2) | 0].concat(hash);
			hash[4] = (hash[4] + temp1) | 0;
			hash.pop();
		}

		for (i = 0; i < 8; i++) {
			hash[i] = (hash[i] + oldHash[i]) | 0;
		}
	}

	// Produce the final hash value (SHA224 uses only first 7 words = 224 bits)
	for (i = 0; i < 7; i++) {
		const hex = hash[i];
		result += ((hex >> 28) & 0xf).toString(16) +
			((hex >> 24) & 0xf).toString(16) +
			((hex >> 20) & 0xf).toString(16) +
			((hex >> 16) & 0xf).toString(16) +
			((hex >> 12) & 0xf).toString(16) +
			((hex >> 8) & 0xf).toString(16) +
			((hex >> 4) & 0xf).toString(16) +
			(hex & 0xf).toString(16);
	}

	return result;
}

/**
 * Computes SHA224 hash of password for Trojan protocol
 * @param {string} password - Password to hash
 * @returns {string} 56-character hex string
 */
export function hashTrojanPassword(password) {
	return sha224(password);
}
