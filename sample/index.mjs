import { Xumm } from '../dist/index.js';

console.log('MJS version');

const xumm1 = new Xumm('apikey', 'apisecret');
console.log('ping', await xumm1.ping())

const xumm2 = new Xumm('somejwt');
console.log('jwt', await xumm2.environment.jwt)
console.log('ping', await xumm2.ping())
