const tronAddress = 'TMGSeM3QLUJEbdscQnMt9ujx843arknWb2';
console.log('TRON Address:', tronAddress);
console.log('Length:', tronAddress.length);
console.log('Starts with T:', tronAddress.startsWith('T'));

// Check Base58 characters (excluding 0, O, I, l)
const validBase58 = /^[1-9A-HJ-NP-Za-km-z]+$/;
const addressWithoutT = tronAddress.slice(1);
console.log('Valid Base58 (without T):', validBase58.test(addressWithoutT));

// Full validation like in contract
let isValid = true;
if (tronAddress.length !== 34) isValid = false;
if (tronAddress[0] !== 'T') isValid = false;

for (let i = 1; i < tronAddress.length; i++) {
  const char = tronAddress[i];
  const isValidChar = (char >= '1' && char <= '9') ||
                     (char >= 'A' && char <= 'Z') ||
                     (char >= 'a' && char <= 'z') &&
                     char !== '0' && char !== 'O' && char !== 'I' && char !== 'l';
  if (!isValidChar) {
    console.log('Invalid character at position', i, ':', char);
    isValid = false;
    break;
  }
}

console.log('Contract validation should pass:', isValid);