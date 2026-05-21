const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require("@whiskeysockets/baileys")
const pino = require("pino")
const { Boom } = require("@hapi/boom")
const express = require("express")
const app = express()
const PORT = process.env.PORT || 3000

let pairCode = "Generating code... Wait 10sec and refresh"
let phoneNumber = ""

app.use(express.urlencoded({ extended: true }))

app.get("/", (req, res) => {
  res.send(`
    <html>
      <head><title>Mordeall Pair</title></head>
      <body style="font-family:sans-serif;text-align:center;padding:50px">
        <h1>MORDEALL BOT</h1>
        <h3>Enter your WhatsApp number to get pairing code</h3>
        <form method="POST" action="/pair">
          <input type="text" name="number" placeholder="255700000000" style="padding:10px;font-size:16px" required />
          <button type="submit" style="padding:10px 20px;font-size:16px">Get Code</button>
        </form>
        <h2>${pairCode}</h2>
        <p>WhatsApp > Linked Devices > Link with phone number</p>
      </body>
    </html>
  `)
})

app.post("/pair", async (req, res) => {
  phoneNumber = req.body.number.replace(/[^0-9]/g, "")
  res.redirect("/")
  startBot()
})

async function startBot() {
    if(!phoneNumber) return
    const { state, saveCreds } = await useMultiFileAuthState("session")
    const sock = makeWASocket({
        logger: pino({ level: "silent" }),
        printQRInTerminal: false,
        auth: state,
    })

    sock.ev.on("creds.update", saveCreds)

    if(!sock.authState.creds.registered) {
        setTimeout(async () => {
            let code = await sock.requestPairingCode(phoneNumber)
            pairCode = `Your Code: ${code}`
            console.log(`Pairing code: ${code}`)
        }, 3000)
    }

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update
        if(connection === "close") {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode!== DisconnectReason.loggedOut
            if(shouldReconnect) startBot()
        } else if(connection === "open") {
            pairCode = "Connected Successfully ✅"
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
