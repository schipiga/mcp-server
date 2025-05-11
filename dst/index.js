#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema, } from "@modelcontextprotocol/sdk/types.js";
import { parse } from "yaml";
import * as changeCase from "change-case";
import _ from "lodash";
const SPEC_URLS = {
    v1: "https://developers.pipedrive.com/docs/api/v1/openapi.yaml",
    v2: "https://developers.pipedrive.com/docs/api/v1/openapi-v2.yaml",
};
const CONTENT_TYPES = [
    "application/json",
    "multipart/form-data",
    "application/x-www-form-urlencoded",
];
const apiCall = ({ apiUrl, path, method, pathParams, contentType }) => async (options) => {
    const queryOptions = _.omit(options, ["requestBody", ...pathParams]);
    let urlPath = `${apiUrl}${path}`;
    for (const pathParam of pathParams) {
        urlPath = urlPath.replace(`{${pathParam}}`, options[pathParam]);
    }
    const url = new URL(urlPath);
    for (const [key, val] of Object.entries(queryOptions)) {
        url.searchParams.append(key, val);
    }
    url.searchParams.append("api_token", String(process.env.PIPEDRIVE_API_KEY));
    const fetchOptions = {
        body: !_.isEmpty(options.requestBody) ? JSON.stringify(options.requestBody) : undefined,
        method: method.toLowerCase(),
        headers: { Accept: "application/json", "Content-Type": contentType },
    };
    const response = await fetch(url.toString(), fetchOptions);
    const data = await response.text();
    return {
        content: [{ type: "text", text: data }],
    };
};
const parseOpenApi = async () => {
    const tools = [];
    const apiCallOptions = {};
    for (const [version, url] of Object.entries(SPEC_URLS)) {
        const openApi = parse(await (await fetch(url)).text());
        const apiUrl = openApi.servers?.find((server) => server?.url)?.url;
        for (const [path, methods] of Object.entries(openApi.paths)) {
            for (const [method, details] of Object.entries(methods)) {
                let contentType = 'application/json';
                const pathParams = [];
                const inputSchema = {
                    type: "object",
                    properties: {},
                    required: [],
                };
                if (details.requestBody) {
                    let schema;
                    for (const conType of CONTENT_TYPES) {
                        schema = details.requestBody.content[conType]?.schema;
                        if (schema) {
                            contentType = conType;
                            break;
                        }
                    }
                    if (!schema) {
                        throw Error(`No requestBody schema in version: ${version}, path: ${path}, method: ${method}`);
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
                tools.push({
                    name: `${version}_${changeCase.snakeCase(details.operationId)}`,
                    description: details.description,
                    inputSchema,
                });
                apiCallOptions[`${version}_${changeCase.snakeCase(details.operationId)}`] = { apiUrl, path, method, pathParams, contentType };
            }
        }
    }
    return { tools, apiCallOptions };
};
async function runServer() {
    const server = new Server({
        name: "Pipedrive",
        version: "0.0.1",
    }, {
        capabilities: {
            tools: {},
        }
    });
    const { tools, apiCallOptions } = await parseOpenApi();
    server.setRequestHandler(ListToolsRequestSchema, async () => {
        return { tools };
    });
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        if (!apiCallOptions[name]) {
            throw Error(`Tool '${name}' not found`);
        }
        return await apiCall(apiCallOptions[name])(args || {});
    });
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
;
runServer();
//# sourceMappingURL=index.js.map