import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { API_BASE_URL } from "../components/HubManagementUI"
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Extract a user-facing message from an API error response. The backend
// sends {detail: {error, message}} for classified save failures and
// {detail: string} for plain HTTP errors; anything else gets the fallback.
export async function apiErrorMessage(
  response: Response,
  fallback: string
): Promise<string> {
  try {
    const detail = (await response.json())?.detail;
    if (typeof detail === "string" && detail) {
      return detail;
    }
    if (typeof detail?.message === "string") {
      return detail.message;
    }
  } catch {
    // Response body was not JSON
  }
  return fallback;
}
// API utilities
export const api = {
  // Method to update runtime configuration
  setBaseUrl: (baseUrl: string) => {
    localStorage.setItem('apiConfig', JSON.stringify({ baseUrl }));
    window.location.reload();
  },

  getBaseUrl: () => {
    try {
      const storedConfig = localStorage.getItem('apiConfig');
      if (storedConfig) {
        return JSON.parse(storedConfig).baseUrl;
      }
    } catch (e) {
      console.warn('Failed to load runtime config:', e);
    }
    return API_BASE_URL;
  },

  async fetchNeonConfig() {
    const response = await fetch(`${api.getBaseUrl()}/v1/neon_config`, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Neon config: ${response.statusText}`);
    }

    return response.json();
  },

  async fetchDianaConfig() {
    const response = await fetch(`${api.getBaseUrl()}/v1/diana_config`, {
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Diana config: ${response.statusText}`);
    }

    return response.json();
  },

  async saveNeonConfig(config: object) {
    const response = await fetch(`${api.getBaseUrl()}/v1/neon_config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      throw new Error(
        await apiErrorMessage(response, "Failed to save Neon configuration")
      );
    }

    return response.json();
  },

  async saveDianaConfig(config: object) {
    const response = await fetch(`${api.getBaseUrl()}/v1/diana_config`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(config),
    });

    if (!response.ok) {
      throw new Error(
        await apiErrorMessage(response, "Failed to save Diana configuration")
      );
    }

    return response.json();
  }
};
