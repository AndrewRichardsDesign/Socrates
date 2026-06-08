import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Preferences, UpdatePreferences } from "@shared/schema";

const STORAGE_KEY = "aristotle-preferences";
const DOC_PREFS_KEY = "aristotle-doc-preferences";

const DEFAULT_PREFERENCES: Preferences = {
  id: "local",
  wpm: 300,
  chunkSize: 1,
  columnWidth: 800,
  highlightStyle: "block",
  showTrail: false,
  useWindowMask: false,
  fontSize: 24,
  fontFamily: "Inter",
  fontWeight: "400",
  fontColor: "#000000",
  highlightColor: "#FFD700",
  useBionicReading: false,
  pauseOnSentence: false,
  sentencePauseFrequency: 1,
  sentencePauseDuration: 1000,
  pauseOnParagraph: false,
  paragraphPauseFrequency: 1,
  paragraphPauseDuration: 2000,
  maxWpm: null,
  updatedAt: new Date(),
};

function loadPreferences(): Preferences {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        ...DEFAULT_PREFERENCES,
        ...parsed,
        updatedAt: new Date(parsed.updatedAt || Date.now()),
      };
    }
  } catch (e) {
    console.warn("Failed to load preferences from localStorage:", e);
  }
  return DEFAULT_PREFERENCES;
}

function savePreferences(prefs: Preferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.warn("Failed to save preferences to localStorage:", e);
  }
}

export function usePreferences() {
  return useQuery({
    queryKey: ["preferences"],
    queryFn: async () => {
      return loadPreferences();
    },
    staleTime: Infinity,
  });
}

export function useUpdatePreferences() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdatePreferences }) => {
      const current = loadPreferences();
      const updated: Preferences = {
        ...current,
        ...data,
        updatedAt: new Date(),
      };
      savePreferences(updated);
      return updated;
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(["preferences"], updated);
    },
  });
}

// Document-specific preferences
export type DocumentPreferences = Omit<UpdatePreferences, 'id'>;

function loadAllDocPreferences(): Record<string, DocumentPreferences> {
  try {
    const stored = localStorage.getItem(DOC_PREFS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn("Failed to load document preferences:", e);
  }
  return {};
}

function saveAllDocPreferences(prefs: Record<string, DocumentPreferences>): void {
  try {
    localStorage.setItem(DOC_PREFS_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.warn("Failed to save document preferences:", e);
  }
}

export function loadDocumentPreferences(docId: string): DocumentPreferences | null {
  const allPrefs = loadAllDocPreferences();
  return allPrefs[docId] || null;
}

export function saveDocumentPreferences(docId: string, prefs: DocumentPreferences): void {
  const allPrefs = loadAllDocPreferences();
  allPrefs[docId] = prefs;
  saveAllDocPreferences(allPrefs);
}

export function deleteDocumentPreferences(docId: string): void {
  const allPrefs = loadAllDocPreferences();
  delete allPrefs[docId];
  saveAllDocPreferences(allPrefs);
}

export function hasDocumentPreferences(docId: string): boolean {
  const allPrefs = loadAllDocPreferences();
  return docId in allPrefs;
}
