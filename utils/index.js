/**
 * NEM utils set
 * 
 * @module Chronobank/utils
 * 
 * Copyright 2017–2018, LaborX PTY
 * Licensed under the AGPL Version 3 license.
 * @author Kirill Sergeev <cloudkserg11@gmail.com>
*/

const CryptoJS = require('crypto-js');

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',
  _hexEncodeArray = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'];

/**
* Convert an Uint8Array to hex
*
* @param {Uint8Array} ua - An Uint8Array
* @return {string}
*/
const ua2hex = function ua2hex (ua) {
  let s = '';
  for (let i = 0; i < ua.length; i++) {
    const code = ua[i];
    s += _hexEncodeArray[code >>> 4];
    s += _hexEncodeArray[code & 0x0F];
  }
  return s;
};

/**
 * Gets a network prefix from network id
 *
 * @param {number} id - A network id
 * @return {string} - The network prefix
 */
const id2Prefix = function (id) {
  if (id === 104) {
    return '68';
  } else if (id === -104) {
    return '98';
  } else {
    return '60';
  }
};

/**
* Convert hex to string
*
* @param {string} hexx - An hex string
* @return {string}
*/
const hex2a = function hex2a (hexx) {
  const hex = hexx.toString();
  let str = '';
  for (let i = 0; i < hex.length; i += 2) {
    str += String.fromCharCode(parseInt(hex.substr(i, 2), 16));
  }
  return str;
};

/**
* Decode a base32 string.
* This is made specifically for our use, deals only with proper strings
*
* @param {string} s - A base32 string
* @return {Uint8Array} - The decoded string
*/
const b32decode = function b32decode (s) {
  const r = new ArrayBuffer(s.length * 5 / 8);
  let b = new Uint8Array(r);
  for (let j = 0; j < s.length / 8; j++) {
    let v = [0, 0, 0, 0, 0, 0, 0, 0];
    for (let _i4 = 0; _i4 < 8; ++_i4) {
      v[_i4] = alphabet.indexOf(s[j * 8 + _i4]);
    }
    let i = 0;
    b[j * 5 + 0] = v[i + 0] << 3 | v[i + 1] >> 2;
    b[j * 5 + 1] = (v[i + 1] & 0x3) << 6 | v[i + 2] << 1 | v[i + 3] >> 4;
    b[j * 5 + 2] = (v[i + 3] & 0xf) << 4 | v[i + 4] >> 1;
    b[j * 5 + 3] = (v[i + 4] & 0x1) << 7 | v[i + 5] << 2 | v[i + 6] >> 3;
    b[j * 5 + 4] = (v[i + 6] & 0x7) << 5 | v[i + 7];
  }
  return b;
};

/**
* Encode a string to base32
* 
* @param {string} s - A string
* @return {string} - The encoded string
*/
const b32encode = function b32encode (s) {
  let parts = [];
  let quanta = Math.floor(s.length / 5);
  const leftover = s.length % 5;

  if (leftover !== 0) {
    for (let i = 0; i < 5 - leftover; i++) {
      s += '\x00';
    }
    quanta += 1;
  }

  for (let _i = 0; _i < quanta; _i++) {
    parts.push(alphabet.charAt(s.charCodeAt(_i * 5) >> 3));
    parts.push(alphabet.charAt((s.charCodeAt(_i * 5) & 0x07) << 2 | s.charCodeAt(_i * 5 + 1) >> 6));
    parts.push(alphabet.charAt((s.charCodeAt(_i * 5 + 1) & 0x3F) >> 1));
    parts.push(alphabet.charAt((s.charCodeAt(_i * 5 + 1) & 0x01) << 4 | s.charCodeAt(_i * 5 + 2) >> 4));
    parts.push(alphabet.charAt((s.charCodeAt(_i * 5 + 2) & 0x0F) << 1 | s.charCodeAt(_i * 5 + 3) >> 7));
    parts.push(alphabet.charAt((s.charCodeAt(_i * 5 + 3) & 0x7F) >> 2));
    parts.push(alphabet.charAt((s.charCodeAt(_i * 5 + 3) & 0x03) << 3 | s.charCodeAt(_i * 5 + 4) >> 5));
    parts.push(alphabet.charAt(s.charCodeAt(_i * 5 + 4) & 0x1F));
  }

  let replace = 0;
  if (leftover === 1) replace = 6;else if (leftover === 2) replace = 4;else if (leftover === 3) replace = 3;else if (leftover === 4) replace = 1;

  for (let _i2 = 0; _i2 < replace; _i2++) {
    parts.pop();
  }
  for (let _i3 = 0; _i3 < replace; _i3++) {
    parts.push('=');
  }
  return parts.join('');
};

/**
* Convert a public key to a NEM address
*
* @param {string} publicKey - A public key
* @param {number} networkId - A network id
* @return {string} - The NEM address
*/
const toAddress = function (publicKey, networkId) {
  let binPubKey = CryptoJS.enc.Hex.parse(publicKey);
  let hash = CryptoJS.SHA3(binPubKey, {
    outputLength: 256
  });
  let hash2 = CryptoJS.RIPEMD160(hash);
  // 98 is for testnet
  let networkPrefix = id2Prefix(networkId);
  let versionPrefixedRipemd160Hash = networkPrefix + CryptoJS.enc.Hex.stringify(hash2);
  let tempHash = CryptoJS.SHA3(CryptoJS.enc.Hex.parse(versionPrefixedRipemd160Hash), {
    outputLength: 256
  });
  let stepThreeChecksum = CryptoJS.enc.Hex.stringify(tempHash).substr(0, 8);
  let concatStepThreeAndStepSix = hex2a(versionPrefixedRipemd160Hash + stepThreeChecksum);
  let ret = b32encode(concatStepThreeAndStepSix);
  
  return ret;
};

/**
* Check if an address is valid
* 
* @param {string} _address - An address
* @return {boolean} - True if address is valid, false otherwise
*/
const isValid = function isValid (_address) {
  const address = _address.toString().toUpperCase().replace(/-/g, '');
  if (!address || address.length !== 40) {
    return false;
  }
  const decoded = ua2hex(b32decode(address));
  const versionPrefixedRipemd160Hash = CryptoJS.enc.Hex.parse(decoded.slice(0, 42));
  const tempHash = CryptoJS.SHA3(versionPrefixedRipemd160Hash, {
    outputLength: 256
  });
  const stepThreeChecksum = CryptoJS.enc.Hex.stringify(tempHash).substr(0, 8);

  return stepThreeChecksum === decoded.slice(42);
};

module.exports = {
  toAddress,
  isValid
};
