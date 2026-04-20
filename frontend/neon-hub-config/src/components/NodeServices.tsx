import React, { useState } from "react";
import { QRCodeSVG } from "qrcode.react";

interface NodeServicesProps {
  isDark: boolean;
}

interface PairingData {
  hub_address: string;
  access_token: string;
  refresh_token: string;
}

const NodeServices: React.FC<NodeServicesProps> = ({ isDark }) => {
  console.debug("NodeServicesProps", isDark);
  const [pairing, setPairing] = useState<PairingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generatePairing = async () => {
    setLoading(true);
    setError(null);
    setPairing(null);

    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch("/v1/pair", {
        method: "POST",
        headers: {
          Authorization: `Basic ${token}`,
        },
      });

      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail.detail || `Failed to create pairing (${response.status})`);
      }

      const data: PairingData = await response.json();
      setPairing(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create pairing");
    } finally {
      setLoading(false);
    }
  };

  const qrPayload = pairing
    ? JSON.stringify({
        version: 1,
        hub_address: pairing.hub_address,
        access_token: pairing.access_token,
        refresh_token: pairing.refresh_token,
      })
    : "";

  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">
        Node Services
      </h2>

      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2 text-gray-700 dark:text-gray-200">
          Connect a Node
        </h3>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Generate a QR code to connect a Neon Node to this Hub.
          Scan the code from the Neon Node app to connect automatically.
        </p>

        <button
          onClick={generatePairing}
          disabled={loading}
          className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-500 text-white font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors"
        >
          {loading ? "Generating..." : pairing ? "Generate New Code" : "Generate QR Code"}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-md">
          <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
        </div>
      )}

      {pairing && (
        <div className="space-y-4">
          <div className="flex flex-col items-center p-6 bg-white rounded-lg border border-gray-200 dark:border-gray-600">
            <QRCodeSVG
              value={qrPayload}
              size={300}
              level="L"
              marginSize={2}
            />
            <p className="mt-3 text-sm text-gray-500">
              Scan with the Neon Node app
            </p>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              <span className="text-gray-400">Hub:</span>{" "}
              <span className="font-mono">{pairing.hub_address}</span>
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Each QR code contains a unique token scoped to Node-level
              permissions. Generate a new code for each device.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default NodeServices;
