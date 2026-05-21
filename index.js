const { default: makeWASocket, DisconnectReason, useMultiFileAuthState, useSingleFileAuthState } = require("@whiskeysockets/baileys")
const pino = require("pino")
const { Boom } = require("@hapi/boom")
const express = require("express")
const app = express()
const PORT = process.env.PORT || 3000

let qr = "QR not generated yet. Wait..."

app.get("/", (req, res) => {
  res.send(`
    <html>
      <head><title>Mordeall Pair</title></head>
      <body style="font-family:sans-serif;text-align:center;padding:50px">
        <h1>MORDEALL BOT</h1>
        <h3>Scan this QR with WhatsApp</h3>
        <p>WhatsApp > Linked Devices > Link a Device</p>
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qr)}" />
        <p>Refresh if QR expires</p>
      </body>
    </html>
  `)
})

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("session")
    const sock = makeWASocket({
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        auth: state,
    })

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect, qr: newQr } = update
        if(newQr) qr = newQr
        if(connection === "close") {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode!== DisconnectReason.loggedOut
            if(shouldReconnect) startBot()
        } else if(connection === "open") {
            console.log("Mordeall connected successfully ✅")
        }
    })

    sock.ev.on("messages.upsert", async ({ messages }) => {
        const m = messages[0]
        if(!m.message || m.key.fromMe) return
        const text = m.message.conversation || m.message.extendedTextMessage?.text || ""
        const sender = m.key.remoteJid
        if(text === ".menu") await sock.sendMessage(sender, { text: `*MORDEALL BOT*\n\n.menu - Show menu\n.ping - Bot status` })
        if(text === ".ping") await sock.sendMessage(sender, { text: "Pong! Online 24/7 ✅" })
    })
}

app.listen(PORT, () => console.log(`Server running on ${PORT}`))
startBot()
