import { Chat } from "../../models/Chat/chat.model.js";
import Product from "../../models/Product/product.model.js";
import { Order } from "../../models/Order/order.model.js";
import { Cart } from "../../models/Cart/cart.model.js";
import groq from "../../config/groq.js";
import { BadRequestError } from "../../utils/errors.js";
import { getDbContext } from "../../helpers/chat.helpers.js";



export const getChatHistory = async (req, res, next) => {
  try {
    let chat = await Chat.findOne({ user: req.user._id, is_deleted: false });
    if (!chat) {
      chat = await Chat.create({ user: req.user._id, messages: [] });
    }

    res.status(200).json({
      status: "success",
      data: {
        history: chat.messages
      }
    });
  } catch (error) {
    next(error);
  }
};



export const sendMessage = async (req, res, next) => {
  try {
    const { message } = req.body;

    if (!message || message.trim() === "") {
      throw new BadRequestError("Message content is required");
    }

    // Find or create chat session
    let chat = await Chat.findOne({ user: req.user._id, is_deleted: false });

    if (!chat) {
      chat = new Chat({ user: req.user._id, messages: [] });
    }

    // Get Database Grounding Context dynamically
    const dbContext = await getDbContext(req.user._id, message);

    const defaultModel = process.env.GROQ_MODEL || "openai/gpt-oss-20b";

    // Setup the system instructions
    const systemPrompt = `You are an expert Pharmacy Assistant chatbot for our e-commerce platform.
                          Your name is PharmaBot. Your goal is to help users find medications, check order statuses, view their cart, and give general advice.

                          Guidelines:
                          1. Always be polite, helpful, professional, and friendly.
                          2. Provide a medical disclaimer when answering health questions: "Please note: I am an AI assistant. For serious medical conditions, please consult a healthcare professional."
                          3. You can answer in English or Arabic depending on the language the user uses.
                          4. Keep your answers concise, clear, and helpful.
                          5. Use the provided database context to give accurate information about user's orders, cart, and available products. If the user asks about an order or cart and they are in the context, refer to them. If the product is not in stock or not in the context, politely suggest options or tell them.

                          Current Date: ${new Date().toDateString()}

                          [DATABASE CONTEXT]
                          ${dbContext}
                          `
      ;

    // Limit conversation history sent to the model for token efficiency
    const recentHistoryLimit = 10;

    const recentMessages = chat.messages.slice(-recentHistoryLimit).map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    // Form request payload for Groq
    const groqMessages = [
      { role: "system", content: systemPrompt },
      ...recentMessages,
      { role: "user", content: message }
    ];

    // Call Groq API
    const response = await groq.chat.completions.create({
      model: defaultModel,
      messages: groqMessages,
      temperature: 0.7,
      max_tokens: 1024,
    });

    const assistantReply = response.choices[0].message.content;

    // Save history
    chat.messages.push({ role: "user", content: message });
    chat.messages.push({ role: "assistant", content: assistantReply });
    await chat.save();

    res.status(200).json({
      status: "success",
      data: {
        reply: assistantReply,
        history: chat.messages
      }
    });
  } catch (error) {
    next(error);
  }
};



export const clearChatHistory = async (req, res, next) => {
  try {
    const chat = await Chat.findOne({ user: req.user._id, is_deleted: false });
    if (chat) {
      chat.messages = [];
      await chat.save();
    }

    res.status(200).json({
      status: "success",
      message: "Chat history cleared successfully"
    });
  } catch (error) {
    next(error);
  }
};
