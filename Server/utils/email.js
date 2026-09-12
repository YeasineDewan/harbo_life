/**
 * Welcome Email Template HTML
 * @param {string} name - User's name
 */
export const getWelcomeTemplate = (name) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Rochetta</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; padding: 32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(15, 23, 42, 0.05); border: 1px solid #e2e8f0;">
          
          <!-- Premium Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f766e 0%, #115e59 100%); padding: 48px 32px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 36px; font-weight: 800; letter-spacing: -0.5px;">Rochetta 💊</h1>
              <p style="color: #ccfbf1; margin: 8px 0 0 0; font-size: 16px; font-weight: 500;">Your Trusted Care Companion</p>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 40px 32px;">
              <h2 style="color: #0f172a; margin: 0 0 16px 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Welcome to the family, ${name}! 👋</h2>
              <p style="color: #475569; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                We are thrilled to have you on board! Rochetta makes managing your health and prescriptions easier, faster, and more secure. Here is what you can look forward to:
              </p>

              <!-- Feature Cards -->
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 32px;">
                <tr>
                  <td style="padding: 12px 0;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="48" valign="top">
                          <span style="display: inline-block; width: 36px; height: 36px; line-height: 36px; background-color: #f0fdfa; color: #0f766e; text-align: center; border-radius: 50%; font-size: 18px; font-weight: bold;">💊</span>
                        </td>
                        <td valign="top" style="padding-left: 12px;">
                          <h4 style="color: #0f172a; margin: 0 0 4px 0; font-size: 15px; font-weight: 700;">Wide Medication Selection</h4>
                          <p style="color: #64748b; margin: 0; font-size: 14px; line-height: 1.4;">Browse thousands of authentic over-the-counter and prescription medicines.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="48" valign="top">
                          <span style="display: inline-block; width: 36px; height: 36px; line-height: 36px; background-color: #f0fdfa; color: #0f766e; text-align: center; border-radius: 50%; font-size: 18px; font-weight: bold;">⚡</span>
                        </td>
                        <td valign="top" style="padding-left: 12px;">
                          <h4 style="color: #0f172a; margin: 0 0 4px 0; font-size: 15px; font-weight: 700;">Super Fast Delivery</h4>
                          <p style="color: #64748b; margin: 0; font-size: 14px; line-height: 1.4;">Receive your orders straight to your doorstep within hours.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 12px 0;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="48" valign="top">
                          <span style="display: inline-block; width: 36px; height: 36px; line-height: 36px; background-color: #f0fdfa; color: #0f766e; text-align: center; border-radius: 50%; font-size: 18px; font-weight: bold;">🧾</span>
                        </td>
                        <td valign="top" style="padding-left: 12px;">
                          <h4 style="color: #0f172a; margin: 0 0 4px 0; font-size: 15px; font-weight: 700;">Prescription Uploads</h4>
                          <p style="color: #64748b; margin: 0; font-size: 14px; line-height: 1.4;">Simply upload your doctor's script and we will handle the rest.</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <div style="text-align: center; margin: 32px 0 16px 0;">
                <a href="https://rochetta.vercel.app/" style="background: linear-gradient(135deg, #0f766e 0%, #115e59 100%); color: #ffffff; padding: 16px 40px; border-radius: 10px; text-decoration: none; font-size: 16px; font-weight: 700; display: inline-block; box-shadow: 0 4px 10px rgba(15, 118, 110, 0.25);">
                  Get Started
                </a>
              </div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 32px; text-align: center; border-top: 1px solid #f1f5f9;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0; line-height: 1.5;">
                © 2026 Rochetta Inc. All rights reserved.
              </p>
              <p style="color: #94a3b8; font-size: 12px; margin: 4px 0 0 0;">
                If you did not sign up for this account, please ignore this email.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

/**
 * Order Confirmation Email Template HTML
 * @param {string} name - User's name
 * @param {Object} order - Populated order object
 */
