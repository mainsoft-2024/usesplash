import SwaggerParser from "@apidevtools/swagger-parser";
import { z } from "zod";
import { fileURLToPath } from "url";
import fs from "fs";
import path from "path";
import { generateClientCodeFromTemplate } from "./code_generator.js";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../../");
const DEFAULT_OPENAPI_DIR = path.join(__dirname, "../openapi");
function formatGroups(groups) {
    return groups.map((g) => ({
        name: g.name,
        description: g.description,
        methods: Object.entries(g.methods).map(([n, m]) => ({
            name: n,
            description: m.description,
            isClient: m.isClient,
            parameters: {
                ...(m.isClient ? {} : { basicAuthToken: "Base64 encoded clientId:secretKey" }),
                ...m.paramInfo,
            },
            ...(m.operation["x-js-sdk"] && { jsSdk: m.operation["x-js-sdk"] }),
            ...(m.operation["x-mcp-template"] && { template: m.operation["x-mcp-template"] }),
        })),
    }));
}
function writeGroupsFile(groups) {
    const outPath = path.join(projectRoot, "dist", "tool_groups.json");
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(formatGroups(groups), null, 2));
}
function resolveRef(ref, openapi) {
    if (!ref.startsWith('#/'))
        return undefined;
    const parts = ref.replace(/^#\//, '').split('/');
    let current = openapi;
    for (const p of parts) {
        current = current?.[p];
    }
    return current;
}
function openApiSchemaToZod(schema, openapi) {
    if (!schema)
        return z.any();
    if (schema.$ref && openapi) {
        const resolved = resolveRef(schema.$ref, openapi);
        return openApiSchemaToZod(resolved, openapi);
    }
    if (schema.type === "object" || schema.properties) {
        const shape = {};
        const required = new Set(schema.required || []);
        for (const key in schema.properties || {}) {
            let child = openApiSchemaToZod(schema.properties[key], openapi);
            if (!required.has(key))
                child = child.optional();
            shape[key] = child;
        }
        return z.object(shape).describe(schema.description || "");
    }
    if (schema.type === "array" && schema.items) {
        return z.array(openApiSchemaToZod(schema.items, openapi)).describe(schema.description || "");
    }
    if (schema.enum && Array.isArray(schema.enum)) {
        const values = schema.enum;
        const allStrings = values.every((v) => typeof v === "string");
        if (allStrings && values.length > 0) {
            return z.enum(values).describe(schema.description || "");
        }
        if (values.length > 0) {
            const literals = values.map((v) => z.literal(v));
            return z.union(literals).describe(schema.description || "");
        }
    }
    switch (schema.type) {
        case "string":
            return z.string().describe(schema.description || "");
        case "integer":
        case "number":
            return z.number().describe(schema.description || "");
        case "boolean":
            return z.boolean().describe(schema.description || "");
        default:
            return z.any().describe(schema?.description || "");
    }
}
function flattenSchemaProperties(schema, openapi, shape, info, bodyKeys) {
    if (!schema)
        return;
    if (schema.$ref) {
        const resolved = resolveRef(schema.$ref, openapi);
        return flattenSchemaProperties(resolved, openapi, shape, info, bodyKeys);
    }
    if (schema.type === "object" || schema.properties) {
        const required = new Set(schema.required || []);
        for (const key in schema.properties || {}) {
            const prop = schema.properties[key];
            let zodType = openApiSchemaToZod(prop, openapi);
            if (!required.has(key))
                zodType = zodType.optional();
            shape[key] = zodType;
            info[key] = prop.description || "";
            bodyKeys.add(key);
        }
        return;
    }
    shape["body"] = openApiSchemaToZod(schema, openapi);
    info["body"] = schema.description || "";
    bodyKeys.add("body");
}
function shortDescription(op) {
    const text = op.summary || op.description || "";
    const first = text.split(/\n|\./)[0].trim();
    return first;
}
async function buildToolGroups(openapi) {
    const groups = {};
    for (const pathKey in openapi.paths) {
        const item = openapi.paths[pathKey];
        for (const method of ["get", "post", "put", "delete", "patch"]) {
            const op = item[method];
            if (!op)
                continue;
            const tag = op.tags?.[0] || "default";
            if (!groups[tag]) {
                groups[tag] = { name: tag, description: "", methods: {} };
            }
            const methodName = op.operationId || `${method}_${pathKey.replace(/[\/{\}]/g, "_")}`;
            const schema = {};
            const paramInfo = {};
            const bodyKeys = new Set();
            if (Array.isArray(op.parameters)) {
                for (const p of op.parameters) {
                    let zodType = openApiSchemaToZod(p.schema, openapi);
                    const desc = p.description || p.schema?.description || "";
                    if (desc)
                        zodType = zodType.describe(desc);
                    if (!p.required)
                        zodType = zodType.optional();
                    schema[p.name] = zodType;
                    paramInfo[p.name] = desc;
                }
            }
            const bodySchema = op.requestBody?.content?.["application/json"]
                ?.schema;
            if (bodySchema) {
                flattenSchemaProperties(bodySchema, openapi, schema, paramInfo, bodyKeys);
            }
            const respSchema = op.responses?.["200"]?.content?.["application/json"]?.schema;
            const output = respSchema ? openApiSchemaToZod(respSchema, openapi) : undefined;
            groups[tag].methods[methodName] = {
                description: shortDescription(op),
                schema,
                paramInfo,
                bodyKeys,
                output,
                operation: op,
                path: pathKey,
                method,
                isClient: op["x-mcp-client-tool"] === true,
            };
        }
    }
    const result = Object.values(groups);
    for (const g of result) {
        const entries = Object.entries(g.methods).map(([n, m]) => `${n}: ${m.description}`);
        const list = entries.slice(0, 5).join(" / ");
        g.description = entries.length > 5 ? `${list} 등` : list;
    }
    return result;
}
export async function generateToolGroupsFile() {
    const openapiPath = path.join(DEFAULT_OPENAPI_DIR, "openapi.yaml");
    if (!fs.existsSync(openapiPath))
        return;
    const openapi = (await SwaggerParser.validate(openapiPath, {
        dereference: { circular: "ignore" },
    }));
    const groups = await buildToolGroups(openapi);
    writeGroupsFile(groups);
}
export async function autoRegisterTools(server) {
    const openapiPath = path.join(DEFAULT_OPENAPI_DIR, "openapi.yaml");
    if (!fs.existsSync(openapiPath))
        return;
    try {
        const openapi = (await SwaggerParser.validate(openapiPath, {
            dereference: { circular: "ignore" },
        }));
        const groups = await buildToolGroups(openapi);
        writeGroupsFile(groups);
        for (const group of groups) {
            for (const [name, m] of Object.entries(group.methods)) {
                if (m.isClient) {
                    server.tool(name, m.description, m.schema, (args) => {
                        const code = generateClientCodeFromTemplate(m.operation, args);
                        return { content: [{ type: "text", text: code }] };
                    });
                }
                else {
                    const toolSchema = {
                        basicAuthToken: z
                            .string()
                            .describe("Base64 encoded clientId:secretKey"),
                        ...m.schema,
                    };
                    server.tool(name, m.description, toolSchema, async (args) => {
                        const { basicAuthToken, ...input } = args;
                        const baseUrl = m.operation.servers?.[0]?.url || openapi.servers?.[0]?.url || "";
                        let url = baseUrl + m.path;
                        const query = new URLSearchParams();
                        if (Array.isArray(m.operation.parameters)) {
                            for (const p of m.operation.parameters) {
                                const val = input[p.name];
                                if (val === undefined)
                                    continue;
                                if (p.in === "path") {
                                    url = url.replace(`{${p.name}}`, val);
                                }
                                else if (p.in === "query") {
                                    query.append(p.name, String(val));
                                }
                            }
                        }
                        const finalUrl = query.toString()
                            ? `${url}?${query.toString()}`
                            : url;
                        const body = {};
                        for (const key of m.bodyKeys) {
                            if (input[key] !== undefined) {
                                body[key] = input[key];
                            }
                        }
                        const apiCallInfo = {
                            description: `This JSON object contains the necessary details to make the '${name}' API call.`,
                            requestDetails: {
                                method: m.method.toUpperCase(),
                                url: finalUrl,
                                headers: {
                                    "Content-Type": "application/json",
                                    Authorization: `Basic ${basicAuthToken}`,
                                },
                                body,
                            },
                        };
                        return {
                            content: [{ type: "text", text: JSON.stringify(apiCallInfo, null, 2) }],
                        };
                    });
                }
            }
        }
    }
    catch {
        // suppress errors for non-stdio environments
    }
}
export { buildToolGroups };
