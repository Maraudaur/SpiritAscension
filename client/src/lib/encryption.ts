import AES from "crypto-js/aes";
import Utf8 from "crypto-js/enc-utf8";

// WARNING: This key is visible in your game's code.
// It only stops casual cheating, not determined attackers.
const secretKey = "xlHwKQumyqU2V@gz0xvx%lw4Pgg3eb";

/**
 * Encrypts a plain text string.
 */
export const encrypt = (text: string): string => {
  return AES.encrypt(text, secretKey).toString();
};

/**
 * Decrypts a ciphertext string.
 * Throws an error if decryption fails.
 */
export const decrypt = (ciphertext: string): string => {
  const bytes = AES.decrypt(ciphertext, secretKey);
  const originalText = bytes.toString(Utf8);

  // Check if decryption was successful
  if (!originalText) {
    throw new Error("Decryption failed: Invalid key or malformed data.");
  }

  return originalText;
};
