const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export async function apiFetch(path: string, options?: RequestInit) {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options?.headers as Record<string, string>),
  };
  if (token && !headers["Authorization"]) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  // Ensure trailing slash to avoid 307 redirects from FastAPI
  const normalizedPath = path.endsWith("/") ? path : `${path}/`;
  const res = await fetch(`${API_URL}${normalizedPath}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const message = body?.detail || `API error: ${res.status}`;
    throw new Error(message);
  }

  return res.json();
}

export async function apiStream(path: string, body: unknown, token?: string) {
  const t = token || getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (t) headers["Authorization"] = `Bearer ${t}`;

  const normalizedPath = path.endsWith("/") ? path : `${path}/`;
  const res = await fetch(`${API_URL}${normalizedPath}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return res.body;
}
