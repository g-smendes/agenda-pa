export async function sendWhatsApp(number: string, text: string) {
  const { EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE } =
    process.env;
  if (!EVOLUTION_API_URL || !EVOLUTION_API_KEY || !EVOLUTION_INSTANCE) {
    return false;
  }

  try {
    const baseUrl = EVOLUTION_API_URL.replace(/\/+$/, "");
    const response = await fetch(
      `${baseUrl}/message/sendText/${encodeURIComponent(EVOLUTION_INSTANCE)}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: EVOLUTION_API_KEY,
        },
        body: JSON.stringify({ number: number.replace(/\D/g, ""), text }),
        signal: AbortSignal.timeout(5000),
      },
    );
    if (!response.ok) console.error("Falha no WhatsApp:", response.status);
    return response.ok;
  } catch {
    console.error("Falha ao conectar ao Evolution");
    return false;
  }
}
