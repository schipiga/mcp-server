import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { parse } from "yaml";
import * as changeCase from "change-case";
import _ from "lodash";

const SPEC_URLS = {
    v1: 'https://developers.pipedrive.com/docs/api/v1/openapi.yaml',
    v2: 'https://developers.pipedrive.com/docs/api/v1/openapi-v2.yaml'
};

const contentTypes = [
    'application/json',
    'multipart/form-data',
    'application/x-www-form-urlencoded',  
];

async function runServer() {
    const authToken = String(process.env.PIPEDRIVE_API_KEY);

    const server = new McpServer({
        name: "Pipedrive",
        version: "0.0.1"
    });

    for (const [ version, url ] of Object.entries(SPEC_URLS)) {
        const openApi = parse(await (await fetch(url)).text());
        const apiUrl = openApi.servers?.find((server: any) => server?.url)?.url;

        for (const [ path, methods ] of Object.entries(openApi.paths)) {
            for (const [ method, details ] of Object.entries(methods as unknown as { [_: string]: any; })) {
                let contentType = 'application/json';
                const pathParams: string[] = [];

                const inputSchema: { type: string, properties: any, required: string[] } = {
                    type: "object",
                    properties: {},
                    required: [],
                };

                if (details.requestBody) {
                    let schema;

                    for (const conType of contentTypes) {
                        schema = details.requestBody.content[conType]?.schema;
                        if (schema) {
                            contentType = conType;
                            break;
                        }
                    }

                    if (!schema) {
                        throw Error(`No requestBody schema in version: ${version}, path: ${path}, method: ${method}`)
                    }

                    inputSchema.properties.requestBody = _.cloneDeep(schema);
                    inputSchema.properties.requestBody.description = changeCase.sentenceCase(inputSchema.properties.requestBody.title || '');
                    delete inputSchema.properties.requestBody.title;
                    inputSchema.required.push("requestBody");
                }

                for (const param of details.parameters || []) {
                    inputSchema.properties[param.name] = { ..._.cloneDeep(param.schema), description: param.description };

                    if (param.required) {
                        inputSchema.required.push(param.name);
                    }
                    if (param.in === 'path') {
                        pathParams.push(param.name);
                    }
                }

                server.tool(`${version}_${details.operationId}`,
                    details.description,
                    inputSchema,
                    ((apiUrl, path, method, pathParams, contentType) => async (opts: any) => {
                        const reqOpts = { ...opts };
                        delete reqOpts.requestBody;

                        let urlPath = `${apiUrl}${path}`;

                        for (const pathParam of pathParams) {
                            urlPath = urlPath.replace(`{${pathParam}}`, opts[pathParam]);
                            delete reqOpts[pathParam];
                        }

                        const url = new URL(urlPath);

                        for (const [ key, val ] of Object.entries(reqOpts)) {
                            url.searchParams.append(key, val as unknown as string);
                        }

                        url.searchParams.append("api_token", authToken);

                        const options = {
                            body: _.isEmpty(opts.requestBody) ? opts.requestBody : undefined,
                            method: method.toLowerCase(),
                            headers: { Accept: "application/json", "Content-Type": contentType },
                        };

                        const response = await fetch(url.toString(), options);
                        const data = await response.text();

                        return {
                            content: [{ type: "text", text: data }],
                        };
                    })(apiUrl, path, method, pathParams, contentType),
                );
            }
        }
    }

    const transport = new StdioServerTransport();

    await server.connect(transport);
};

runServer();
