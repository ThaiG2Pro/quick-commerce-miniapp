// src/medusa-client.ts
// @ts-ignore
import Medusa from "@medusajs/medusa-js";

const medusa = new Medusa({ 
  baseUrl: "https://q-commerce-backend-0qw1.onrender.com", 
  maxRetries: 3,
  // Dán mã mới vào đây:
  publishableApiKey: "pk_c4c2e2da3439360ceea472142d633c8c408ac63c99365de339faad78bc058805" 
});

export default medusa;