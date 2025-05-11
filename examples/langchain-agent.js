import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { loadMcpTools } from "@langchain/mcp-adapters";

async function runClient () {
    const model = new ChatOpenAI({ modelName: "gpt-4o-mini" });

    const transport = new StdioClientTransport({
        command: "npx",
        args: ["-y", "github:schipiga/mcp-server"],
        env: {
            PIPEDRIVE_API_KEY: process.env.PIPEDRIVE_API_KEY,
            PATH: process.env.PATH,
        },
    });

    const client = new Client({
        name: "mcp-client",
        version: "1.0.0",
    });

    try {
        await client.connect(transport);

        const tools = await loadMcpTools("mcp", client, {
            throwOnLoadError: true,
            prefixToolNameWithServerName: false,
            additionalToolNamePrefix: "",
        });

        const agent = createReactAgent({ llm: model, tools: tools.slice(0, 128) });
        const agentResponse = await agent.invoke({
            messages: [{ role: "user", content: "How many opened deals I have?" }],
        });
        console.log(agentResponse);
    } catch (e) {
        console.error(e);
    } finally {
        await client.close();
    }
}

runClient();
