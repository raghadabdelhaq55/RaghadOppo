// Email provider (SPEC §4 invites). Interface: send({ to, subject, text }).
//
// Dev default: append to data/outbox.log and log to the console — no secrets,
// runs offline. Prod: set RESEND_API_KEY to send for real (drop-in below).

const fs = require("fs");
const path = require("path");

const OUTBOX = path.join(__dirname, "..", "..", "data", "outbox.log");

async function send({ to, subject, text }) {
  if (process.env.RESEND_API_KEY) {
    return sendViaResend({ to, subject, text });
  }
  const entry = `[${new Date().toISOString()}] TO: ${to}\nSUBJECT: ${subject}\n${text}\n${"-".repeat(60)}\n`;
  fs.mkdirSync(path.dirname(OUTBOX), { recursive: true });
  fs.appendFileSync(OUTBOX, entry);
  console.log(`[email:dev] queued invite to ${to} (see data/outbox.log)`);
  return { delivered: "outbox", to };
}

async function sendViaResend({ to, subject, text }) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "Bill Splitter <invites@example.com>",
      to,
      subject,
      text,
    }),
  });
  if (!res.ok) throw new Error(`Resend failed: ${res.status}`);
  return { delivered: "resend", to };
}

module.exports = { send };
