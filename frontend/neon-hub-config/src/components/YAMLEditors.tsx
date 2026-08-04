import React, { useEffect, useState } from "react";
import Editor from "@monaco-editor/react";
import { dump, load } from "js-yaml";
import { RefreshCw, Save } from "lucide-react";
import { apiErrorMessage } from "../lib/utils";

interface ConfigEditorProps {
  title: string;
  baseUrl: string;
  endpoint: string;
  isDark: boolean;
}

const ConfigEditor: React.FC<ConfigEditorProps> = ({
  title,
  baseUrl,
  endpoint,
  isDark,
}) => {
  const [yamlContent, setYamlContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isValid, setIsValid] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const fetchConfig = async () => {
    setLoading(true);
    setError(null);
    try {
      // Add cache-busting timestamp to prevent caching
      const timestamp = new Date().getTime();
      const response = await fetch(
        `${baseUrl}${endpoint}?_=${timestamp}`,
        {
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            Pragma: "no-cache",
            Expires: "0",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to fetch ${title} configuration`);
      }

      const data = await response.json();
      const yamlString = dump(data, {
        indent: 2,
        lineWidth: -1,
        sortKeys: true,
      });

      setYamlContent(yamlString);
      setLastRefresh(new Date());
      setIsValid(true);
      setHasChanges(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Failed to fetch ${title} configuration`
      );
      console.error("Config fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!isValid) {
      setSaveError("Cannot save invalid YAML");
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const jsonData = load(yamlContent);

      const saveResponse = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
        body: JSON.stringify(jsonData),
      });

      if (!saveResponse.ok) {
        throw new Error(
          await apiErrorMessage(
            saveResponse,
            `Failed to save ${title} configuration`
          )
        );
      }

      await fetchConfig

      // Get the updated data from the save response
      const updatedData = await saveResponse.json();
      const updatedYaml = dump(updatedData, {
        indent: 2,
        lineWidth: -1,
        sortKeys: true,
      });

      setYamlContent(updatedYaml);
      setHasChanges(false);
      setLastRefresh(new Date());
    } catch (err) {
      setSaveError(
        err instanceof Error
          ? err.message
          : `Failed to save ${title} configuration`
      );
      console.error("Config save error:", err);
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, [endpoint]);

  const handleEditorChange = (value: string | undefined) => {
    if (!value) return;

    try {
      load(value); // Validate YAML
      setIsValid(true);
      setYamlContent(value);
      setHasChanges(true);
      setSaveError(null);
    } catch (e) {
      setIsValid(false);
    }
  };

  return (
    <div className={`mb-8 last:mb-0`}>
      <div className="mb-4 flex justify-between items-center">
        <h2
          className={`text-xl font-semibold ${
            isDark ? "text-orange-200" : "text-orange-800"
          }`}
        >
          {title}
        </h2>
      </div>

      <div className="mb-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button
            onClick={fetchConfig}
            disabled={loading}
            className={`
              flex items-center gap-2 px-4 py-2 rounded
              ${
                isDark
                  ? "bg-orange-600 hover:bg-orange-700"
                  : "bg-orange-500 hover:bg-orange-600"
              }
              text-white transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed
              focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-opacity-50
            `}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>

          <button
            onClick={saveConfig}
            disabled={saving || !isValid || !hasChanges}
            className={`
              flex items-center gap-2 px-4 py-2 rounded
              ${
                isDark
                  ? "bg-green-600 hover:bg-green-700"
                  : "bg-green-500 hover:bg-green-600"
              }
              text-white transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed
              focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50
            `}
          >
            <Save className={`h-4 w-4 ${saving ? "animate-spin" : ""}`} />
            {saving ? "Saving..." : "Save Changes"}
          </button>

          <div
            className={`flex items-center gap-2 ${
              isValid ? "text-green-500" : "text-red-500"
            }`}
          >
            <span className="h-2 w-2 rounded-full bg-current"></span>
            {isValid ? "Valid YAML" : "Invalid YAML"}
          </div>

          {hasChanges && (
            <div className="text-yellow-500 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-current"></span>
              Unsaved Changes
            </div>
          )}
        </div>

        {lastRefresh && (
          <span
            className={`text-sm ${isDark ? "text-gray-300" : "text-gray-600"}`}
          >
            Last refreshed: {lastRefresh.toLocaleString()}
          </span>
        )}
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-lg bg-red-500 text-white">{error}</div>
      )}

      {saveError && (
        <div className="mb-4 p-4 rounded-lg bg-red-500 text-white">
          {saveError}
        </div>
      )}

      <div
        className={`border rounded-lg overflow-hidden shadow-lg ${
          isDark ? "border-orange-400" : "border-orange-600"
        }`}
      >
        <Editor
          height="50vh"
          defaultLanguage="yaml"
          value={yamlContent}
          theme={isDark ? "vs-dark" : "vs-light"}
          onChange={handleEditorChange}
          options={{
            minimap: { enabled: true },
            lineNumbers: "on",
            fontSize: 14,
            wordWrap: "on",
            wrappingIndent: "indent",
            automaticLayout: true,
            scrollBeyondLastLine: false,
            tabSize: 2,
          }}
        />
      </div>
    </div>
  );
};

const YAMLEditors: React.FC<{ isDark: boolean, baseUrl: string }> = ({ isDark, baseUrl }) => {
  return (
    <div
      className={`p-4 ${isDark ? "bg-gray-900" : "bg-white"} ${
        isDark ? "text-white" : "text-gray-900"
      } min-h-screen`}
    >
      <div className="mb-4">
        <div className="flex items-center p-4 text-yellow-800 bg-yellow-100 border-l-4 border-yellow-500 dark:bg-yellow-900/30 dark:border-yellow-600 dark:text-yellow-200">
          <svg
            className="flex-shrink-0 w-4 h-4 mr-2"
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span>
            For advanced users only - you can directly edit neon.yaml and
            diana.yaml. <strong> Back up the contents before making changes!</strong>
          </span>
        </div>
      </div>
      <div className="container mx-auto">
        <ConfigEditor
          title="Neon Configuration"
          baseUrl={baseUrl}
          endpoint="/v1/neon_user_config"
          isDark={isDark}
        />
        <ConfigEditor
          title="Diana Configuration"
          baseUrl={baseUrl}
          endpoint="/v1/diana_config"
          isDark={isDark}
        />
      </div>
    </div>
  );
};

export default YAMLEditors;
