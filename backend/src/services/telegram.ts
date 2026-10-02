export async function notifyTelegram(request: {
  id: number;
  client: { name: string };
  car: { brand: string; model: string };
  service: { name: string };
}) {
  const token = process.env.TELEGRAM_BOT_TOKEN,
    chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: `Новая заявка #${request.id}\n${request.client.name}\n${request.car.brand} ${request.car.model}\n${request.service.name}`,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) console.error('Telegram notification failed:', response.status);
  } catch {
    console.error('Telegram is unavailable. Request remains saved.');
  }
}
