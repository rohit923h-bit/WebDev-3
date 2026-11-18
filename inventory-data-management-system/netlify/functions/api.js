
const serverless = require("serverless-http");
const app = require("../../server");
const connectDB = require("../../config/db");

const handler = serverless(app);

exports.handler = async (event, context) => {
  try {
    await connectDB();
    return await handler(event, context);
  } catch (error) {
    console.error("Netlify API error:", error);

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Server error",
        error: error.message
      })
    };
  }
};
