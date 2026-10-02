// Payments: one API whichever gateway is active. To take a payment anywhere in
// the app:
//
//   const res = await paymentsApi.initiate({ amount, purpose, customer, returnUrl });
//   await runPaymentAction(res.data.action);
//
// The browser is sent to the gateway and comes back to `returnUrl` with
// ?payment=paid|failed|pending&txn=<id>. The server has already verified the
// result with the gateway by then — never trust the query string alone; read
// paymentsApi.get(txn) if the outcome matters.
import { http } from "./client";

export const paymentsApi = {
  providers: () => http.get("/payment-gateways/providers"),
  gateways: () => http.get("/payment-gateways"),
  createGateway: (body) => http.post("/payment-gateways", body),
  updateGateway: (id, body) => http.patch(`/payment-gateways/${id}`, body),
  removeGateway: (id) => http.del(`/payment-gateways/${id}`),
  setActive: (id, active) => http.post(`/payment-gateways/${id}/activate`, { active }),
  testGateway: (id) => http.post(`/payment-gateways/${id}/test`, {}),
  initiate: (body) => http.post("/payments/initiate", body),
  list: (page = 1, perPage = 25) => http.get(`/payments?page=${page}&perPage=${perPage}`),
  get: (txnId) => http.get(`/payments/${txnId}`),
};

const loadScript = (src) =>
  new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error("Could not load the payment gateway's checkout script"));
    document.head.appendChild(s);
  });

// Carry out what the server said the browser must do to start the payment.
export async function runPaymentAction(action) {
  if (!action) throw new Error("No payment action");

  if (action.type === "redirect") {
    window.location.assign(action.url);
    return;
  }

  if (action.type === "form") {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = action.url;
    Object.entries(action.fields || {}).forEach(([name, value]) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.appendChild(input);
    });
    document.body.appendChild(form);
    form.submit();
    return;
  }

  if (action.type === "razorpay") {
    await loadScript("https://checkout.razorpay.com/v1/checkout.js");
    new window.Razorpay(action.options).open();
    return;
  }

  if (action.type === "cashfree") {
    await loadScript("https://sdk.cashfree.com/js/v3/cashfree.js");
    const cashfree = window.Cashfree({ mode: action.mode });
    await cashfree.checkout({ paymentSessionId: action.paymentSessionId, redirectTarget: "_self" });
    return;
  }

  throw new Error(`Unsupported payment action: ${action.type}`);
}
