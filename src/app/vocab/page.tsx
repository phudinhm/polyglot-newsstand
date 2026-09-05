import { VocabClient } from "@/components/VocabClient";

export const metadata = {
  title: "Vocabulary",
  description: "Every word you saved while reading, with the sentence it came from.",
};

export default function VocabPage() {
  return <VocabClient />;
}
