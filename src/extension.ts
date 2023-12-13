import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    // 注册命令
    context.subscriptions.push(
        vscode.commands.registerCommand('callgraph.convert2mermaid', () => {
            // 获取当前激活的编辑器
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return;
            }

            // 获取当前编辑器中的文本
            const text = editor.document.getText();

            const regex = /```callgraph([\s\S]*?)```/g;

            // 扫描文本并替换
            let newText = text.replace(regex, (match, p1, offset) => {
                const convertedMermaidCode = convertToMermaid(p1.trim());

                // 判断当前文本段下方是否已经有 Mermaid 语句
                const textline = editor.document.lineAt(editor.document.positionAt(offset + match.length));
                if (updateMermaid(textline.lineNumber + 1, editor, convertedMermaidCode) ||
                    updateMermaid(textline.lineNumber + 2, editor, convertedMermaidCode)) {
                    return match;
                }

                // 将 Mermaid 代码块插入到文本段下方
                return `${match}\n\n\`\`\`mermaid\n${convertedMermaidCode}\n\`\`\``;
            });

            // 更新文档内容
            const edit = new vscode.TextEdit(
                new vscode.Range(0, 0, editor.document.lineCount, 0),
                newText
            );
            editor.edit((editorEdit) => {
                editorEdit.replace(edit.range, edit.newText);
            });
            editor.document.save();
        })
    );
}

function updateMermaid(lineNumber: number, editor: vscode.TextEditor, convertedMermaidCode: string): boolean {
    if (lineNumber < editor.document.lineCount) {
        const nextLine = editor.document.lineAt(lineNumber);
        if (nextLine.text.trim().startsWith('```mermaid')) {
            const mermaidStart = nextLine.range.start;
            let mermaidEnd = mermaidStart;
            let mermaidLine = editor.document.lineAt(mermaidEnd);
            while (!mermaidLine.text.trim().endsWith('```')) {
                mermaidEnd = mermaidLine.range.end;
                mermaidLine = editor.document.lineAt(mermaidEnd.translate(1));
            }
            mermaidEnd = mermaidLine.range.end;
            const newSegment = `${nextLine.text.trim()}\n${convertedMermaidCode}\n\`\`\``;
            const edit = new vscode.TextEdit(new vscode.Range(mermaidStart, mermaidEnd), newSegment);
            editor.edit((editorEdit) => {
                editorEdit.replace(edit.range, edit.newText);
            });
            return true;
        }
    }
    return false;
}

function convertToMermaid(text: string): string {
    // 将每一行的代码分割成数组
    const lines = text.split(/\r?\n/g);

    // 定义一个空数组，用于存储转换后的mermaid语句
    const mermaidLines: string[] = [];

    // 定义一个空数组，用于存储当前调用层级的函数栈
    const stack: { functionName: string; indentLevel: number }[] = [];

    // 定义一个计数器，用于生成子图ID
    let subgraphCount = 0;

    // 遍历每一行的代码
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // 计算当前行的缩进级别
        const indentLevel = line.search(/\S/);

        // 如果当前行是空行或注释行，则忽略它
        if (indentLevel === -1 || line[indentLevel] === '#') {
            continue;
        }

        // 获取当前行的函数名
        const functionName = line.trim();

        // 如果当前行的缩进级别小于等于栈顶元素的缩进级别，
        // 则将栈顶元素弹出，直到栈为空或当前行的缩进级别大于栈顶元素的缩进级别
        while (stack.length > 0 && indentLevel <= stack[stack.length - 1].indentLevel) {
            stack.pop();
        }

        // 如果栈不为空，则将当前行与栈顶元素连接起来
        if (stack.length > 0) {
            const parentFunction = stack[stack.length - 1].functionName;
            mermaidLines.push(`${parentFunction}-->${functionName}`);
        } else {
            // 如果栈为空，则说明当前行是一个新的子图的起始行
            if (subgraphCount > 0)
            {
                mermaidLines.push("end");
            }
            subgraphCount++;
            mermaidLines.push(`subgraph ${subgraphCount}`);
        }

        // 将当前行的函数名压入栈中
        stack.push({ functionName, indentLevel });
    }

    // 将所有未结束的子图添加上结束标记
    if (stack.length > 0) {
        mermaidLines.push("end");
    }

    // 将转换后的mermaid语句拼接成一个字符串
    const mermaidText = `graph TD\r\n${mermaidLines.join('\r\n')}`.replace(/[()]/g, '');

    return mermaidText;
}

// This method is called when your extension is deactivated
export function deactivate() { }