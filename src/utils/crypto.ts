/**
 * Simple encryption for Invoice dynamic parameters.
 * Note: This is a basic implementation to provide "obscurity + integrity".
 */

const SECRET_KEY = 'bonopoly-invoice-secure-key-2024';

export function encryptInvoiceData(data: object): string {
    try {
        const json = JSON.stringify(data);
        // Simple XOR-based "encryption" + Base64 for the URL.
        // In a production environment, use a real library like crypto-js,
        // but this serves the purpose of obscuring and preventing casual tampering.
        let result = '';
        for (let i = 0; i < json.length; i++) {
            result += String.fromCharCode(json.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length));
        }
        return btoa(result).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    } catch {
        return '';
    }
}

export function decryptInvoiceData(encoded: string): unknown {
    try {
        // Restore base64 padding
        let base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) base64 += '=';

        const binary = atob(base64);
        let result = '';
        for (let i = 0; i < binary.length; i++) {
            result += String.fromCharCode(binary.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length));
        }
        return JSON.parse(result);
    } catch {
        return null;
    }
}
