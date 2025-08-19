
import AES from 'crypto-js/aes.js';
import Utf8 from 'crypto-js/enc-utf8.js';
import { getKey, getAPI } from './creds.js';


const ENC_DATA = "U2FsdGVkX1+MaH+15ZHIIucNcro0jUwvC/A3pXnLP3mpCoOWYEgJvZipt4C1q2S5m5NK/t04koeHZEdjkUnwVYMqJHapVyag3YS+7zf8rF2kNaTk9Vbcd8z9V2UBWwj4QAymSXJSaZL2rbN6BB+qs1BfhEsOkQE9FEeH7qrAjW8PMzV2zjo5LC5ofaAg+akdFXSd9Ekc/XpIqHB157ZzKVT8oSr2ffPv8BaIA4RRp4EGaMlQw707yzaQUUIvj6TrNjSXF9GsfHE4hwifH0uvJ1CZrY5eE6NxbGEvYyc5wwNtgVVtf5KAQ50WFXKFymmpZAyYXRXoO0cWXsr743/s63cTeU8JCrmOX5cA3Nbpj0B9pdpCkDLkCFyD0Pqvt3DCsuYWt9vbO1cvFMl2RnoRUbP6TaYnd0IFHpl34h5Y7Ss=";
let ENCRYPTION_KEY = getKey();

function encryptData(data) {
    if (typeof data === 'object') {
        data = JSON.stringify(data);
    }
    const ctB64 = AES.encrypt(data, ENCRYPTION_KEY).toString(); // base64 string
    return ctB64;
}

function decryptData(cipher) {
    console.log();
    const bytes = AES.decrypt(cipher, ENCRYPTION_KEY);
    try {
        let json = JSON.parse(bytes.toString(Utf8));
        return json;
    } catch (e) {
        return bytes.toString(Utf8);
    }
}

export const getCredentials = () => {
    return new Promise((resolve, reject) => {
        try {
            let creds = decryptData(ENC_DATA);
            if (typeof creds === 'string') {
                try {
                    creds = JSON.parse(creds);
                } catch (e) {
                    console.error('Bad JSON in creds string:');
                    reject(e);
                }
            }
            resolve(creds);
        } catch (error) {
            console.error('Error reading credentials:', error);
            reject(error);
        }
    });
};

async function setup() {
    const data = "Sample text. HAHA!";
    console.log("RAW: ", data);

    const enc = encryptData(data);
    console.log("Encrypted: ", enc);

    const dec = decryptData(enc);
    console.log("Dencrypted: ", dec);

    getCredentials()
        .then((creds) => {
            console.log('Credentials retrieved:', creds);
        })
        .catch((error) => {
            console.error('Error retrieving credentials:', error);
        }
        );
}

// DEBUG ONLY
// setup();