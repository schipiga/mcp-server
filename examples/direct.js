import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function runClient() {
    const client = new Client(
        {
            name: "example-client",
            version: "1.0.0"
        }
    );
    
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

    console.log('connected');
    console.log('ME', await client.callTool({ name: "v1_get_current_user" }));
};

runClient();
