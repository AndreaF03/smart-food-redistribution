const nodemailer = require("nodemailer");

/* =====================================
   TRANSPORTER
   FIX: createTransport is called once at module load.
   The original had no guard — if EMAIL_USER / EMAIL_PASS
   are missing the transporter silently creates with undefined
   credentials and every send fails at runtime with a cryptic
   SMTP auth error instead of a clear startup warning.
===================================== */
if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
  console.warn(
    "[mailer] WARNING: EMAIL_USER or EMAIL_PASS not set. " +
    "Emails will not be sent."
  );
}

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  // FIX: pool connections instead of opening a new TCP connection
  // for every single email — important under load
  pool: true,
});

/* =====================================
   VERIFY CONNECTION (non-fatal)
   Logs a clear message at startup so you know immediately
   if credentials are wrong, rather than discovering it
   when the first real email fails in production.
===================================== */
transporter.verify((err) => {
  if (err) {
    console.error("[mailer] SMTP connection failed:", err.message);
  } else {
    console.log("[mailer] SMTP ready");
  }
});

/* =====================================
   SEND EMAIL
   FIX: original silently swallowed errors with a console.error
   and returned undefined — callers (foodController, authController)
   had no way to know if the email failed.
   Now throws so callers can .catch() it and log appropriately.
   All existing callers already use .catch() after the fix in
   foodController.js / authController.js so this is safe.
===================================== */
const sendEmail = async ({ to, subject, html }) => {
  // No-op if credentials aren't configured (dev / test environments)
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) return;

  await transporter.sendMail({
    from:    `"FoodBridge" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  });
};

module.exports = { sendEmail };