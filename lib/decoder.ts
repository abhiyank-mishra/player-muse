import CryptoJS from 'crypto-js';

const DEFAULT_DES_KEY = '38346591';

export function upgradeQuality(url: string): string {
    if (!url) return url;
    if (url.includes('_96.mp4')) {
        return url.replace('_96.mp4', '_320.mp4');
    }
    if (url.includes('_160.mp4')) {
        return url.replace('_160.mp4', '_320.mp4');
    }
    return url;
}

export function decodeSaavnUrl(encryptedUrl: string): string {
    if (!encryptedUrl) return '';
    try {
        const desKey = process.env.NEXT_PUBLIC_SAAVN_DES_KEY || DEFAULT_DES_KEY;
        const key = CryptoJS.enc.Utf8.parse(desKey);
        const decrypted = CryptoJS.DES.decrypt(
            { ciphertext: CryptoJS.enc.Base64.parse(encryptedUrl) } as CryptoJS.lib.CipherParams,
            key,
            { mode: CryptoJS.mode.ECB, padding: CryptoJS.pad.Pkcs7 }
        );
        let decoded = decrypted.toString(CryptoJS.enc.Utf8);
        if (decoded.startsWith('http:')) {
            decoded = decoded.replace('http:', 'https:');
        }
        return upgradeQuality(decoded);
    } catch (e) {
        console.error('[Decoder] Error decrypting media URL:', e);
        return '';
    }
}
