const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const rateLimit = require("express-rate-limit")
const Queue = require("bull");
const axios = require("axios");
const { body, param, validationResult } = require("express-validator");
const nodemailer = require("nodemailer");
const cors = require("cors");
require("dotenv").config();


const mailQueue = new Queue("mailQueue", {
    redis: {
        host: "localhost",
        port: 6379,
    },
});

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

// -------------------- MODELS --------------------
const childSchema = new mongoose.Schema({
    parent: { type: mongoose.Schema.Types.ObjectId, ref: "Parent", required: true },
    name: { type: String, trim: true },
    age: { type: Number, min: 0, max: 18 },
    emergencyMessage: { type: String, required: true },
    location: { lat: Number, lon: Number }
}, { timestamps: true });

const parentSchema = new mongoose.Schema({
    email: { type: String, unique: true, required: true },  // email is unique and this is index
    password: { type: String, required: true },
    emergencyNumber: { type: String, required: true },
    children: [{ type: mongoose.Schema.Types.ObjectId, ref: "Child" }]
}, { timestamps: true });

const scanLogSchema = new mongoose.Schema({
    child: { type: mongoose.Schema.Types.ObjectId, ref: "Child" },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: "Parent" },
    ipAddress: String,
    deviceInfo: String,
}, { timestamps: true });


const Child = mongoose.model("Child", childSchema);
const Parent = mongoose.model("Parent", parentSchema);
const ScanLog = mongoose.model("ScanLog", scanLogSchema);

// -------------------- DB --------------------
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB connected"))
    .catch(console.error);

// -------------------- APP --------------------
const app = express();
app.use(express.json());
app.use(cors());

// -------------------- HELPERS --------------------
const handleValidation = (req) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const err = new Error("Validation Error");
        err.statusCode = 400;
        err.details = errors.array();
        throw err;
    }
};

const sanitizeParent = (parent) => {
    const obj = parent.toObject();
    delete obj.password;
    return obj;
};

const loginRateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    message: "Too many requests, please try again after 1 minute"
})

const scanRateLimiter = rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 5,
    message: "Too many scans, please try again after 5 minutes"
})

// -------------------- MIDDLEWARE --------------------
const authMiddleware = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(" ")[1];
        if (!token) {
            const err = new Error("Unauthorized");
            err.statusCode = 401;
            throw err;
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await Parent.findById(decoded.id);
        if (!user) {
            const err = new Error("Unauthorized");
            err.statusCode = 401;
            throw err;
        }

        req.user = user;
        next();
    } catch (err) {
        err.statusCode = 401;
        next(err);
    }
};

// -------------------- EMAIL --------------------

async function getLocation(ip) {
    try {
        ip = "139.135.39.51"; // for test
        const res = await axios.get(`https://ipapi.co/${ip}/json/`);
        const { city, region, country_name, latitude, longitude, org } = res.data;
        return { city, region, country_name, latitude, longitude, org };
    } catch (err) {
        console.error("IP Location error:", err.message);
        return null;
    }
}

