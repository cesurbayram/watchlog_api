const MOTO_BASE_URL = process.env.MOTO_SERVER_URL || "http://localhost:8082";

export async function motoFetchFile(
  controllerId: string,
  fileName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${MOTO_BASE_URL}/api/general-file-save-socket`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ controllerId, fileName }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        success: false,
        error: (err as { message?: string }).message || "Moto request failed",
      };
    }
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
