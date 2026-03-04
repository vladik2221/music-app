import fetch from 'node-fetch';
import { idempotenceKey } from './utils.js';

const SHOP_ID = process.env.YOOKASSA_SHOP_ID;
const SECRET_KEY = process.env.YOOKASSA_SECRET_KEY;

function authHeader() {
  const token = Buffer.from(`${SHOP_ID}:${SECRET_KEY}`).toString('base64');
  return `Basic ${token}`;
}

export async function createYooKassaPayment({ amountRub, returnUrl, description, metadata }) {
  const resp = await fetch('https://api.yookassa.ru/v3/payments', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotence-Key': idempotenceKey(),
      'Authorization': authHeader()
    },
    body: JSON.stringify({
      amount: { value: amountRub, currency: 'RUB' },
      confirmation: { type: 'redirect', return_url: returnUrl },
      capture: true,
      description,
      metadata
    })
  });

  const json = await resp.json();
  if (!resp.ok) {
    const msg = json?.description || json?.message || JSON.stringify(json);
    throw new Error(`YooKassa create payment failed: ${resp.status} ${msg}`);
  }
  return json;
}

export async function getYooKassaPayment(paymentId) {
  const resp = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
    method: 'GET',
    headers: { 'Authorization': authHeader() }
  });
  const json = await resp.json();
  if (!resp.ok) {
    const msg = json?.description || json?.message || JSON.stringify(json);
    throw new Error(`YooKassa get payment failed: ${resp.status} ${msg}`);
  }
  return json;
}