function generateEmailHTML({ childName, ip, time, location, deviceInfo }) {
    let mapsLink = "https://www.google.com/maps";
    let locationText = "Location is approximate and may not be exact";

    if (location?.latitude && location?.longitude) {
        mapsLink = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
        locationText = `${location.city || "Unknown"}, ${location.region || ""}, ${location.country_name || ""} (approximate location based on IP)`;
    }

    const deviceHTML = deviceInfo
        ? `
        <tr>
            <td style="padding:8px; vertical-align:top;">
                <span style="font-size:18px;">💻</span>
            </td>
            <td style="padding:8px;">
                <strong>Device Info:</strong><br/>
                ${deviceInfo}
            </td>
        </tr>
        `
        : "";

    return `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#333;background:#f9f9f9;padding:20px;">
        <table style="max-width:600px;margin:0 auto;background:#fff;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1);border-collapse:collapse;">
            <tr style="background:#d32f2f;color:#fff;">
                <td colspan="2" style="padding:16px;border-radius:8px 8px 0 0;font-size:20px;text-align:center;">
                    🚨 SafeChildQR Alert
                </td>
            </tr>

            <tr>
                <td style="padding:8px; vertical-align:top;"><span style="font-size:18px;">👶</span></td>
                <td style="padding:8px;"><strong>Child Name:</strong><br/>${childName}</td>
            </tr>

            <tr>
                <td style="padding:8px; vertical-align:top;"><span style="font-size:18px;">🌐</span></td>
                <td style="padding:8px;"><strong>Scanned By IP:</strong><br/>${ip}</td>
            </tr>

            <tr>
                <td style="padding:8px; vertical-align:top;"><span style="font-size:18px;">⏰</span></td>
                <td style="padding:8px;"><strong>Time:</strong><br/>${time}</td>
            </tr>

            <tr>
                <td style="padding:8px; vertical-align:top;"><span style="font-size:18px;">📍</span></td>
                <td style="padding:8px;">
                    <strong>Location:</strong><br/>
                    ${locationText} 
                    ${location?.latitude && location?.longitude ? `<br/><a href="${mapsLink}" target="_blank" style="color:#d32f2f;text-decoration:none;">View on Google Maps</a>` : ""}
                    ${location?.org ? `<p><strong>ISP / Organization:</strong> ${location.org}</p>` : ""}
                </td>
            </tr>

            ${deviceHTML}

            <tr>
                <td colspan="2" style="padding:12px;">
                    <hr style="border:none;border-top:1px solid #eee;"/>
                    <p style="color:#d32f2f;margin:4px 0;"><strong>Note:</strong> This location is approximate, based on IP.</p>
                    <p style="color:#555;margin:4px 0;">If you did not perform this scan, please take immediate action.</p>
                </td>
            </tr>
        </table>
    </div>
    `;
}

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

