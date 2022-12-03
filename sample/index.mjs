import { Xumm } from '../dist/index.js';

console.log('MJS version');

const xumm = new Xumm('some-api-key', 'some-secret');
console.log('ping', await xumm.ping())
