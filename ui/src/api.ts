import type { LoginMode, MagicLinkRequestResponse, SessionResponse } from "./types";

const defaultBaseUrl = "http://localhost:3050";

export const apiBaseUrl = (
  import.meta.env.VITE_API_BASE_URL as string | undefined
)?.replace(/\/$/, "") ?? defaultBaseUrl;

async function request<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {})
    }
  });

  const data: unknown = await response.json();

  if (!response.ok) {
    if (
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof data.error === "string"
    ) {
      throw new Error(data.error);
    }

    throw new Error("Request failed.");
  }

  return data as T;
}

export async function login(input: {
  mode: LoginMode;
  email: string;
  password?: string;
  token?: string;
}) {
  if (input.mode === "insured") {
    let token = input.token?.trim();

    if (!token) {
      const requestResult = await request<MagicLinkRequestResponse>("/api/auth/magic-link/request", {
        method: "POST",
        body: JSON.stringify({
          email: input.email
        })
      });

      token = requestResult.debugToken;
    }

    return request<SessionResponse>("/api/auth/magic-link/exchange", {
      method: "POST",
      body: JSON.stringify({
        email: input.email,
        token
      })
    });
  }

  return request<SessionResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: input.email,
      password: input.password
    })
  });
}

export function getWithToken<T>(path: string, token: string) {
  return request<T>(path, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}

export function postWithToken<T>(path: string, token: string, body: unknown) {
  return request<T>(path, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });
}

export function patchWithToken<T>(path: string, token: string, body: unknown) {
  return request<T>(path, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });
}

export function putWithToken<T>(path: string, token: string, body: unknown) {
  return request<T>(path, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });
}

export function deleteWithToken<T>(path: string, token: string) {
  return request<T>(path, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${token}`
    }
  });
}