export const getOrderConfirmationTemplate = (name, order) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmation - Rochetta</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; padding: 32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(15, 23, 42, 0.05); border: 1px solid #e2e8f0;">
          
          <!-- Order Confirmation Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f766e 0%, #115e59 100%); padding: 48px 32px; text-align: center;">
              <div style="background-color: rgba(255, 255, 255, 0.15); width: 56px; height: 56px; line-height: 56px; text-align: center; border-radius: 50%; margin: 0 auto 16px auto; font-size: 24px;">📦</div>
              <h1 style="color: #ffffff; margin: 0; font-size: 30px; font-weight: 800; letter-spacing: -0.5px;">Order Confirmed!</h1>
              <p style="color: #ccfbf1; margin: 6px 0 0 0; font-size: 15px; font-weight: 500;">Thank you for shopping with Rochetta</p>
            </td>
          </tr>

          <!-- Summary Intro -->
          <tr>
            <td style="padding: 32px 32px 16px 32px;">
              <h2 style="color: #0f172a; margin: 0 0 8px 0; font-size: 20px; font-weight: 700;">Hi ${name},</h2>
              <p style="color: #475569; font-size: 15px; line-height: 1.5; margin: 0;">
                We have received your order and are currently preparing it. Below are your shipping details and order details:
              </p>
            </td>
          </tr>

          <!-- Order Metadata Cards -->
          <tr>
            <td style="padding: 8px 32px 24px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #f1f5f9; border-radius: 12px; background-color: #f8fafc; padding: 16px;">
                <tr>
                  <td width="50%" valign="top" style="padding-right: 12px;">
                    <p style="color: #94a3b8; font-size: 11px; text-transform: uppercase; font-weight: 700; margin: 0 0 4px 0;">Order ID</p>
                    <p style="color: #0f172a; font-size: 14px; font-weight: 600; margin: 0; word-break: break-all;">#${order._id}</p>
                  </td>
                  <td width="50%" valign="top" style="padding-left: 12px;">
                    <p style="color: #94a3b8; font-size: 11px; text-transform: uppercase; font-weight: 700; margin: 0 0 4px 0;">Deliver To</p>
                    <p style="color: #0f172a; font-size: 14px; font-weight: 600; margin: 0;">
                      ${order.address.street}, ${order.address.city}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Itemised List Table -->
          <tr>
            <td style="padding: 0 32px 24px 32px;">
              <h3 style="color: #0f172a; margin: 0 0 12px 0; font-size: 16px; font-weight: 700; border-bottom: 1px solid #f1f5f9; padding-bottom: 8px;">Items Summary</h3>
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <thead>
                  <tr style="color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: 700;">
                    <th align="left" style="padding: 8px 0;">Item Name</th>
                    <th align="center" style="padding: 8px 0; width: 60px;">Qty</th>
                    <th align="right" style="padding: 8px 0; width: 100px;">Price</th>
                  </tr>
                </thead>
                <tbody>
                  ${order.items.map(item => `
                    <tr style="border-bottom: 1px solid #f8fafc;">
                      <td style="padding: 12px 0; color: #334155; font-size: 14px; font-weight: 600;">
                        ${item.product.name}
                      </td>
                      <td align="center" style="padding: 12px 0; color: #475569; font-size: 14px;">
                        ${item.quantity}
                      </td>
                      <td align="right" style="padding: 12px 0; color: #0f172a; font-size: 14px; font-weight: 600;">
                        $${(item.price * item.quantity).toFixed(2)}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </td>
          </tr>

          <!-- Total Calculation -->
          <tr>
            <td style="padding: 0 32px 32px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top: 2px solid #f1f5f9; padding-top: 16px;">
                <tr>
                  <td align="right" style="color: #64748b; font-size: 14px; padding: 4px 0;">Subtotal</td>
                  <td align="right" style="color: #334155; font-size: 14px; font-weight: 600; padding: 4px 0; width: 120px;">$${order.total.toFixed(2)}</td>
                </tr>
                <tr>
                  <td align="right" style="color: #64748b; font-size: 14px; padding: 4px 0;">Shipping</td>
                  <td align="right" style="color: #10b981; font-size: 14px; font-weight: 600; padding: 4px 0; width: 120px;">FREE</td>
                </tr>
                <tr style="font-size: 18px;">
                  <td align="right" style="color: #0f172a; font-weight: 800; padding: 12px 0 0 0;">Total Paid</td>
                  <td align="right" style="color: #0f766e; font-weight: 800; padding: 12px 0 0 0; width: 120px;">$${order.total.toFixed(2)}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA Track Button -->
          <tr>
            <td style="padding: 0 32px 40px 32px; text-align: center;">
              <a href="https://rochetta.vercel.app/" style="background: linear-gradient(135deg, #0f766e 0%, #115e59 100%); color: #ffffff; padding: 16px 40px; border-radius: 10px; text-decoration: none; font-size: 15px; font-weight: 700; display: inline-block; box-shadow: 0 4px 10px rgba(15, 118, 110, 0.25);">
                Track Your Order
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8fafc; padding: 24px 32px; text-align: center; border-top: 1px solid #f1f5f9;">
              <p style="color: #94a3b8; font-size: 12px; margin: 0; line-height: 1.5;">
                © 2026 Rochetta Inc. All rights reserved.
              </p>
              <p style="color: #94a3b8; font-size: 12px; margin: 4px 0 0 0;">
                If you have any questions, please contact our support team.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;