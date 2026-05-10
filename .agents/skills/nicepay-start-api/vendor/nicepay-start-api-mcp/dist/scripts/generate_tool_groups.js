import { generateToolGroupsFile } from "../utils/auto_register_tools.js";
import { appendQnaToolGroup } from "../mcp/qna_tool.js";
(async () => {
    try {
        await generateToolGroupsFile();
        appendQnaToolGroup();
    }
    catch (err) {
        console.error(err);
        process.exit(1);
    }
})();
