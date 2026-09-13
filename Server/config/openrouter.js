import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.OPENROUTER_API_KEY;

const openrouter = apiKey
  ? new OpenAI({
      apiKey,
      baseURL: "https://openrouter.ai/api/v1",
      defaultHeaders: {
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "http://localhost:4000",
        "X-Title": process.env.OPENROUTER_APP_NAME || "Rochetta Pharmacy",
      },
    })
  : null;

export default openrouter;