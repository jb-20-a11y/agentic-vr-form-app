import { loadFormSchema } from "@/lib/schemas/loader";
import FormContainer from "@/components/form/FormContainer";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ formId: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { formId } = await params;
  try {
    const schema = await loadFormSchema(formId);
    return {
      title: `${schema.title} | Agentic VR Form App`,
      description: schema.description || `Fill out ${schema.title}`,
    };
  } catch {
    return { title: "Form Not Found" };
  }
}

export default async function FormPage({ params }: Props) {
  const { formId } = await params;
  let formSchema;
  try {
    formSchema = await loadFormSchema(formId);
  } catch {
    notFound();
  }

  return <FormContainer formSchema={formSchema} />;
}
