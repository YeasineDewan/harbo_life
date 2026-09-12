import nodemailer from "nodemailer";
import { getWelcomeTemplate, getOrderConfirmationTemplate } from "../utils/email.js";

let transporter = null;

/**
 * Lazily initialize the transporter when needed to avoid ES Module hoisting issues
 */
const getTransporter = () => {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
  }
  return transporter;
};

/**
 * Send a general email
 * @param {Object} options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML body content
 */
export const sendEmail = async ({ to, subject, html }) => {
  try {
    const info = await getTransporter().sendMail({
      from: `"Rochetta 💊" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
    return info;
  } catch (error) {
    console.error(`Error sending email to ${to}:`, error.message);
    throw error;
  }
};

/**
 * Send welcome email to a newly signed-up user
 * @param {string} email - Recipient email
 * @param {string} name - User's name
 */
export const sendWelcomeEmail = async (email, name) => {
  const html = getWelcomeTemplate(name);
  return sendEmail({
    to: email,
    subject: "Welcome to Rochetta! 👋",
    html,
  }).catch((err) => {
    console.error(`Failed to send welcome email to ${email}:`, err.message);
  });
};

/**
 * Send order confirmation email to a user
 * @param {string} email - Recipient email
 * @param {string} name - User's name
 * @param {Object} order - Populated order object
 */
export const sendOrderConfirmationEmail = async (email, name, order) => {
  const html = getOrderConfirmationTemplate(name, order);
  return sendEmail({
    to: email,
    subject: "Order Confirmation - Rochetta 📦",
    html,
  }).catch((err) => {
    console.error(`Failed to send order confirmation email to ${email}:`, err.message);
  });
};
