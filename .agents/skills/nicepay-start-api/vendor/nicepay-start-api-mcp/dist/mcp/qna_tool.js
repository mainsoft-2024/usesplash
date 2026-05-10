import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import MiniSearch from "minisearch";
import { z } from "zod";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "../..");
export function registerQnaSearchTool(mcpServer) {
    mcpServer.tool("search_nicepay_qna", "설정된 Q&A 데이터에서 질문에 유사한 답변을 찾아줍니다.", {
        userQuestion: z.string().describe("사용자 질문"),
        topKCount: z.number().int().optional().describe("반환 개수"),
    }, async ({ userQuestion, topKCount = 3 }) => {
        const qnaJsonPath = path.join(projectRoot, "dist/qna/questions.json");
        if (!fs.existsSync(qnaJsonPath)) {
            return { content: [{ type: "text", text: "QnA 데이터 파일를 찾을 수 없습니다." }] };
        }
        const qnaList = JSON.parse(fs.readFileSync(qnaJsonPath, "utf8"));
        const qnaSearch = new MiniSearch({
            fields: ["question", "answer"],
            storeFields: ["question", "answer"],
            idField: "id",
            searchOptions: {
                boost: { question: 2, answer: 1 },
                fuzzy: 0.2,
                prefix: true,
            },
        });
        qnaSearch.addAll(qnaList);
        const searchResults = qnaSearch.search(userQuestion, { prefix: true, fuzzy: 0.2 });
        const topQna = searchResults.slice(0, topKCount);
        if (topQna.length === 0) {
            return { content: [{ type: "text", text: "유사한 QnA를 찾을 수 없습니다." }] };
        }
        const markdown = topQna
            .map((qna, idx) => `**Q${idx + 1}.** ${qna.question}\n**A:** ${qna.answer} (Score: ${(qna.score ?? 0).toFixed(2)})`)
            .join("\n\n");
        return { content: [{ type: "text", text: markdown }] };
    });
}
export function appendQnaToolGroup() {
    const outPath = path.join(projectRoot, "dist/tool_groups.json");
    let groups = [];
    if (fs.existsSync(outPath)) {
        groups = JSON.parse(fs.readFileSync(outPath, "utf8"));
    }
    const group = {
        name: "qna",
        description: "자연어 질문에 대해 QnA 데이터베이스에서 유사한 질문/답변을 찾아줍니다. 결제 프로세스, 고객 문의 자동응답 등에 유용합니다.",
        methods: [
            {
                name: "search_nicepay_qna",
                description: "사용자의 질문을 바탕으로 가장 유사한 질문과 그에 대한 답변을 반환합니다.",
                isClient: false,
                parameters: {
                    userQuestion: "자연어로 입력된 사용자 질문",
                    topKCount: "유사한 QnA 반환 개수 (기본 3개)",
                },
            },
        ],
    };
    const exists = groups.some((g) => g.name === group.name);
    if (!exists)
        groups.push(group);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(groups, null, 2));
}
