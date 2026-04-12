export function formatPrice(price: number, currencyCode = "VND") {
  const normalizedCurrency = currencyCode.toUpperCase();
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: normalizedCurrency,
    currencyDisplay: "code",
  }).format(price);
}

export function formatDistant(value: number) {
  return `${new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value)} km`;
}
