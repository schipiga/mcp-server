import { openai } from "@llamaindex/openai";
import { mcp } from "@llamaindex/tools";
import { agent } from "@llamaindex/workflow";

async function main() {
    const server = mcp({
        command: "npx",
        args: ["-y", "github:schipiga/mcp-server"],
        env: {
            PIPEDRIVE_API_KEY: process.env.PIPEDRIVE_API_KEY,
            PATH: process.env.PATH,
        },
        verbose: true,
    });

    try {
        const myAgent = agent({
            name: "Assistant",
            systemPrompt: "Use the tools to achieve the task.",
            tools: (await server.tools()).slice(0, 128),
            llm: openai({ model: "gpt-4o-mini" }),
            verbose: true,
        });

        const response = await myAgent.run("What are my activities?");

        console.log("Agent response:", response.data);
    } finally {
        await server.cleanup();
    }
}

main().catch(console.error);
