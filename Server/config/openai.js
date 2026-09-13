import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.OPENAI_API_KEY;

const openai = apiKey
  ? new OpenAI({
      apiKey,
    })
  : null;

export default openai;