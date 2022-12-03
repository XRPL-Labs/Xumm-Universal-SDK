import { Xumm } from "../";

console.log("TS version");

const xumm = new Xumm(
  "some-api-key",
  "some-secret-key",
);

const main = async () => {
  console.log("account:", await xumm.user?.account);

  console.log("ping@1", await xumm.ping());

  console.log('rates', await xumm.helpers?.getRates('EUR'))

  console.log('jwt', await xumm.environment?.jwt)
  console.log('bearer', await xumm.environment?.bearer)
  console.log('openid', await xumm.environment?.openid)
  console.log('ott', await xumm.environment?.ott)

  console.log('payload', await xumm.payload?.create({TransactionType: 'SignIn'})) 
};

main();
