import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { MCPTool } from "beeai-framework/tools/mcp";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ReActAgent } from "beeai-framework/agents/react/agent";
import { UnconstrainedMemory } from "beeai-framework/memory/unconstrainedMemory";
import { OpenAIChatModel } from "beeai-framework/adapters/openai/backend/chat";

async function runClient() {
    const client = new Client({
        name: "test-client",
        version: "1.0.0",
    });

    await client.connect(
        new StdioClientTransport({
            command: "node",
            args: ["dst/index.js"],
            env: {
                PIPEDRIVE_API_KEY: process.env.PIPEDRIVE_API_KEY,
                PATH: process.env.PATH,
            },
        }),
    );

    try {
        const tools = await MCPTool.fromClient(client);

        const agent = new ReActAgent({
            llm: new OpenAIChatModel("gpt-4o-mini"),
            memory: new UnconstrainedMemory(),
            tools,
        });

        await agent.run({ prompt: "Create new contact Albert Einstein" }).observe((emitter) => {
            emitter.on("update", async ({ update }) => {
            console.log(`Agent (${update.key}) 🤖 : `, update.value);
            });
        });
    } finally {
        await client.close();
    }
};

runClient();
