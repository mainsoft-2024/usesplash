#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { autoRegisterTools } from "./utils/auto_register_tools.js";
import { registerQnaSearchTool } from "./mcp/qna_tool.js";
const server = new McpServer({
    name: "nicepay-start-api-mcp-server",
    version: "0.0.10",
});
async function main() {
    await autoRegisterTools(server);
    registerQnaSearchTool(server);
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
main();
