import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

const model = apiKey
  ? new GoogleGenerativeAI(apiKey).getGenerativeModel({
      model: "gemini-1.5-flash",
      systemInstruction: `You are an AI assistant working inside an Online Pharmacy System. Answer briefly and clearly.`,
    })
  : null;

export default model;