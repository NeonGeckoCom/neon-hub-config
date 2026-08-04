import React, { useEffect, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import { api } from "../lib/utils";

interface SkillsProps {
  isDark: boolean;
}

interface SkillsState {
  installed: string[];
  blacklisted: string[];
}

// "skill-date_time.neongeckocom" -> "Date Time"
const skillDisplayName = (skillId: string) => {
  const base = skillId.split(".")[0].replace(/^(neon[-_])?skill[-_]/i, "");
  return base
    .split(/[-_]/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const Skills: React.FC<SkillsProps> = ({ isDark }) => {
  const [installed, setInstalled] = useState<string[]>([]);
  const [blacklisted, setBlacklisted] = useState<string[]>([]);
  const [savedBlacklist, setSavedBlacklist] = useState<string[]>([]);
  const [customSkillId, setCustomSkillId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  const applyState = (data: SkillsState) => {
    setInstalled(data.installed || []);
    setBlacklisted(data.blacklisted || []);
    setSavedBlacklist(data.blacklisted || []);
  };

  const fetchSkills = async () => {
    setLoading(true);
    setError(null);
    try {
      applyState(await api.fetchSkills());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch skills");
      console.error("Skills fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSkills();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasChanges =
    JSON.stringify([...blacklisted].sort()) !==
    JSON.stringify([...savedBlacklist].sort());

  const saveSkills = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      applyState(await api.saveSkillsBlacklist(blacklisted));
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to save skills"
      );
      console.error("Skills save error:", err);
    } finally {
      setSaving(false);
    }
  };

  const toggleSkill = (skillId: string) => {
    setBlacklisted((prev) =>
      prev.includes(skillId)
        ? prev.filter((id) => id !== skillId)
        : [...prev, skillId]
    );
  };

  const disableCustomSkill = () => {
    const skillId = customSkillId.trim();
    if (!skillId || blacklisted.includes(skillId)) return;
    setBlacklisted((prev) => [...prev, skillId]);
    setCustomSkillId("");
  };

  const borderColor = isDark ? "border-orange-400" : "border-orange-600";
  const cardBgColor = isDark ? "bg-gray-800" : "bg-orange-100";
  const bgColor = isDark ? "bg-gray-900" : "bg-white";

  // Show every installed skill plus any blacklisted entries that are not
  // in the installed list (so they can still be re-enabled).
  const allSkills = [
    ...installed,
    ...blacklisted.filter((id) => !installed.includes(id)),
  ].sort();

  return (
    <div className={`mb-4 border ${borderColor} rounded-lg overflow-hidden`}>
      <div className={`${cardBgColor} p-4 flex justify-between items-center`}>
        <h2
          className={`text-xl font-semibold ${
            isDark ? "text-orange-200" : "text-orange-800"
          }`}
        >
          Skills
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchSkills}
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
            onClick={saveSkills}
            disabled={saving || !hasChanges}
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
              className={`h-4 w-4 ${saving ? "animate-spin" : ""}`}
            />
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>

      {error && <div className="p-4 bg-red-500 text-white">{error}</div>}
      {saveError && <div className="p-4 bg-red-500 text-white">{saveError}</div>}

      <div className={`${bgColor} p-4`}>
        <p className="text-sm mb-4">
          Skills come pre-installed with your Neon Hub. Disabled skills are
          added to <code>skills.blacklisted_skills</code> in neon.yaml and will
          not be loaded. Changes may require a restart of Neon services to take
          effect.
        </p>

        {loading && !allSkills.length ? (
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Loading skills...
          </div>
        ) : allSkills.length ? (
          <ul className="divide-y divide-gray-500/20">
            {allSkills.map((skillId) => {
              const enabled = !blacklisted.includes(skillId);
              return (
                <li
                  key={skillId}
                  className="py-2 flex items-center justify-between gap-4"
                >
                  <div>
                    <span className="block font-medium">
                      {skillDisplayName(skillId)}
                      {!installed.includes(skillId) && (
                        <span className="ml-2 text-xs text-gray-400">
                          (not installed)
                        </span>
                      )}
                    </span>
                    <span className="block text-xs font-mono text-gray-400">
                      {skillId}
                    </span>
                  </div>
                  <button
                    role="switch"
                    aria-checked={enabled}
                    aria-label={`${enabled ? "Disable" : "Enable"} ${skillDisplayName(skillId)}`}
                    onClick={() => toggleSkill(skillId)}
                    className={`
                      relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full
                      transition-colors focus:outline-none focus:ring-2
                      focus:ring-orange-500 focus:ring-opacity-50
                      ${enabled ? "bg-green-500" : "bg-gray-400"}
                    `}
                  >
                    <span
                      className={`
                        inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                        ${enabled ? "translate-x-6" : "translate-x-1"}
                      `}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-gray-400">
            No skills found. Skills appear here after they have been loaded at
            least once by your Neon Hub.
          </p>
        )}

        <div className="mt-4">
          <label className="block text-sm font-medium mb-1">
            Disable a skill not listed above
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={customSkillId}
              onChange={(e) => setCustomSkillId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && disableCustomSkill()}
              placeholder="skill-id.author"
              className={`w-full p-2 rounded ${
                isDark ? "bg-gray-700 text-white" : "bg-white text-gray-900"
              } border ${borderColor}`}
            />
            <button
              onClick={disableCustomSkill}
              disabled={!customSkillId.trim()}
              className={`
                flex items-center gap-2 px-4 py-2 rounded whitespace-nowrap
                ${
                  isDark
                    ? "bg-orange-600 hover:bg-orange-700"
                    : "bg-orange-500 hover:bg-orange-600"
                }
                text-white transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              <Plus className="h-4 w-4" />
              Disable
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Skills;
