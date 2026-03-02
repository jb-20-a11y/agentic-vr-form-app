import type { FormSchema } from "@/lib/types/form";
import path from "path";
import { promises as fs } from "fs";

const SCHEMAS_DIR = path.join(process.cwd(), "public", "schemas", "forms");

export async function loadFormSchema(formId: string): Promise<FormSchema> {
  const filePath = path.join(SCHEMAS_DIR, `${formId}.json`);
  const content = await fs.readFile(filePath, "utf-8");
  return JSON.parse(content) as FormSchema;
}

export async function listFormSchemas(): Promise<{ id: string; title: string }[]> {
  const files = await fs.readdir(SCHEMAS_DIR);
  const schemas: { id: string; title: string }[] = [];

  for (const file of files) {
    if (file.endsWith(".json")) {
      const content = await fs.readFile(path.join(SCHEMAS_DIR, file), "utf-8");
      const schema = JSON.parse(content) as FormSchema;
      schemas.push({ id: schema.id, title: schema.title });
    }
  }

  return schemas;
}
