import os from 'os';

export function detectDevice(): 'iMac' | 'MacBook' | 'unknown' {
  const hostname = os.hostname().toLowerCase();
  if (hostname.includes('imac')) return 'iMac';
  if (hostname.includes('macbook')) return 'MacBook';
  return 'unknown';
}

export function logDevice() {
  const device = detectDevice();
  console.log(`💻 Dispositivo: ${device} (${os.hostname()})`);
  return device;
}
