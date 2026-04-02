const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });
const mailQueue = require("../queues/mailQueue");
const { generateEmailHTML } = require("../utils/helpers");
const { getLocation } = require("../utils/helpers");
const { transporter } = require("../utils/helpers");

mailQueue.process("sendEmail", async (job) => {
    const { email, childName, ip, deviceInfo } = job.data;
    console.log(`📧 Sending email to ${email}...`);

    const time = new Date().toUTCString();
    const location = await getLocation(ip);

    const html = generateEmailHTML({ childName, ip, time, location, deviceInfo });

    await transporter.sendMail({
        from: `"SafeChildQR 🚨" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "🚨 SafeChildQR Alert",
        html,
    });
});

mailQueue.on("completed", (job) => {
    console.log("✅ Email sent successfully");
});

mailQueue.on("failed", (job, err) => {
    console.log("❌ Email failed:", err.message);
});

module.exports = mailQueue;
