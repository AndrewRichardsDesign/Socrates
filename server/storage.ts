import { documents, preferences, type Document, type InsertDocument, type Preferences, type InsertPreferences, type UpdatePreferences } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  // Documents
  getAllDocuments(): Promise<Document[]>;
  getDocument(id: string): Promise<Document | undefined>;
  createDocument(doc: InsertDocument): Promise<Document>;
  updateDocument(id: string, content: string, title: string): Promise<Document | undefined>;
  deleteDocument(id: string): Promise<boolean>;
  
  // Preferences
  getPreferences(): Promise<Preferences | undefined>;
  createPreferences(prefs: InsertPreferences): Promise<Preferences>;
  updatePreferences(id: string, prefs: UpdatePreferences): Promise<Preferences | undefined>;
}

export class DatabaseStorage implements IStorage {
  // Documents
  async getAllDocuments(): Promise<Document[]> {
    return await db.select().from(documents).orderBy(desc(documents.createdAt));
  }

  async getDocument(id: string): Promise<Document | undefined> {
    const [doc] = await db.select().from(documents).where(eq(documents.id, id));
    return doc || undefined;
  }

  async createDocument(insertDoc: InsertDocument): Promise<Document> {
    const [doc] = await db
      .insert(documents)
      .values(insertDoc)
      .returning();
    return doc;
  }

  async updateDocument(id: string, content: string, title: string): Promise<Document | undefined> {
    const [doc] = await db
      .update(documents)
      .set({ content, title })
      .where(eq(documents.id, id))
      .returning();
    return doc || undefined;
  }

  async deleteDocument(id: string): Promise<boolean> {
    const result = await db.delete(documents).where(eq(documents.id, id));
    return result.rowCount ? result.rowCount > 0 : false;
  }

  // Preferences
  async getPreferences(): Promise<Preferences | undefined> {
    const [prefs] = await db.select().from(preferences).limit(1);
    return prefs || undefined;
  }

  async createPreferences(insertPrefs: InsertPreferences): Promise<Preferences> {
    const [prefs] = await db
      .insert(preferences)
      .values(insertPrefs)
      .returning();
    return prefs;
  }

  async updatePreferences(id: string, updatePrefs: UpdatePreferences): Promise<Preferences | undefined> {
    const [prefs] = await db
      .update(preferences)
      .set({ ...updatePrefs, updatedAt: new Date() })
      .where(eq(preferences.id, id))
      .returning();
    return prefs || undefined;
  }
}

export const storage = new DatabaseStorage();
