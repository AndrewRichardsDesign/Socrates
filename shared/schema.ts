import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, boolean, timestamp, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Documents table - stores user-uploaded documents
export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  content: text("content").notNull(),
  fileType: varchar("file_type").notNull().default('txt'),
  source: varchar("source").notNull().default('upload'),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
});

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

// User preferences table - stores reading settings
export const preferences = pgTable("preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  wpm: integer("wpm").notNull().default(300),
  chunkSize: integer("chunk_size").notNull().default(1),
  columnWidth: integer("column_width").notNull().default(800),
  highlightStyle: varchar("highlight_style").notNull().default('block'),
  showTrail: boolean("show_trail").notNull().default(false),
  useWindowMask: boolean("use_window_mask").notNull().default(false),
  fontSize: real("font_size").notNull().default(24),
  fontFamily: varchar("font_family").notNull().default('Inter'),
  fontWeight: varchar("font_weight").notNull().default('400'),
  fontColor: varchar("font_color").notNull().default('#000000'),
  highlightColor: varchar("highlight_color").notNull().default('#FFD700'),
  useBionicReading: boolean("use_bionic_reading").notNull().default(false),
  pauseOnSentence: boolean("pause_on_sentence").notNull().default(false),
  sentencePauseFrequency: integer("sentence_pause_frequency").notNull().default(1),
  sentencePauseDuration: integer("sentence_pause_duration").notNull().default(1000),
  pauseOnParagraph: boolean("pause_on_paragraph").notNull().default(false),
  paragraphPauseFrequency: integer("paragraph_pause_frequency").notNull().default(1),
  paragraphPauseDuration: integer("paragraph_pause_duration").notNull().default(2000),
  maxWpm: integer("max_wpm"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPreferencesSchema = createInsertSchema(preferences).omit({
  id: true,
  updatedAt: true,
});

export const updatePreferencesSchema = createInsertSchema(preferences).omit({
  id: true,
  updatedAt: true,
}).partial();

export type InsertPreferences = z.infer<typeof insertPreferencesSchema>;
export type UpdatePreferences = z.infer<typeof updatePreferencesSchema>;
export type Preferences = typeof preferences.$inferSelect;
