const Child = require("../models/Child");
const ScanLog = require("../models/ScanLog");
const mailQueue = require("../queues/mailQueue");
const { handleValidation } = require("../utils/validators");


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

        await ScanLog.create({
            child: child._id,
            parent: child.parent._id,
            ipAddress: req.ip,
            deviceInfo: req.headers["user-agent"],
        });

        await mailQueue.add("sendEmail", {
            email: child.parent.email,
            childName: child.name,
            ip: req.ip,
            deviceInfo: req.headers["user-agent"]
            // deviceInfo: "Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.5735.199 Mobile Safari/537.36"  // for test
        }, {
            attempts: 3,
            backoff: 5000
        });

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
    } catch (err) {
        next(err);
    }
}

module.exports = {
    scan
}