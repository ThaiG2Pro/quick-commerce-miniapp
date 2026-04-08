import Medusa from "@medusajs/medusa-js";

const medusa = new Medusa({
  baseUrl: "https://q-commerce-backend-0qw1.onrender.com",
  maxRetries: 3,
  // 1. DÁN CHẾT CÁI KEY VÀO ĐÂY (NHỚ BỌC TRONG DẤU NGOẶC KÉP)
  publishableApiKey: "pk_c4c2e2da3439360ceea472142d633c8c408ac63c99365de339faad78bc058805", 
  customHeaders: {
    "ngrok-skip-browser-warning": "true",
  }
});

export default medusa;