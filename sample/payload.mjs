import { Xumm } from '../dist/index.js'
import WebSocket from 'ws'

const xumm = new Xumm('8525e32b-1bd0-4839-af2f-f794874a80b0', 'xxxxx')

const payload = await xumm.payload?.create({
    TransactionType: "SignIn"
})
console.log(payload.refs.websocket_status)

const ws = new WebSocket(payload.refs.websocket_status)

ws.on('error', console.log)

ws.on('open', function open() {
  console.log('WS Open')
});

ws.on('message', function message(data) {
  console.log('received: %s', data)
})
