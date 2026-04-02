const Queue = require("bull");

const mailQueue = new Queue("mailQueue", {
    redis: {
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
    },
});

module.exports = mailQueue;