import React, { useState, useEffect } from "react";
import { RefreshCw, ExternalLink, ArrowUp } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip";
import SecretField from "./SecretField";
import { api } from "../lib/utils";

// Build-time configuration with runtime fallback
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;

interface TooltipInterface {
  [key: string]: string;
}

const GENERAL_SETTINGS = [
  "log_level",
  "lang",
  "time_format",
  "system_unit",
] as const;

const TOOLTIPS: TooltipInterface = {
  log_level:
    "The level of logging to be used by the backend. Supports Python logging levels.",
  system_unit:
    "The system of measurement to be used by the backend. Options: metric, imperial (typically U.S.).",
  time_format:
    "The format for displaying time. Options: half (12-hour format), full (24-hour format).",
  lang: "The language/country code to be used by the backend. Must be a language code supported by the Python langcodes library.",
  default_lang: "The default language to be used by the IRIS web interface.",
  languages: "The languages supported by the IRIS web interface.",
  webui_chatbot_label: "The title in the IRIS web interface.",
  webui_mic_label:
    "The label for the microphone button in the IRIS web interface.",
  webui_input_placeholder:
    "The placeholder text for the chat input in the IRIS web interface.",
  webui_ws_url:
    "The WebSocket URL for the IRIS web interface, e.g. wss://<your-hub-ip>/ws. Must be wss for IRIS websat.",
  fastapi_title: "The title of the HANA instance.",
  fastapi_summary: "The summary text of the HANA instance.",
  enable_email:
    "Whether to enable email functionality in the backend. Requires advanced manual configuration.",
  node_username: "The username for connecting a Neon Node to your Neon Hub.",
  node_password: "The password for connecting a Neon Node to your Neon Hub.",
};

type ConfigSectionValue = string | number | string[] | boolean | object;

type ConfigSection = {
  [key: string]: ConfigSectionValue;
};

interface Config {
  lang?: string;
  secondary_langs?: string[];
  system_unit?: "metric" | "imperial";
  time_format?: "half" | "full";
  hana?: ConfigSection;
  MQ?: ConfigSection;
  iris?: ConfigSection;
  websocket?: ConfigSection;
  general?: ConfigSection;
  log_level?: string;
  skills?: {
    default_skills: string[];
    extra_dependencies: {
      [key: string]: string[];
    };
  };
  api_keys?: ConfigSection;
  [key: string]: unknown;
}

interface HubManagementUIProps {
  isDark: boolean;
}

interface SavingStates {
  [key: string]: boolean;
}

interface SaveErrors {
  [key: string]: string | null;
}

const BaseUrlConfig: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  const [baseUrl, setBaseUrl] = useState(api.getBaseUrl());
  const [isEditing, setIsEditing] = useState(false);

  const handleSave = () => {
    api.setBaseUrl(baseUrl);
    setIsEditing(false);
  };

  const baseInputClass = `w-full p-2 rounded ${
    isDark ? "bg-gray-700" : "bg-white"
  } ${isDark ? "text-white" : "text-gray-900"} border ${
    isDark ? "border-orange-400" : "border-orange-600"
  }`;

  return (
    <div className={`mb-4 border ${isDark ? "border-orange-400" : "border-orange-600"} rounded-lg p-4`}>
      <div className="flex items-center justify-between">
        <h3 className={`text-lg font-medium ${isDark ? "text-orange-200" : "text-orange-800"}`}>
          API Configuration (Advanced)
        </h3>
        <button
          onClick={() => setIsEditing(!isEditing)}
          className={`px-3 py-1 rounded ${
            isDark ? "bg-orange-600 hover:bg-orange-700" : "bg-orange-500 hover:bg-orange-600"
          } text-white`}
        >
          {isEditing ? "Cancel" : "Edit"}
        </button>
      </div>
      {isEditing ? (
        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            className={baseInputClass}
            placeholder="Enter API base URL"
          />
          <button
            onClick={handleSave}
            className={`px-4 py-2 rounded ${
              isDark ? "bg-orange-600 hover:bg-orange-700" : "bg-orange-500 hover:bg-orange-600"
            } text-white`}
          >
            Save
          </button>
        </div>
      ) : (
        <div>
        <p className="mt-2">Current API Base URL: {baseUrl}</p>
        <p className="mt-2">Usually, this will match what you connect to from your browser. Only try to change if config fails to load!</p>
        </div>
      )}
    </div>
  );
};

const snakeCaseToTitle = (str: string) =>
  str
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

