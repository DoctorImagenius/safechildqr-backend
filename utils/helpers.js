const axios = require("axios");
const nodemailer = require("nodemailer");


const sanitizeParent = (parent) => {
    const obj = parent.toObject();
    delete obj.password;
    return obj;
};

const getRealIP = (req) => {
    const forwarded = req.headers["x-forwarded-for"];

    let ip = forwarded
        ? forwarded.split(",")[0]
        : req.ip;
    ip = ip.split(":").pop();

    return ip;
};

async function getLocation(ip) {
    try {
        ip = getRealIP(req);
        const res = await axios.get(`https://ipapi.co/${ip}/json/`);
        const { city, region, country_name, latitude, longitude, org } = res.data;
        return { city, region, country_name, latitude, longitude, org };
    } catch (err) {
        console.error("IP Location error:", err.message);
        return null;
    }
}

const generateEmailHTML = ({ childName, ip, time, location, deviceInfo }) => {
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

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});


module.exports = {
    sanitizeParent,
    getLocation,
    generateEmailHTML,
    transporter
}