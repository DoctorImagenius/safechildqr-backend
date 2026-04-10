const Child = require("../models/Child");
const ScanLog = require("../models/ScanLog");
const { handleValidation } = require("../utils/validators");
const { transporter, generateEmailHTML, getLocation } = require("../utils/helpers");


const sendEmail = async (child, req) => {
    try {
        const time = new Date().toUTCString();
        const location = await getLocation(req.ip);

        const html = generateEmailHTML({
            childName: child.name,
            ip: req.ip,
            time,
            location : location || "Unknown",
            deviceInfo: req.headers["user-agent"] || "Unknown"
        });

        await transporter.sendMail({
            from: `"SafeChildQR 🚨" <${process.env.EMAIL_USER}>`,
            to: child.parent.email,
            subject: "🚨 SafeChildQR Alert",
            html,
        });

        console.log("Email sent to:", child.parent.email);
    } catch (err) {
        console.error("Email error:", err.message);
    }
};

const scan = async (req, res, next) => {
    try {
        handleValidation(req);

        const { code } = req.params;
        const childId = code.split("+")[0];

        const child = await Child.findById(childId).populate("parent");

        if (!child) {
            const err = new Error("Child not found");
            err.statusCode = 404;
            throw err;
        }

        res.json({
            child: {
                name: child.name || "Unnamed",
                age: child.age || "Unknown",
                emergencyMessage: child.emergencyMessage,
                location: child.location || "Unknown"
            },
            parent: {
                emergencyNumber: child.parent.emergencyNumber
            }
        });

        ScanLog.create({
            child: child._id,
            parent: child.parent._id,
            ipAddress: req.ip,
            deviceInfo: req.headers["user-agent"] || "Unknown",
        }).catch(err =>
            console.error("ScanLog error:", err.message)
        );

        sendEmail(child, req);

    } catch (err) {
        next(err);
    }
}

module.exports = {
    scan
}
