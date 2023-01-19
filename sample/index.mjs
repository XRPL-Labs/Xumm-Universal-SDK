import { Xumm } from '../dist/index.js';

console.log('MJS version');

// const xumm = new Xumm('some-api-key', 'some-secret');
// console.log('ping', await xumm.ping())

const xumm = new Xumm('somejwt');
console.log('jwt', await xumm.environment.jwt)
console.log('ping', await xumm.ping())