const HubManagementUI: React.FC<HubManagementUIProps> = ({ isDark }) => {
  const [config, setConfig] = useState<Config>({
    system_unit: "imperial",
    time_format: "half",
    lang: "en-us",
    log_level: "INFO",
    hana: {},
    iris: {},
    skills: { default_skills: [], extra_dependencies: {} },
    api_keys: {alpha_vantage: "", open_weather_map: "", wolfram_alpha: ""},
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [savingStates, setSavingStates] = useState<SavingStates>({});
  const [saveError, setSaveErrors] = useState<SaveErrors>({});
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 200);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const fetchConfig = async () => {
    console.debug("Fetching config...");
    setLoading(true);
    setError(null);
    try {
      const [neonData, dianaData] = await Promise.all([
        api.fetchNeonConfig(),
        api.fetchDianaConfig()
      ]);

      setConfig((prev) => ({
        ...prev,
        ...dianaData,
        ...neonData,
      }));

      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch configuration");
      console.error("Config fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const saveConfigSection = async (sectionKey: string) => {
    setSavingStates((prev) => ({ ...prev, [sectionKey]: true }));
    setSaveErrors((prev) => ({ ...prev, [sectionKey]: null }));

    try {
      if (sectionKey === "iris" || sectionKey === "hana") {
        const dianaConfig = { iris: config.iris, hana: config.hana };
        await api.saveDianaConfig(dianaConfig);
      } else {
        const configToSave =
          sectionKey === "general"
            ? GENERAL_SETTINGS.reduce(
                (acc, key) => ({
                  ...acc,
                  [key]: config[key],
                }),
                {}
              )
            : { [sectionKey]: config[sectionKey as keyof Config] };

        const neonData = await api.saveNeonConfig(configToSave);
        setConfig((prev) => ({
          ...prev,
          ...neonData,
        }));
      }
      setLastRefresh(new Date());
    } catch (err) {
      setSaveErrors((prev) => ({
        ...prev,
        [sectionKey]: err instanceof Error ? err.message : `Failed to save ${sectionKey} configuration`,
      }));
    } finally {
      setSavingStates((prev) => ({ ...prev, [sectionKey]: false }));
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleConfigChange = (
    section: keyof Config,
    key: string,
    value: ConfigSectionValue
  ) => {
    setConfig((prev) => {
      if (section === "general") {
        return {
          ...prev,
          [key]: value,
        };
      }
      const currentSection = prev[section] as ConfigSection;
      return {
        ...prev,
        [section]: {
          ...currentSection,
          [key]: value,
        },
      };
    });
  };

  const isSecret = (section: keyof Config | string, key: string): boolean => {
    const isSensitiveKey =
      key.includes("password") ||
      key.includes("secret") ||
      key.includes("api_key");

    const isApiKeysSection = section === "api_keys";

    return isSensitiveKey || isApiKeysSection;
  };

  const renderInputField = (
    section: keyof Config | string,
    key: string,
    value: unknown
  ) => {
    const baseInputClass = `w-full p-2 rounded ${
      isDark ? "bg-gray-700" : "bg-white"
    } ${isDark ? "text-white" : "text-gray-900"} border ${
      isDark ? "border-orange-400" : "border-orange-600"
    }`;

    if (typeof value === "object" && value !== null) {
      if (Array.isArray(value)) {
        return (
          <input
            type="text"
            value={value.join(", ")}
            onChange={(e) =>
              handleConfigChange(
                section,
                key,
                e.target.value.split(",").map((item) => item.trim())
              )
            }
            className={baseInputClass}
          />
        );
      }
      return (
        <textarea
          value={JSON.stringify(value, null, 2)}
          onChange={(e) => {
            try {
              const parsed = JSON.parse(e.target.value);
              handleConfigChange(section, key, parsed);
            } catch (err) {
              console.error(err);
              handleConfigChange(section, key, e.target.value);
            }
          }}
          className={`${baseInputClass} font-mono text-sm`}
          rows={Object.keys(value).length + 1}
        />
      );
    }

    if (isSecret(section, key)) {
      return (
        <SecretField
          value={value as string}
          onChange={(e) => handleConfigChange(section, key, e.target.value)}
          className={baseInputClass}
          isDark={isDark}
        />
      );
    }

    if (key === "log_level") {
      return (
        <select
          value={value as string}
          onChange={(e) => handleConfigChange(section, key, e.target.value)}
          className={baseInputClass}
        >
          {["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"].map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
      );
    }

    if (key === "system_unit") {
      return (
        <select
          value={value as string}
          onChange={(e) => handleConfigChange(section, key, e.target.value)}
          className={baseInputClass}
        >
          <option value="metric">Metric</option>
          <option value="imperial">Imperial</option>
        </select>
      );
    }

    if (key === "time_format") {
      return (
        <select
          value={value as string}
          onChange={(e) => handleConfigChange(section, key, e.target.value)}
          className={baseInputClass}
        >
          <option value="half">12-hour (HH:MM am/pm)</option>
          <option value="full">24-hour (HH:MM)</option>
        </select>
      );
    }

    return (
      <input
        type={typeof value === "number" ? "number" : "text"}
        value={value as string | number}
        onChange={(e) => handleConfigChange(section, key, e.target.value)}
        className={baseInputClass}
      />
    );
  };

  const bgColor = isDark ? "bg-gray-900" : "bg-white";
  const textColor = isDark ? "text-white" : "text-gray-900";
  const borderColor = isDark ? "border-orange-400" : "border-orange-600";
  const cardBgColor = isDark ? "bg-gray-800" : "bg-orange-100";
  const linkColor = isDark ? "text-orange-400" : "text-orange-600";

  const renderConfigSection = (
    section: keyof Config,
    data: ConfigSection | string | object,
    title: string
  ) => {
    const sectionKey = section.toString();
    return (
      <div className={`mb-4 border ${borderColor} rounded-lg overflow-hidden`}>
        <div className={`${cardBgColor} p-4 flex justify-between items-center`}>
          <h2
            className={`text-xl font-semibold ${
              isDark ? "text-orange-200" : "text-orange-800"
            }`}
          >
            {title}
          </h2>
          <button
            onClick={() => saveConfigSection(sectionKey)}
            disabled={savingStates[sectionKey]}
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
            <RefreshCw
              className={`h-4 w-4 ${
                savingStates[sectionKey] ? "animate-spin" : ""
              }`}
            />
            {savingStates[sectionKey] ? "Saving..." : "Save Changes"}
          </button>
        </div>
        {saveError[section] && (
          <div className="p-4 bg-red-500 text-white">{saveError[section]}</div>
        )}

        <div className={`${bgColor} p-4`}>
          {Object.entries(data).map(([key, value]) => (
            <div key={key} className="mb-4">
              {TOOLTIPS[key] ? (
                <TooltipProvider>
                  <Tooltip>
                  <TooltipTrigger asChild onClick={(e: React.MouseEvent<HTMLButtonElement>) => e.preventDefault()}>
                      <label className="block text-sm font-medium mb-1 cursor-help">
                        {snakeCaseToTitle(key.toLowerCase())}
                        <span className="ml-1 text-gray-400">ⓘ</span>
                      </label>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      className="max-w-xs p-2 text-sm"
                      sideOffset={5}
                    >
                      <p>{TOOLTIPS[key]}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <label className="block text-sm font-medium mb-1">
                  {snakeCaseToTitle(key.toLowerCase())}
                </label>
              )}
              {renderInputField(section, key, value)}
              {(key === "log_level" ||
                key === "lang" ||
                section === "api_keys") && (
                <a
                  href={
                    key === "log_level"
                      ? "https://docs.python.org/3/library/logging.html#logging-levels"
                      : key === "lang"
                      ? "https://langcodes-hickford.readthedocs.io/en/sphinx/index.html#standards-implemented"
                      : section === "api_keys"
                      ? key === "alpha_vantage"
                        ? "https://www.alphavantage.co/support/#api-key"
                        : key === "open_weather_map"
                        ? "https://home.openweathermap.org/appid"
                        : key === "wolfram_alpha"
                        ? "https://products.wolframalpha.com/api/"
                        : "#"
                      : "#"
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`text-sm ${linkColor} hover:underline flex items-center mt-1`}
                >
                  {key === "log_level"
                    ? "View log level documentation"
                    : key === "lang"
                    ? "View library documentation for language/country codes"
                    : section === "api_keys"
                    ? `Get ${snakeCaseToTitle(key)} API key`
                    : ""}{" "}
                  <ExternalLink className="ml-1 h-3 w-3" />
                </a>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading && !lastRefresh) {
    return (
      <div
        className={`p-4 ${bgColor} ${textColor} min-h-screen flex items-center justify-center`}
      >
        <RefreshCw className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className={`p-4 ${bgColor} ${textColor} min-h-screen relative`}>
      <div className="container mx-auto">
        <div className="mb-4 flex justify-between items-center">
          <button
            onClick={fetchConfig}
            disabled={loading}
            className={`flex items-center p-2 rounded ${
              isDark
                ? "bg-orange-600 hover:bg-orange-700"
                : "bg-orange-500 hover:bg-orange-600"
            } text-white ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`}
            />
            Refresh Configuration
          </button>
          {lastRefresh && (
            <span className="text-sm">
              Last refreshed: {lastRefresh.toLocaleString()}
            </span>
          )}
        </div>
        {error && (
          <div className={`mb-4 p-4 rounded-lg bg-red-500 text-white`}>
            {error}
          </div>
        )}
        
        {renderConfigSection(
          "general",
          GENERAL_SETTINGS.reduce(
            (acc, key) => ({
              ...acc,
              [key]: config[key],
            }),
            {}
          ),
          "General Configuration"
        )}
        {renderConfigSection(
          "api_keys",
          config.api_keys || {},
          "External API Keys"
        )}
        {renderConfigSection("hana", config.hana || {}, "HANA Configuration")}
        {renderConfigSection("iris", config.iris || {}, "IRIS Configuration")}
        <BaseUrlConfig isDark={isDark} />
      </div>
      <button
        onClick={scrollToTop}
        className={`
          fixed bottom-4 right-4 p-2 rounded-full
          ${showScrollTop ? "opacity-100" : "opacity-0 pointer-events-none"}
          ${
            isDark
              ? "bg-orange-600 hover:bg-orange-700"
              : "bg-orange-500 hover:bg-orange-600"
          }
          text-white transition-all duration-300 ease-in-out
          focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-opacity-50
          shadow-lg hover:shadow-xl
        `}
        aria-label="Scroll to top"
      >
        <ArrowUp className="h-4 w-4" />
      </button>
    </div>
  );
};

export default HubManagementUI;
