const { default: makeWASocket, DisconnectReason, useMultiFileAuthState } = require("@whiskeysockets/baileys")
const pino = require("pino")
const { Boom } = require("@hapi/boom")

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("session")
    const sock = makeWASocket({
        logger: pino({ level: "silent" }),
        printQRInTerminal: true,
        auth: state,
    })

    sock.ev.on("creds.update", saveCreds)

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update
        if(connection === "close") {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode!== DisconnectReason.loggedOut
            console.log("Connection closed. Reconnecting:", shouldReconnect)
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

        if(text === ".menu") {
            await sock.sendMessage(sender, { text: `*MORDEALL BOT*\n\n.menu - Show menu\n.ping - Bot status` })
        }
        else if(text === ".ping") {
            await sock.sendMessage(sender, { text: "Pong! Online 24/7 ✅" })
        }
    })
}

startBot()