// -------------------- AUTH --------------------
app.post("/auth/signup", [
    body("email")
        .trim()
        .notEmpty()
        .withMessage("Email is required")
        .isEmail()
        .withMessage("Invalid email")
        .normalizeEmail(),
    body("password")
        .notEmpty()
        .withMessage("Password is required")
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/)
        .withMessage("Password must be strong (8+ chars, upper, lower, number, special char)"),
    body("emergencyNumber").matches(/^03\d{9}$/).notEmpty().withMessage("Emergency number is required")
], async (req, res, next) => {
    try {
        handleValidation(req);

        const { email, password, emergencyNumber } = req.body;

        const existing = await Parent.findOne({ email });
        if (existing) {
            const err = new Error("Email already exists");
            err.statusCode = 400; // Bad Request
            throw err;
        }

        const hashed = await bcrypt.hash(password, 10);

        const parent = await Parent.create({
            email,
            password: hashed,
            emergencyNumber
        });

        const token = jwt.sign({ id: parent._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

        res.json({ token, parent: sanitizeParent(parent) });
    } catch (err) {
        next(err);
    }
});

app.post("/auth/login", [
    body("email").isEmail().withMessage("Invalid email").notEmpty().withMessage("Email is required"),
    body("password").exists()
], loginRateLimiter, async (req, res, next) => {
    try {
        handleValidation(req);

        const { email, password } = req.body;

        const parent = await Parent.findOne({ email });
        if (!parent) {
            const err = new Error("Invalid credentials");
            err.statusCode = 400; // Bad Request
            throw err;
        }


        const match = await bcrypt.compare(password, parent.password);
        if (!match) {
            const err = new Error("Invalid credentials");
            err.statusCode = 400; // Bad Request
            throw err;
        }

        const token = jwt.sign({ id: parent._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

        res.json({ token, parent: sanitizeParent(parent) });
    } catch (err) {
        next(err);
    }
});

// -------------------- PARENT --------------------
app.get("/parent/me", authMiddleware, async (req, res, next) => {
    try {
        const parent = await Parent.findById(req.user._id).populate("children");
        res.json(sanitizeParent(parent));
    } catch (err) {
        next(err);
    }
});

app.put("/parent/me", authMiddleware, [
    body("emergencyNumber").optional().matches(/^03\d{9}$/),
    body("password").optional().matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/)
        .withMessage("Password must be strong (8+ chars, upper, lower, number, special char)")
], async (req, res, next) => {
    try {
        handleValidation(req);

        const allowed = ["emergencyNumber", "password"];
        const updates = {};

        for (let key of allowed) {
            if (req.body[key]) updates[key] = req.body[key];
        }

        if (updates.password) {
            updates.password = await bcrypt.hash(updates.password, 10);
        }

        const parent = await Parent.findByIdAndUpdate(req.user._id, updates, { new: true });

        res.json(sanitizeParent(parent));
    } catch (err) {
        next(err);
    }
});

app.delete("/parent/me", authMiddleware, async (req, res, next) => {
    try {
        await Child.deleteMany({ parent: req.user._id });  // we will use transaction
        await Parent.findByIdAndDelete(req.user._id);
        res.json({ message: "Deleted successfully" });
    } catch (err) {
        next(err);
    }
});

// -------------------- CHILD --------------------
app.post("/child", authMiddleware, [
    body("name").notEmpty().withMessage("Name is required"),
    body("emergencyMessage").notEmpty().withMessage("Emergency message is required"),
    body("age").optional().isInt({ min: 0, max: 18 }).withMessage("Age must be between 0 and 18")
], async (req, res, next) => {
    try {
        handleValidation(req);

        const allowed = ["name", "age", "emergencyMessage", "location"];
        const sanitizedBody = {};

        for (let key of allowed) {
            if (req.body[key]) sanitizedBody[key] = req.body[key];
        }

        const child = await Child.create({
            ...sanitizedBody,
            parent: req.user._id
        });

        await Parent.findByIdAndUpdate(req.user._id, {
            $push: { children: child._id }
        });

        res.json(child);
    } catch (err) {
        next(err);
    }
});

app.get("/child/:id", authMiddleware, [
    param("id").isMongoId().withMessage("Invalid id")
], async (req, res, next) => {
    try {
        handleValidation(req);

        const child = await Child.findById(req.params.id);
        if (!child) {
            const err = new Error("Child not found");
            err.statusCode = 404;
            throw err;
        }

        if (child.parent.toString() !== req.user._id.toString()) {
            const err = new Error("Forbidden");
            err.statusCode = 403;
            throw err;
        }

        res.json(child);
    } catch (err) {
        next(err);
    }
});

app.put("/child/:id", authMiddleware, [
    param("id").isMongoId().withMessage("Invalid id"),
    body("name").optional().notEmpty().withMessage("Name is required"),
    body("emergencyMessage").optional().notEmpty().withMessage("Emergency message is required"),
    body("age").optional().isInt({ min: 0, max: 18 }).withMessage("Age must be between 0 and 18"),
], async (req, res, next) => {
    try {
        handleValidation(req);

        const child = await Child.findById(req.params.id);
        if (!child) {
            const err = new Error("Child not found");
            err.statusCode = 400;
            throw err;
        }

        if (child.parent.toString() !== req.user._id.toString()) {
            const err = new Error("Forbidden");
            err.statusCode = 403;
            throw err;
        }

        const allowed = ["name", "age", "emergencyMessage", "location"];
        const updates = {};

        for (let key of allowed) {
            if (req.body[key]) updates[key] = req.body[key];
        }

        const updated = await Child.findByIdAndUpdate(req.params.id, updates, { new: true });

        res.json(updated);
    } catch (err) {
        next(err);
    }
});

app.delete("/child/:id", authMiddleware, [
    param("id").isMongoId().withMessage("Invalid id")
], async (req, res, next) => {
    try {
        handleValidation(req);

        const child = await Child.findById(req.params.id);
        if (!child) {
            const err = new Error("Child not found");
            err.statusCode = 400;
            throw err;
        }

        if (child.parent.toString() !== req.user._id.toString()) {
            const err = new Error("Forbidden");
            err.statusCode = 403;
            throw err;
        }

        await Child.findByIdAndDelete(req.params.id);  // we will use transaction

        await Parent.findByIdAndUpdate(req.user._id, {
            $pull: { children: child._id }
        });

        res.json({ message: "Deleted successfully" });
    } catch (err) {
        next(err);
    }
});

// -------------------- SCAN --------------------
app.get("/scan/:code", [
    param("code").notEmpty().withMessage("Scan code is required")
], scanRateLimiter, async (req, res, next) => {
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

        mailQueue.add("sendEmail", {
            email: child.parent.email,
            childName: child.name,
            ip: req.ip,
            // deviceInfo: req.headers["user-agent"]
            deviceInfo: "Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.5735.199 Mobile Safari/537.36"  // fir test
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
});

// -------------------- ERROR HANDLER --------------------
app.use((err, req, res, next) => {

    res.status(err.statusCode || 500).json({
        success: false,
        message: err.message || "Server Error",
        details: err.details || null
    });
});

// -------------------- SERVER --------------------
app.listen(process.env.PORT || PORT, () => console.log(`Server running on port ${PORT}`));