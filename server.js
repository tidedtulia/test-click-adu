/**
 * Intercom Canvas Kit App - "Choose customer type -> WhatsApp handoff"
 *
 * Luong hoat dong (giong mockup 4 buoc cua ban):
 *  1. Khach bam card app tren Messenger Home
 *  2. /initialize  -> hien "Welcome! Are you an existing customer or new to us?"
 *     kem 2 lua chon: Existing Customer / New Customer
 *  3. /submit (component_id = "new_customer")
 *       -> hien tin nhan + nut "Continue on WhatsApp" (action type "url")
 *     /submit (component_id = "existing_customer")
 *       -> hien tin nhan huong dan (xem README ve gioi han + huong nang cap)
 *  4. Khach bam "Continue on WhatsApp" -> trinh duyet/app WhatsApp mo voi
 *     tin nhan duoc dien san.
 *
 * Tai lieu tham khao:
 *  - Canvas Kit overview:  https://developers.intercom.com/docs/canvas-kit
 *  - List component:       https://developers.intercom.com/docs/references/canvas-kit/interactivecomponents/list
 *  - Button / URL action:  https://developers.intercom.com/docs/references/canvas-kit/interactivecomponents/button
 *  - Signed requests:      https://developers.intercom.com/docs/canvas-kit#signed-notifications
 */

const express = require("express");
const bodyParser = require("body-parser");
const crypto = require("crypto");

const app = express();

// Dung "verify" callback cua body-parser de giu lai RAW BODY (buffer) truoc
// khi no bi parse thanh object. Can raw body nay de tinh chu ky HMAC chinh
// xac - neu dung JSON.stringify(req.body) de tinh lai, ket qua co the khac
// byte-for-byte voi request goc (thu tu key, khoang trang...), khien viec
// xac thuc luon that bai ngay ca voi request hop le tu Intercom.
app.use(
  bodyParser.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

// ---- Cau hinh: doi cac gia tri nay theo doanh nghiep cua ban --------------
const WHATSAPP_NUMBER = process.env.WHATSAPP_NUMBER || "84901234567"; // KHONG co dau '+'
const WHATSAPP_PREFILL_TEXT =
  process.env.WHATSAPP_PREFILL_TEXT ||
  "Hi, I'm a new customer and would like to know more about your services.";

// Client secret cua app, lay o Developer Hub > app cua ban > Basic Info.
// Neu KHONG set bien nay, server se BO QUA buoc xac thuc chu ky (huu ich khi
// dev/test local) - nhung PHAI set truoc khi dua len production that.
const INTERCOM_CLIENT_SECRET = process.env.INTERCOM_CLIENT_SECRET || "";

function buildWhatsAppUrl() {
  const encodedText = encodeURIComponent(WHATSAPP_PREFILL_TEXT);
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedText}`;
}

// ---- Xac thuc chu ky X-Body-Signature tu Intercom -------------------------
//
// Intercom ky moi Canvas Kit request bang header X-Body-Signature, tinh
// bang HMAC-SHA256(raw_json_body, app_client_secret), dang hex.
function verifyIntercomSignature(req) {
  if (!INTERCOM_CLIENT_SECRET) {
    // Chua cau hinh secret (vi du dang chay local) -> bo qua kiem tra.
    return true;
  }

  const signature = req.get("X-Body-Signature");
  if (!signature || !req.rawBody) {
    return false;
  }

  const expected = crypto
    .createHmac("sha256", INTERCOM_CLIENT_SECRET)
    .update(req.rawBody)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(signature, "hex")
    );
  } catch {
    // Do dai buffer khac nhau, v.v.
    return false;
  }
}

function requireValidIntercomSignature(req, res, next) {
  if (!verifyIntercomSignature(req)) {
    return res.status(401).json({ error: "Invalid X-Body-Signature" });
  }
  next();
}

// ---- Cac "man hinh" (canvas) ----------------------------------------------

// Man hinh 2: hoi loai khach hang
function welcomeCanvas() {
  return {
    canvas: {
      content: {
        components: [
          {
            type: "text",
            id: "welcome_text",
            text: "**Welcome!** 👋\nAre you an existing customer or new to us?",
            align: "left",
            style: "header",
          },
          {
            type: "list",
            id: "customer_type_list",
            items: [
              {
                type: "item",
                id: "existing_customer",
                title: "Existing Customer",
                subtitle: "I'm an existing customer and need support.",
                action: { type: "submit" },
              },
              {
                type: "item",
                id: "new_customer",
                title: "New Customer",
                subtitle: "I'm new and would like to learn more.",
                action: { type: "submit" },
              },
            ],
          },
        ],
      },
    },
  };
}

// Man hinh 3a: khach hang moi -> dan sang WhatsApp
function whatsAppHandoffCanvas() {
  return {
    canvas: {
      content: {
        components: [
          {
            type: "text",
            id: "handoff_text",
            text: "**Great!** 🎉\nTo help you better, our team will continue this conversation on WhatsApp.",
            align: "left",
            style: "header",
          },
          {
            type: "text",
            id: "handoff_subtext",
            text: "Your information is secure and will only be used to assist you.",
            align: "left",
            style: "muted",
          },
          {
            type: "button",
            id: "continue_whatsapp_button",
            label: "Continue on WhatsApp",
            style: "primary",
            action: {
              type: "url",
              url: buildWhatsAppUrl(),
            },
          },
        ],
      },
    },
  };
}

// Man hinh 3b: khach hang cu -> huong dan lien he doi ho tro
// LUU Y: Canvas Kit khong co action de "mo mot cuoc hoi thoai that" ngay
// trong app. Cach don gian nhat la huong dan khach quay lai va bam nut
// "Send us a message" mac dinh (van con tren Home). Xem README de biet
// them lua chon nang cao hon (goi Intercom API de tao conversation that).
function existingCustomerCanvas() {
  return {
    canvas: {
      content: {
        components: [
          {
            type: "text",
            id: "existing_text",
            text: "**Thanks!** 🙌\nOur support team is ready to help — please tap **Send us a message** on the Home screen to start chatting with us.",
            align: "left",
            style: "header",
          },
        ],
      },
    },
  };
}

// ---- Webhook endpoints ------------------------------------------------

// Duoc goi khi app duoc them vao Messenger Home / hien thi lan dau
app.post("/initialize", requireValidIntercomSignature, (req, res) => {
  res.json(welcomeCanvas());
});

// Duoc goi moi khi khach bam vao 1 component co action "submit"
app.post("/submit", requireValidIntercomSignature, (req, res) => {
  const componentId = req.body.component_id;

  if (componentId === "new_customer") {
    return res.json(whatsAppHandoffCanvas());
  }

  if (componentId === "existing_customer") {
    return res.json(existingCustomerCanvas());
  }

  // Mac dinh: quay ve man hinh Welcome
  return res.json(welcomeCanvas());
});

// Health check - kiem tra server con song khong (Intercom khong goi route nay)
app.get("/", (req, res) => {
  res.type("text/plain").send("Intercom Canvas Kit app is running.");
});

// Chi thuc su "listen" khi chay local (node server.js / npm start).
// Tren Vercel, file nay duoc import nhu 1 serverless function thong qua
// module.exports = app; ben duoi - Vercel tu goi app, khong can listen().
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Canvas Kit app dang chay tai http://localhost:${PORT}`);
    if (!INTERCOM_CLIENT_SECRET) {
      console.log(
        "⚠️  INTERCOM_CLIENT_SECRET chua duoc set - dang bo qua xac thuc chu ky (chi nen dung khi dev local)."
      );
    }
  });
}

module.exports = app;
