const CONFIG = {
  STORAGE_KEYS: {
    USER_INFO: "userInfo",
    MEDUSA_AUTH_TOKEN: "medusaAuthToken",
    GUEST_EMAIL: "guestEmail",
    DELIVERY: "delivery",
    SHIPPING_ADDRESS: "shippingAddress",
    BILLING_ADDRESS: "billingAddress",
    CART_ID: "medusaCartId",
    SHIPPING_OPTION_ID: "medusaShippingOptionId",
    PAYMENT_PROVIDER_ID: "medusaPaymentProviderId",
    // Flag to mark that the app has performed its initial bootstrap run.
    // Used to clear stale auth only once on first load to avoid logging out
    // returning users on subsequent visits.
    BOOTSTRAPPED: "appBootstrapped",
  },
};

export default CONFIG;
