import { OpenAIEmbeddings, ChatOpenAI } from "@langchain/openai";
import { Chroma } from "langchain/vectorstores/chroma";
import { RetrievalQAChain } from "langchain/chains";

let vectorStore;

export async function loadKnowledgeBase(docs) {
  const embeddings = new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY,
  });

  vectorStore = await Chroma.fromTexts(docs, docs.map(() => ({})), embeddings);
  console.log("📚 Knowledge base loaded (" + docs.length + " chunks)");
}

export async function getAnswerFromKnowledgeBase(query) {
  if (!vectorStore) return "Knowledge base belum dimuat.";

  const llm = new ChatOpenAI({
    modelName: "gpt-4o-mini",
    openAIApiKey: process.env.OPENAI_API_KEY,
  });

  const chain = RetrievalQAChain.fromLLM(llm, vectorStore.asRetriever());
  const response = await chain.call({ query });
  return response.text;
}
